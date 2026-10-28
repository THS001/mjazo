import "server-only"
import type { Db } from "./db"
import { policy } from "./policy"
import { DEFAULT_COMMISSION, visitRate, type VisitRate } from "@/lib/ops/policy"

// A lower rate on regular customer–pro pairs (policy "pair_rate", mission control → Money →
// Policies). From a customer's 2nd visit with the same pro, Mjazo takes less, so she earns more by
// keeping her regulars on Mjazo. Completion posts the rate to the ledger; the pro app, the offer
// message and mission control show the same figure before the visit.

/**
 * How many visits each booking's customer has had with this pro before it: completed, within
 * `days` before its day. Booking id → count.
 */
export async function priorPairVisits(db: Db, items: { bookingId: string; proId: string }[], days: number): Promise<Map<string, number>> {
  if (!items.length) return new Map()
  const rows = await db.query<{ booking_id: string; n: number }>(
    `select q.booking_id, count(distinct p.id)::int as n
       from unnest($1::text[], $2::text[]) as q (booking_id, pro_id)
       join bookings b on b.id = q.booking_id
       left join bookings p on p.customer_id = b.customer_id and p.pro_id = q.pro_id and p.id <> b.id
         and p.status = 'completed' and p.day between b.day - $3::int and b.day
      group by q.booking_id`,
    [items.map((i) => i.bookingId), items.map((i) => i.proId), days],
  )
  return new Map(rows.map((r) => [r.booking_id, r.n]))
}

/** Mjazo's share of each visit by this pro: her own rate, or the regular-pair rate. Booking id → rate. */
export async function pairRates(db: Db, items: { bookingId: string; proId: string; proRate?: number | null }[]): Promise<Map<string, VisitRate>> {
  if (!items.length) return new Map()
  const p = await policy(db, "pair_rate")
  const prior = p.on ? await priorPairVisits(db, items, p.days) : new Map<string, number>()
  return new Map(items.map((i) => [i.bookingId, visitRate(i.proRate ?? DEFAULT_COMMISSION, prior.get(i.bookingId) ?? 0, p)]))
}
