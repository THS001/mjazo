import "server-only"
import type { Db } from "./db"

// The event outbox. Every change worth reacting to is written here in the same transaction as
// the change itself; the automation engine (notifications, auto-assign, payouts) reads it later.

export type EventRef = { bookingId?: string; proId?: string; customerId?: string }

export async function emit(db: Db, type: string, ref: EventRef = {}, data: Record<string, unknown> = {}) {
  await db.query("insert into events (type, booking_id, pro_id, customer_id, data) values ($1, $2, $3, $4, $5::jsonb)", [type, ref.bookingId ?? null, ref.proId ?? null, ref.customerId ?? null, JSON.stringify(data)])
}

export type CoreEvent = { id: number; at: string; type: string; booking_id: string | null; pro_id: string | null; customer_id: string | null; data: Record<string, unknown> }

/** The oldest events not yet processed. */
export const pendingEvents = (db: Db, limit = 100) => db.query<CoreEvent>("select * from events where processed_at is null order by id limit $1", [limit])

export const markProcessed = (db: Db, ids: number[]) => (ids.length ? db.query("update events set processed_at = now() where id = any($1::int[])", [ids]) : Promise.resolve([]))
