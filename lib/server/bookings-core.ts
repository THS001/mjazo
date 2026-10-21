import "server-only"
import { z } from "zod"
import { core } from "@/lib/core/db"
import { slots, windowOpen, type SlotNeed } from "@/lib/core/capacity"
import { createBooking, listJobs, listPros } from "@/lib/core/jobs"
import { zoneCaps } from "@/lib/core/pros"
import { PricingError, priceItems } from "@/lib/core/pricing"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { nextDays } from "@/lib/time"
import { saveSubmission, schemas, ValidationError } from "./store"

// Placing a booking. With the core engine on, the server prices every line from the catalogue,
// checks the arrival window still has room, then saves the submission (kept as the email copy and
// the fallback record) and creates the booking. Without the core it is a plain submission, as
// before. Used by the website checkout and by the Concierge.

type BookingData = z.infer<typeof schemas.booking>

export async function placeBooking(raw: unknown, attribution: Record<string, unknown> = {}, page?: string): Promise<{ id: string; total?: number }> {
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

  const { id } = await saveSubmission("booking", d, attribution, page)
  try {
    const job = await createBooking(db, { id, ...d }, cat, { referralOff: settings.referral.friendOff })
    return { id, total: job.total }
  } catch (e) {
    // The submission is safe; the ops catch-up (syncJobs) imports it on the next read.
    console.error(`[booking] ${id}: core write failed`, e)
    return { id }
  }
}

const slotBody = z.object({
  area: z.string().max(60),
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
  return slots(nextDays(7).map((d) => d.iso), jobs, pros, need, cat, settings.policy.leadHours, { zoneCaps: caps })
}
