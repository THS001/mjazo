import "server-only"
import { z } from "zod"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { requireCore } from "@/lib/core/db"
import { optIn } from "@/lib/core/automation"
import { plusFor, redeemGiftCard, referralCode, referralSummary, referrerOf, requestPlus } from "@/lib/core/growth"
import { packsFor, requestPack } from "@/lib/core/packs"
import { packOffers } from "@/lib/packs"
import { creditFor, deleteAddress, endPhoneSessions, linkAccount, LinkError, listAddresses, saveAddress, updateCustomer, type AddressInput, type Customer } from "@/lib/core/customers"
import { listCustomerJobs } from "@/lib/core/jobs"
import { livePoints, withEta, type LivePoint } from "@/lib/core/tracking"
import { windowStart } from "@/lib/core/offers"
import { checkPromo } from "@/lib/core/promos"
import { priceItems, type ClientItem } from "@/lib/core/pricing"
import { normalisePhone } from "@/lib/core/phone"
import type { Job, Pro } from "@/lib/ops/types"
import type { Account } from "./customer-auth"
import { audit } from "./audit"
import { OpsError, addJobEvent, getJob, getPros, rescheduleJob } from "./ops"
import { packOffersIn } from "./pack-offers"
import { proveNumber } from "./phone-sign-in"
import { notifyOps } from "./store"

// What the client account shows and does (/api/v1/customer, used by /account on the website and
// by the phone app). Every function takes the signed-in customer and only touches their own
// bookings and addresses. A pro is shown by her first name only.

type Cat = Awaited<ReturnType<typeof getCatalog>>
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

/** The visit can still be changed or cancelled online until this time (the policy's free-change hours before the window). */
export function changeDeadline(j: Pick<Job, "date" | "window">, freeChangeHours: number): Date | null {
  const start = windowStart(j.date, j.window)
  return start ? new Date(start.getTime() - freeChangeHours * 3600_000) : null
}

const lastAt = (j: Job, type: string) => j.events.filter((e) => e.type === type).at(-1)?.at ?? null

/** One booking as its customer sees it. */
function bookingView(j: Job, cat: Cat, pros: Pro[], freeChangeHours: number, live?: LivePoint, now = new Date()) {
  const subtotal = j.items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const pro = pros.find((p) => p.id === j.proId)
  const asked = pros.find((p) => p.id === j.preferredProId)
  const until = changeDeadline(j, freeChangeHours)
  const changeable = ["new", "assigned"].includes(j.status)
  return {
    id: j.id,
    createdAt: j.createdAt,
    date: j.date,
    window: j.window,
    status: j.status,
    area: j.area,
    areaName: cat.getArea(j.area)?.name ?? j.area,
    subArea: j.subArea ?? null,
    address: j.address,
    landmark: j.landmark ?? null,
    items: j.items.map((i) => ({ name: i.name, category: i.category, service: i.service, options: i.options, addOns: i.addOns, qty: i.qty, unitPrice: i.unitPrice })),
    subtotal,
    discount: Math.max(0, subtotal - j.total),
    total: j.total,
    credit: j.credit ?? 0,
    // A visit of their prepaid pack: the pack pays this much of the total.
    pack: j.pack ? { name: j.pack.name, paid: j.pack.paid } : null,
    due: j.total - (j.credit ?? 0) - (j.pack?.paid ?? 0),
    payment: j.payment,
    pro: pro ? { firstName: firstName(pro.name) } : null,
    askedFor: asked ? { id: asked.id, firstName: firstName(asked.name) } : null,
    eta: j.eta ?? null,
    // Where the pro is while she's on the way (her phone sends it with Mjazo Pro open), how far and how long.
    live: live && j.status === "en_route" ? withEta(live, { lat: j.lat, lng: j.lng, area: j.area }) : null,
    // When each step happened (null: not yet).
    steps: { booked: j.createdAt, assigned: j.proId ? lastAt(j, "assigned") : null, onTheWay: lastAt(j, "en_route"), arrived: lastAt(j, "checked_in"), done: lastAt(j, "completed"), cancelled: lastAt(j, "cancelled") },
    canChange: changeable && Boolean(until && now < until),
    changeUntil: changeable && until ? until.toISOString() : null,
    rating: j.rating ? { stars: j.rating.stars } : null,
    // "Book her again": a finished visit whose pro still works with Mjazo.
    rebookWith: j.status === "completed" && pro?.status === "active" ? { id: pro.id, firstName: firstName(pro.name) } : null,
  }
}
export type CustomerBooking = ReturnType<typeof bookingView>

async function context() {
  const [cat, settings, pros] = await Promise.all([getCatalog(), getSettings("en"), getPros()])
  return { cat, pros, hours: settings.policy.freeChangeHours }
}

