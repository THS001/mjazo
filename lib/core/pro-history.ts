import "server-only"
import type { Db } from "./db"

// What a pro sees about her own record in the pro app: her ratings and her payouts. Read only.
// Customers stay anonymous here: a rating shows the day, the services and what was said.

export type ProRating = { bookingId: string; day: string; services: string[]; stars: number; tags: string[]; comment: string | null; at: string }

export async function proRatings(db: Db, proId: string, limit = 30) {
  const rows = await db.query<{ booking_id: string; day: string; stars: number; tags: string[]; comment: string | null; at: string; services: string[] }>(
    `select r.booking_id, b.day, r.stars, r.tags, r.comment, r.at,
       array(select i.name from booking_items i where i.booking_id = b.id order by i.position) as services
     from booking_ratings r join bookings b on b.id = r.booking_id
     where b.pro_id = $1 order by r.at desc limit $2`,
    [proId, limit],
  )
  const all = await db.one<{ n: number; avg: number | null; s1: number; s2: number; s3: number; s4: number; s5: number }>(
    `select count(*)::int as n, avg(r.stars)::float8 as avg,
       count(*) filter (where r.stars = 1)::int as s1, count(*) filter (where r.stars = 2)::int as s2, count(*) filter (where r.stars = 3)::int as s3,
       count(*) filter (where r.stars = 4)::int as s4, count(*) filter (where r.stars = 5)::int as s5
     from booking_ratings r join bookings b on b.id = r.booking_id where b.pro_id = $1`,
    [proId],
  )
  return {
    count: all?.n ?? 0,
    average: all?.avg ? Math.round(all.avg * 10) / 10 : null,
    stars: { 1: all?.s1 ?? 0, 2: all?.s2 ?? 0, 3: all?.s3 ?? 0, 4: all?.s4 ?? 0, 5: all?.s5 ?? 0 },
    recent: rows.map((r): ProRating => ({ bookingId: r.booking_id, day: r.day, services: r.services ?? [], stars: r.stars, tags: r.tags ?? [], comment: r.comment, at: r.at })),
  }
}

export type ProPayout = { id: string; periodStart: string; periodEnd: string; earned: number; cashHeld: number; netted: number; amount: number; status: "draft" | "approved" | "paid" | "cancelled"; reference: string | null; paidAt: string | null }

/** Her payouts, newest first. Drafts nobody has approved yet aren't shown; cancelled ones aren't either. */
export async function proPayouts(db: Db, proId: string, limit = 26): Promise<ProPayout[]> {
  const rows = await db.query<{ id: string; period_start: string; period_end: string; earned: number; cash_held: number; netted: number; amount: number; status: ProPayout["status"]; reference: string | null; paid_at: string | null }>(
    "select id, period_start, period_end, earned, cash_held, netted, amount, status, reference, paid_at from payouts where pro_id = $1 and status in ('approved', 'paid') order by period_end desc, id desc limit $2",
    [proId, limit],
  )
  return rows.map((r) => ({ id: r.id, periodStart: r.period_start, periodEnd: r.period_end, earned: r.earned, cashHeld: r.cash_held, netted: r.netted, amount: r.amount, status: r.status, reference: r.reference, paidAt: r.paid_at }))
}
