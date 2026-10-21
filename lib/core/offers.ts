import "server-only"
import type { Db } from "./db"
import { writeAudit } from "./audit"
import { InputError } from "./errors"
import { emit } from "./events"
import { mutateJob } from "./jobs"
import { coreId } from "./phone"
import { WINDOW_HOURS, WINDOW_LABELS } from "@/lib/time"

// Job offers: mission control offers an unassigned visit to one pro, and she accepts it (it
// becomes hers, as if ops had assigned it) or declines it (it stays unassigned, with her reason
// on the timeline). An offer is open until she answers, ops withdraw it or assign the visit
// directly, or it expires: two hours after it was made, and never later than an hour before the
// arrival window starts. Expiry is applied whenever offers are read or answered (no timer).

export type OfferStatus = "pending" | "accepted" | "declined" | "expired" | "withdrawn"
export type Offer = { id: string; bookingId: string; proId: string; status: OfferStatus; offeredBy: string; offeredAt: string; expiresAt: string; respondedAt: string | null; reason: string | null }

/** How long an offer stays open, and how close to the arrival window it must close. */
export const OFFER_MINUTES = 120
export const OFFER_LEAD_MINUTES = 60
const MIN = 60_000

type OfferRow = { id: string; booking_id: string; pro_id: string; status: OfferStatus; offered_by: string; offered_at: string; expires_at: string; responded_at: string | null; reason: string | null }
const toOffer = (r: OfferRow): Offer => ({ id: r.id, bookingId: r.booking_id, proId: r.pro_id, status: r.status, offeredBy: r.offered_by, offeredAt: r.offered_at, expiresAt: r.expires_at, respondedAt: r.responded_at, reason: r.reason })

/** When a window starts (Karachi time), e.g. 2026-10-22 "3–5 pm" → 15:00 +05:00. */
export function windowStart(day: string, window: string) {
  const hour = WINDOW_HOURS[WINDOW_LABELS.indexOf(window)]
  return hour === undefined ? null : new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+05:00`)
}

/** When an offer made `now` for this visit closes; null when it's too close to the visit to offer. */
export function offerExpiry(now: Date, day: string, window: string): Date | null {
  const start = windowStart(day, window)
  const latest = start ? start.getTime() - OFFER_LEAD_MINUTES * MIN : Infinity
  const expires = Math.min(now.getTime() + OFFER_MINUTES * MIN, latest)
  return expires - now.getTime() < 10 * MIN ? null : new Date(expires)
}

/** Marks open offers whose time is up as expired. */
export async function expireOffers(db: Db, now = new Date()) {
  const rows = await db.query<{ id: string; booking_id: string; pro_id: string }>("update job_offers set status = 'expired', responded_at = $1 where status = 'pending' and expires_at <= $1 returning id, booking_id, pro_id", [now.toISOString()])
  for (const r of rows) await emit(db, "offer.expired", { bookingId: r.booking_id, proId: r.pro_id }, { offerId: r.id })
  return rows.length
}

type Visit = { id: string; day: string; arrival_window: string; status: string; pro_id: string | null }

/**
 * Why this pro can't take this visit (paused, a day off, a visit in the same window, a full day),
 * or null. `self`: worded for the pro herself rather than for ops.
 */
async function takeProblem(db: Db, proId: string, v: Visit, self = false): Promise<string | null> {
  const pro = await db.one<{ name: string; status: string; daily_cap: number }>("select name, status, daily_cap from pros where id = $1", [proId])
  if (!pro) return "Pro not found"
  if (pro.status !== "active") return self ? "Your account is paused" : `${pro.name} is paused`
  if (await db.one("select 1 from pro_time_off where pro_id = $1 and day = $2", [proId, v.day])) return self ? "You have that day off" : `${pro.name} has that day off`
  const busy = await db.query<{ arrival_window: string }>("select arrival_window from bookings where pro_id = $1 and day = $2 and id <> $3 and status not in ('cancelled', 'no_show')", [proId, v.day, v.id])
  if (busy.some((b) => b.arrival_window === v.arrival_window)) return self ? "You already have a visit in that window" : `${pro.name} already has a visit in that window`
  if (busy.length >= pro.daily_cap) return self ? `You're full that day (${pro.daily_cap} visits)` : `${pro.name} is full that day (${pro.daily_cap} visits)`
  return null
}

const lockVisit = (db: Db, bookingId: string) => db.one<Visit>("select id, day, arrival_window, status, pro_id from bookings where id = $1 for update", [bookingId])

/**
 * Offers an unassigned visit to a pro. Another open offer for the same visit is withdrawn first
 * (one pro at a time).
 */
export async function offerJob(db: Db, o: { bookingId: string; proId: string; by: string; now?: Date }): Promise<Offer> {
  const now = o.now ?? new Date()
  return db.tx(async (t) => {
    await expireOffers(t, now)
    const v = await lockVisit(t, o.bookingId)
    if (!v) throw new InputError("Booking not found")
    if (v.status !== "new" || v.pro_id) throw new InputError("Only an unassigned visit can be offered")
    const expires = offerExpiry(now, v.day, v.arrival_window)
    if (!expires) throw new InputError("It's too close to the visit to wait for an answer: assign it directly")
    const problem = await takeProblem(t, o.proId, v)
    if (problem) throw new InputError(problem)
    const open = await t.one<OfferRow>("select * from job_offers where booking_id = $1 and status = 'pending'", [o.bookingId])
    if (open?.pro_id === o.proId) throw new InputError("It's already offered to her")
    if (open) await closeOffer(t, open, "withdrawn", now, "Offered to someone else")
    const pro = (await t.one<{ name: string }>("select name from pros where id = $1", [o.proId]))!
    const row = await t.one<OfferRow>(
      "insert into job_offers (id, booking_id, pro_id, offered_by, offered_at, expires_at) values ($1, $2, $3, $4, $5, $6) returning *",
      [coreId("OF"), o.bookingId, o.proId, o.by, now.toISOString(), expires.toISOString()],
    )
    const until = expires.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })
    await mutateJob(t, o.bookingId, (j) => void j.events.push({ type: "note", at: now.toISOString(), by: "ops", actor: o.by, note: `Offered to ${pro.name} (open until ${until})` }))
    await emit(t, "offer.made", { bookingId: o.bookingId, proId: o.proId }, { offerId: row!.id, expiresAt: row!.expires_at })
    await writeAudit(t, { actor: o.by, action: "offered a visit", target: o.bookingId, detail: `${row!.id} to ${o.proId}` })
    return toOffer(row!)
  })
}