/** Their bookings: upcoming first (soonest first), then past ones (newest first). */
export async function customerBookings(c: Customer) {
  const db = await requireCore()
  const { cat, pros, hours } = await context()
  const jobs = await listCustomerJobs(db, c.id)
  const live = await livePoints(db, jobs.filter((j) => j.status === "en_route").map((j) => j.id))
  const views = jobs.map((j) => bookingView(j, cat, pros, hours, live.get(j.id)))
  const open = (v: CustomerBooking) => !["completed", "cancelled", "no_show"].includes(v.status)
  return {
    upcoming: views.filter(open).sort((a, b) => a.date.localeCompare(b.date)),
    past: views.filter((v) => !open(v)),
  }
}

async function ownBooking(c: Customer, id: string) {
  const db = await requireCore()
  const j = await getJob(id)
  const owner = j ? await db.one<{ customer_id: string | null }>("select customer_id from bookings where id = $1", [id]) : null
  if (!j || owner?.customer_id !== c.id) throw new OpsError("Booking not found")
  return j
}

export async function customerBooking(c: Customer, id: string) {
  const j = await ownBooking(c, id)
  const { cat, pros, hours } = await context()
  const live = j.status === "en_route" ? (await livePoints(await requireCore(), [j.id])).get(j.id) : undefined
  return bookingView(j, cat, pros, hours, live)
}

/** Cancel or move a visit, online only until the policy's free-change time. */
export async function changeBooking(c: Customer, id: string, a: { action: "cancel"; reason?: string } | { action: "reschedule"; date: string; window: string }) {
  const j = await ownBooking(c, id)
  const { hours } = await context()
  const until = changeDeadline(j, hours)
  if (!["new", "assigned"].includes(j.status) || !until || new Date() >= until) throw new OpsError("It's too late to change this visit online. Message us on WhatsApp.")
  const actor = `customer:${c.id}`
  if (a.action === "cancel") {
    const why = a.reason?.trim().slice(0, 200)
    await addJobEvent(id, "cancelled", "customer", { actor, note: why ? `Cancelled by the customer: ${why}` : "Cancelled by the customer" })
    await audit(actor, "cancelled their booking", id, why)
  } else {
    const r = await rescheduleJob(id, { date: a.date, window: a.window }, actor, { by: "customer" })
    if (r.full) return { full: true as const }
    await audit(actor, "moved their booking", id, `${a.date}, ${a.window}`)
  }
  return { booking: await customerBooking(c, id) }
}

// ---------------------------------------------------------------------------
// Account, wallet, addresses, promo codes
// ---------------------------------------------------------------------------

/**
 * Who's signed in: the account's email and how they signed in (email or phone), the customer (null
 * until an emailed sign-in adds its number), their credit, their Mjazo Plus membership (or request)
 * and their referral code with what it has earned.
 */
export async function customerMe(account: Pick<Account, "email" | "by">, c: Customer | null) {
  const db = await requireCore()
  if (!c) return { email: account.email, by: account.by, customer: null, credit: { balance: 0, available: 0 }, plus: null, referral: null }
  const [credit, plus, code, summary, settings] = await Promise.all([creditFor(db, c.id), plusFor(db, c.id), referralCode(db, c.id), referralSummary(db, c.id), getSettings("en")])
  return {
    email: account.email,
    by: account.by,
    customer: c,
    credit,
    plus: plus && { status: plus.status, endsAt: plus.endsAt, discountPct: plus.discountPct, price: plus.price },
    referral: code ? { code, friendOff: settings.referral.friendOff, youGet: settings.referral.youGet, ...summary } : null,
  }
}

/** They ask to join Mjazo Plus; ops are told, take the fee and activate it. */
export async function joinPlus(c: Customer) {
  const db = await requireCore()
  const s = await getSettings("en")
  const before = await plusFor(db, c.id)
  const p = await requestPlus(db, c.id, { price: s.plus.price, discountPct: Math.round(s.plus.discount * 100) }, `customer:${c.id}`)
  if (!before) void notifyOps(`[Mjazo] Plus request from ${c.name || c.phone}`, `${c.name} (${c.phone ?? "no number"}) asked to join Mjazo Plus (${p.price} a year, ${p.discountPct}% off).\nTake the fee, then activate it in mission control → Plus & gifts.`).catch(() => {})
  return { status: p.status, endsAt: p.endsAt, discountPct: p.discountPct, price: p.price }
}

/** A gift card turned into their credit. */
export async function addGiftCard(c: Customer, code: string) {
  const db = await requireCore()
  const g = await redeemGiftCard(db, c.id, code)
  return { added: g.amount, credit: await creditFor(db, c.id) }
}

// ---------------------------------------------------------------------------
// Packs
// ---------------------------------------------------------------------------

type Lang = "en" | "ur"

