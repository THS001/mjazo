import "server-only"
import { z } from "zod"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { requireCore } from "@/lib/core/db"
import { creditFor, deleteAddress, linkAccount, listAddresses, saveAddress, updateCustomer, type AddressInput, type Customer } from "@/lib/core/customers"
import { listCustomerJobs } from "@/lib/core/jobs"
import { windowStart } from "@/lib/core/offers"
import { checkPromo } from "@/lib/core/promos"
import { priceItems, type ClientItem } from "@/lib/core/pricing"
import type { Job, Pro } from "@/lib/ops/types"
import type { Account } from "./customer-auth"
import { audit } from "./audit"
import { OpsError, addJobEvent, getJob, getPros, rescheduleJob } from "./ops"

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
function bookingView(j: Job, cat: Cat, pros: Pro[], freeChangeHours: number, now = new Date()) {
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
    due: j.total - (j.credit ?? 0),
    payment: j.payment,
    pro: pro ? { firstName: firstName(pro.name) } : null,
    askedFor: asked ? { id: asked.id, firstName: firstName(asked.name) } : null,
    eta: j.eta ?? null,
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
  const views = (await listCustomerJobs(db, c.id)).map((j) => bookingView(j, cat, pros, hours))
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
  return bookingView(j, cat, pros, hours)
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

/** Who's signed in: the account's email, the customer (null until they add their number) and their credit. */
export async function customerMe(account: Account, c: Customer | null) {
  const db = await requireCore()
  return { email: account.email, customer: c, credit: c ? await creditFor(db, c.id) : { balance: 0, available: 0 } }
}

export async function linkCustomer(account: Account, b: { name: string; phone: string; proof?: string[] }) {
  return linkAccount(await requireCore(), { userId: account.userId, email: account.email, ...b })
}

export const saveCustomer = async (c: Customer, p: { name?: string; lang?: string; marketingOk?: boolean }) => updateCustomer(await requireCore(), c.id, p)

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

/** Checks a promo code against an order before it's placed (the checkout shows what it takes off). */
export async function checkCustomerPromo(code: string, items: ClientItem[], customerId?: string | null) {
  const cat = await getCatalog("en")
  return checkPromo(await requireCore(), code, { subtotal: priceItems(items, cat).subtotal, customerId })
}