async function closeOffer(db: Db, r: OfferRow, status: OfferStatus, now: Date, reason?: string) {
  await db.query("update job_offers set status = $2, responded_at = $3, reason = $4 where id = $1", [r.id, status, now.toISOString(), reason?.trim().slice(0, 300) || null])
  await emit(db, `offer.${status}`, { bookingId: r.booking_id, proId: r.pro_id }, { offerId: r.id, ...(reason ? { reason } : {}) })
}

/**
 * The pro answers an offer. Accepting assigns the visit to her (refused if she can't take it after
 * all); declining leaves it unassigned with her reason on the timeline. An offer that has expired,
 * or whose visit ops have meanwhile given to someone else, comes back closed ("expired" or
 * "withdrawn") instead: that close is kept, so it isn't thrown.
 */
export async function answerOffer(db: Db, a: { offerId: string; proId: string; accept: boolean; reason?: string; now?: Date }): Promise<Offer> {
  const now = a.now ?? new Date()
  return db.tx(async (t) => {
    const r = await t.one<OfferRow>("select * from job_offers where id = $1 for update", [a.offerId])
    if (!r || r.pro_id !== a.proId) throw new InputError("Offer not found")
    const closed = async (status: OfferStatus, reason?: string) => {
      await closeOffer(t, r, status, now, reason)
      return { ...toOffer(r), status, respondedAt: now.toISOString(), reason: reason ?? null }
    }
    if (r.status === "pending" && Date.parse(r.expires_at) <= now.getTime()) return closed("expired")
    if (r.status !== "pending") throw new InputError(`This offer was already ${r.status}`)
    const v = (await lockVisit(t, r.booking_id))!
    if (v.status !== "new" || v.pro_id) return closed("withdrawn", "The visit was given to someone else")
    const pro = (await t.one<{ name: string }>("select name from pros where id = $1", [a.proId]))!
    if (a.accept) {
      const problem = await takeProblem(t, a.proId, v, true)
      if (problem) throw new InputError(problem)
      await mutateJob(t, r.booking_id, (j) => {
        j.proId = a.proId
        j.status = "assigned"
        j.events.push({ type: "assigned", at: now.toISOString(), by: "pro", actor: a.proId, note: a.proId })
      })
      await closeOffer(t, r, "accepted", now)
    } else {
      const reason = a.reason?.trim()
      await mutateJob(t, r.booking_id, (j) => void j.events.push({ type: "note", at: now.toISOString(), by: "pro", actor: a.proId, note: `${pro.name} declined the offer${reason ? `: ${reason.slice(0, 200)}` : ""}` }))
      await closeOffer(t, r, "declined", now, reason)
    }
    await writeAudit(t, { actor: `pro:${a.proId}`, action: a.accept ? "accepted a visit" : "declined a visit", target: r.booking_id, detail: `${r.id}${!a.accept && a.reason?.trim() ? `: ${a.reason.trim().slice(0, 200)}` : ""}` })
    return { ...toOffer(r), status: a.accept ? "accepted" : "declined", respondedAt: now.toISOString(), reason: a.accept ? null : a.reason?.trim() || null }
  })
}

/** Withdraws a visit's open offer (ops assigned it directly, cancelled it, or changed their mind). */
export async function withdrawOffers(db: Db, bookingId: string, by: string, reason = "Withdrawn by ops", now = new Date()) {
  return db.tx(async (t) => {
    const open = await t.query<OfferRow>("select * from job_offers where booking_id = $1 and status = 'pending' for update", [bookingId])
    for (const r of open) await closeOffer(t, r, "withdrawn", now, reason)
    if (open.length) await writeAudit(t, { actor: by, action: "withdrew an offer", target: bookingId, detail: open.map((r) => `${r.id} (${r.pro_id})`).join(", ") })
    return open.length
  })
}

/** Offers, newest first (expired ones marked first). */
export async function listOffers(db: Db, f: { proId?: string; bookingIds?: string[]; status?: OfferStatus; since?: string; limit?: number } = {}): Promise<Offer[]> {
  await expireOffers(db)
  const where: string[] = []
  const vals: unknown[] = []
  const add = (sql: string, v: unknown) => {
    vals.push(v)
    where.push(sql.replace("?", `$${vals.length}`))
  }
  if (f.proId) add("pro_id = ?", f.proId)
  if (f.bookingIds) add("booking_id = any(?::text[])", f.bookingIds)
  if (f.status) add("status = ?", f.status)
  if (f.since) add("offered_at >= ?", f.since)
  vals.push(f.limit ?? 100)
  const rows = await db.query<OfferRow>(`select * from job_offers ${where.length ? `where ${where.join(" and ")}` : ""} order by offered_at desc limit $${vals.length}`, vals)
  return rows.map(toOffer)
}