/** The packs on offer, and theirs: asked for (waiting for payment), in use, used up or ended. */
export async function customerPacks(c: Customer, lang: Lang = "en") {
  const db = await requireCore()
  const [offers, mine, en] = await Promise.all([packOffersIn(lang), packsFor(db, c.id), getCatalog("en")])
  // One visit as a cart line, at today's price (the pack pays its price a visit of it); null when
  // its service can't be booked any more.
  const lineOf = (k: (typeof mine)[number]) => {
    try {
      const l = priceItems([{ ...k.item, addOns: [], qty: 1 }], en).items[0]
      return { name: k.item.name, category: k.item.category, service: k.item.service, options: k.item.options, unitPrice: l.unitPrice, duration: l.duration }
    } catch {
      return null
    }
  }
  return {
    offers,
    mine: mine.map((k) => {
      const o = offers.find((x) => x.slug === k.slug)
      return {
        id: k.id,
        slug: k.slug,
        name: o?.name ?? k.name,
        itemName: o?.itemName ?? k.item.name,
        line: lineOf(k),
        status: k.status,
        visits: k.visits,
        visitPrice: k.visitPrice,
        total: k.visits * k.visitPrice,
        everyDays: k.everyDays,
        endsAt: k.endsAt,
        used: k.used,
        booked: k.booked,
        left: k.left,
        nextDue: k.nextDue,
        expired: k.expired,
      }
    }),
  }
}
export type CustomerPackView = Awaited<ReturnType<typeof customerPacks>>["mine"][number]

/** They ask for a pack; ops are told, take the money and activate it. */
export async function askForPack(c: Customer, slug: string, lang: Lang = "en") {
  const db = await requireCore()
  const offer = packOffers(await getCatalog("en")).find((o) => o.slug === slug)
  if (!offer) throw new OpsError("That pack isn't available any more")
  const { pack, isNew } = await requestPack(db, c.id, offer, `customer:${c.id}`)
  if (isNew)
    void notifyOps(
      `[Mjazo] Pack request from ${c.name || c.phone}`,
      `${c.name} (${c.phone ?? "no number"}) asked for the ${offer.name} pack: ${offer.visits} visits at PKR ${offer.visitPrice} (PKR ${offer.total} upfront).\nTake the money, then activate it in mission control → Plus & gifts.`,
    ).catch(() => {})
  return { id: pack.id, ...(await customerPacks(c, lang)) }
}

/**
 * Adds the number to an emailed sign-in. A code sent to the number (`code`) proves it's theirs;
 * so do booking numbers made with it (`proof`). A phone sign-in has its number already.
 */
export async function linkCustomer(account: Account, b: { name: string; phone: string; proof?: string[]; code?: string }) {
  if (account.by === "phone") {
    if (normalisePhone(b.phone) !== account.customer.phone) throw new LinkError("Your account already has a number. To change it, message us on WhatsApp.", "hasPhone")
    return account.customer
  }
  const verified = b.code ? Boolean(await proveNumber(b.phone, b.code)) : false
  return linkAccount(await requireCore(), { userId: account.userId, email: account.email, name: b.name, phone: b.phone, proof: b.proof, verified })
}

/** Ends every phone sign-in of theirs, on every device (an emailed sign-in is signed out by Supabase, in the browser or app). */
export const endCustomerSessions = async (c: Customer) => endPhoneSessions(await requireCore(), c.id)

export async function saveCustomer(c: Customer, p: { name?: string; lang?: string; marketingOk?: boolean }) {
  const db = await requireCore()
  if (p.marketingOk && c.phone) await optIn(db, c.phone)
  return updateCustomer(db, c.id, p)
}

/** A saved address as the API takes it. */
export const addressBody = z.object({
  label: z.string().max(40).nullable().optional(),
  area: z.string().max(60).optional(),
  subArea: z.string().max(60).nullable().optional(),
  line: z.string().max(200),
  landmark: z.string().max(120).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  isDefault: z.boolean().optional(),
})

const liveAreas = async () => (await getCatalog()).areas.filter((a) => a.status === "live").map((a) => a.slug)
export const customerAddresses = async (c: Customer) => listAddresses(await requireCore(), c.id)
export const saveCustomerAddress = async (c: Customer, a: AddressInput & { id?: string }) => saveAddress(await requireCore(), c.id, a, await liveAreas())
export const deleteCustomerAddress = async (c: Customer, id: string) => deleteAddress(await requireCore(), c.id, id)

/**
 * Checks a code against an order before it's placed (the checkout shows what it takes off): a promo
 * code, or a friend's referral code (first booking only, never their own).
 */
export async function checkCustomerPromo(code: string, items: ClientItem[], customerId?: string | null) {
  const db = await requireCore()
  const cat = await getCatalog("en")
  const subtotal = priceItems(items, cat).subtotal
  const r = await checkPromo(db, code, { subtotal, customerId })
  if (r.ok || r.problem !== "invalid") return r
  const referrer = await referrerOf(db, code)
  if (!referrer || referrer === customerId) return r
  if (customerId && (await db.one("select 1 from bookings where customer_id = $1 and status <> 'cancelled' limit 1", [customerId]))) return { ok: false as const, code: code.trim().toUpperCase(), problem: "used" as const }
  const s = await getSettings("en")
  return { ok: true as const, code: code.trim().toUpperCase(), discount: Math.min(s.referral.friendOff, subtotal), kind: "referral" as const }
}
