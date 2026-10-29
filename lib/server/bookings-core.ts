import "server-only"
import { z } from "zod"
import { core } from "@/lib/core/db"
import { slots, windowOpen, type SlotNeed } from "@/lib/core/capacity"
import { createBooking, listJobs, listPros } from "@/lib/core/jobs"
import { checkPromo, PromoError } from "@/lib/core/promos"
import { PackError, packForBooking } from "@/lib/core/packs"
import { policy } from "@/lib/core/policy"
import { normalisePhone } from "@/lib/core/phone"
import { eligible } from "@/lib/ops/logic"
import { zoneCaps } from "@/lib/core/pros"
import { PricingError, priceItems } from "@/lib/core/pricing"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { nextDays } from "@/lib/time"
import { saveSubmission, schemas, ValidationError } from "./store"
import { kick } from "./kick"

// Placing a booking. With the core engine on, the server prices every line from the catalogue,
// checks the arrival window still has room, then saves the submission (kept as the email copy and
// the fallback record) and creates the booking. Without the core it is a plain submission, as
// before. Used by the website checkout, the phone app and the Concierge.

type BookingData = z.infer<typeof schemas.booking>

/** `customerId`: the signed-in customer placing it (their wallet credit, saved addresses and packs can be used). */
export async function placeBooking(raw: unknown, attribution: Record<string, unknown> = {}, page?: string, customerId?: string): Promise<{ id: string; total?: number; credit?: number; packPaid?: number }> {
  const parsed = schemas.booking.safeParse(raw)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid data")
  const d: BookingData = parsed.data
  // A database problem must never stop a customer booking: fall back to the plain submission.
  const db = await core().catch((e) => {
    console.error("[booking] core unavailable, saving as a submission only", e)
    return null
  })
  if (!db) return { id: (await saveSubmission("booking", d, attribution, page)).id }

  const [cat, settings] = await Promise.all([getCatalog("en"), getSettings("en")])
  try {
    priceItems(d.items, cat)
  } catch (e) {
    if (e instanceof PricingError) throw new ValidationError(e.message, "unavailable")
    throw e
  }
  let full = false
  try {
    const [jobs, pros, caps] = [await listJobs(db, { sinceDays: 0 }), await listPros(db), await zoneCaps(db)]
    full = !windowOpen(d.date, d.window, jobs, pros, { area: d.area, items: d.items }, cat, { zoneCaps: caps })
  } catch (e) {
    console.error("[booking] capacity check failed; booking anyway", e)
  }
  if (full) throw new ValidationError("That time just filled up. Please pick another window.", "slotFull")

  // A pack that can't pay for this visit is turned down before anything is saved (signed in only).
  if (d.packId && !customerId) throw new ValidationError("Sign in to use your pack", "pack-missing")
  if (d.packId && customerId) {
    try {
      await packForBooking(db, { packId: d.packId, customerId, items: priceItems(d.items, cat).items, cat })
    } catch (e) {
      if (e instanceof PackError) throw new ValidationError(e.message, `pack-${e.code}`)
      throw e
    }
  }

  // A promo code that can't be used is turned down before anything is saved.
  if (d.promo?.trim()) {
    const c = await checkPromo(db, d.promo, { subtotal: priceItems(d.items, cat).subtotal, customerId: customerId ?? (await customerIdForPhone(db, d.phone)) })
    if (!c.ok) throw new ValidationError(new PromoError(c.problem, c.minOrder).message, `promo-${c.problem}`)
  }
  const { id } = await saveSubmission("booking", d, attribution, page)
  try {
    const job = await createBooking(db, { id, ...d, customerId, useCredit: Boolean(customerId && d.useCredit), packId: customerId ? d.packId : undefined }, cat, { referralOff: settings.referral.friendOff })
    kick()
    return { id, total: job.total, credit: job.credit ?? 0, packPaid: job.pack?.paid ?? 0 }
  } catch (e) {
    // The submission is safe; the ops catch-up (syncJobs) imports it on the next read.
    console.error(`[booking] ${id}: core write failed`, e)
    return { id }
  }
}

const customerIdForPhone = async (db: NonNullable<Awaited<ReturnType<typeof core>>>, phone: string) => (await db.one<{ id: string }>("select id from customers where phone = $1", [normalisePhone(phone)]))?.id ?? null

const slotBody = z.object({
  area: z.string().max(60),
  /** "Book her again": only this pro's free windows. */
  proId: z.string().max(40).optional(),
  items: z.array(z.object({ category: z.string().max(80), service: z.string().max(120), qty: z.number().int().min(1).max(10) })).min(1).max(20),
})

/** Open arrival windows for the next 7 days. "off" means the core isn't on: use the plain rules. */
export async function slotsFor(raw: unknown) {
  const b = slotBody.parse(raw)
  const db = await core()
  if (!db) return { mode: "off" as const, days: [] }
  const [cat, settings] = await Promise.all([getCatalog("en"), getSettings("en")])
  const [jobs, pros, caps] = [await listJobs(db, { sinceDays: 0 }), await listPros(db), await zoneCaps(db)]
  const need: SlotNeed = { area: b.area, items: b.items.map((i) => ({ name: "", category: i.category, service: i.service, options: [], addOns: [], qty: i.qty, unitPrice: 0 })) }
  if (b.proId) {
    // Her own day only: her visits, her windows and days off. She has to be able to do all of it.
    const her = pros.find((p) => p.id === b.proId && p.status === "active")
    const probe = { id: "", createdAt: "", date: "", window: "", area: b.area, address: "", customer: { name: "", phone: "" }, items: need.items, total: 0, payment: "", status: "new" as const, events: [] }
    if (!her || !eligible(her, probe, cat)) return { mode: "unavailable" as const, days: [] }
    const hers = slots(nextDays(7).map((d) => d.iso), jobs.filter((j) => j.proId === her.id), [her], need, cat, settings.policy.leadHours)
    const free = new Set(hers.days.flatMap((d) => d.windows.filter((w) => w.open).map((w) => `${d.date} ${w.label}`)))
    // Booking checks the whole area's plan (zone caps, other open visits): only its open windows
    // can be booked, whoever comes.
    const all = slots(nextDays(7).map((d) => d.iso), jobs, pros, need, cat, settings.policy.leadHours, { zoneCaps: caps })
    // Without the favourite-pro guarantee: her own free windows only. With it: every open window,
    // the ones she's free marked (`pro`); if she can't come after all, well-rated pros are asked first.
    const g = await policy(db, "guarantee")
    const days = all.days.map((d) => ({ ...d, windows: d.windows.map((w) => ({ ...w, pro: w.open && free.has(`${d.date} ${w.label}`) })) }))
    if (!g.on) return { mode: hers.mode, days: days.map((d) => ({ ...d, windows: d.windows.map(({ label, pro }) => ({ label, open: pro })) })) }
    return { mode: all.mode, days, guarantee: { stars: g.minStars, credit: g.creditOn && g.credit > 0 ? g.credit : null } }
  }
  return slots(nextDays(7).map((d) => d.iso), jobs, pros, need, cat, settings.policy.leadHours, { zoneCaps: caps })
}
