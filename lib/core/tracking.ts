import "server-only"
import type { Db } from "./db"
import { InputError } from "./errors"
import { AREA_CENTERS, kmBetween } from "@/lib/geo"

// Live tracking (migration 0011): while a pro is on her way to a visit, Mjazo Pro (open on her
// phone) sends her location about once a minute. Only the latest point is kept, only for that
// visit, and it's deleted as soon as the visit moves on (check-in, or anything else: mutateJob).
// The customer sees how far away she is and about how long; ops see it on the board.

export type LivePoint = { lat: number; lng: number; accuracy: number | null; at: string }
export type Live = LivePoint & { km: number | null; minutes: number | null }

/** Points older than this aren't shown (her phone went quiet: the app closed, no signal). */
const FRESH_MS = 10 * 60_000

/**
 * Whether migration 0011 has run. Until it has, tracking is simply off: nothing else (a check-in,
 * the bookings pages) may fail because of it. Remembered once it's there.
 */
let ready = false
export async function trackingReady(db: Db) {
  if (ready) return true
  ready = Boolean((await db.one<{ ok: boolean }>("select to_regclass('public.visit_locations') is not null as ok"))?.ok)
  return ready
}

/** Her latest point, for her own visit that's on the way. False when the visit isn't on the way any more. */
export async function saveLocation(db: Db, p: { bookingId: string; proId: string; lat: number; lng: number; accuracy?: number | null }) {
  const b = await db.one<{ pro_id: string | null; status: string }>("select pro_id, status from bookings where id = $1", [p.bookingId])
  if (!b || b.pro_id !== p.proId) throw new InputError("This visit isn't yours")
  if (!(await trackingReady(db))) return false
  if (b.status !== "en_route") {
    await clearLocation(db, p.bookingId)
    return false
  }
  await db.query(
    `insert into visit_locations (booking_id, pro_id, lat, lng, accuracy, at) values ($1, $2, $3, $4, $5, now())
     on conflict (booking_id) do update set pro_id = excluded.pro_id, lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy, at = now()`,
    [p.bookingId, p.proId, p.lat, p.lng, p.accuracy ?? null],
  )
  return true
}

export async function clearLocation(db: Db, bookingId: string) {
  if (await trackingReady(db)) await db.query("delete from visit_locations where booking_id = $1", [bookingId])
}

/** Where she is now (a fresh point) for each visit that's on the way. */
export async function livePoints(db: Db, bookingIds: string[], now = new Date()): Promise<Map<string, LivePoint>> {
  if (!bookingIds.length || !(await trackingReady(db))) return new Map()
  const rows = await db.query<{ booking_id: string; lat: number; lng: number; accuracy: number | null; at: string }>(
    `select l.booking_id, l.lat, l.lng, l.accuracy, l.at from visit_locations l join bookings b on b.id = l.booking_id
     where l.booking_id = any($1::text[]) and b.status = 'en_route' and l.at > $2`,
    [bookingIds, new Date(now.getTime() - FRESH_MS).toISOString()],
  )
  return new Map(rows.map((r) => [r.booking_id, { lat: r.lat, lng: r.lng, accuracy: r.accuracy, at: new Date(r.at).toISOString() }]))
}

/**
 * How far she is from the visit (straight line) and about how long that takes by road in Karachi
 * (the distance × 1.35 for roads, at 22 km/h). Uses the customer's map pin, else the area's centre.
 */
export function withEta(p: LivePoint, to: { lat?: number | null; lng?: number | null; area: string }): Live {
  const dest: [number, number] | null = to.lat != null && to.lng != null ? [to.lat, to.lng] : (AREA_CENTERS[to.area] ?? null)
  if (!dest) return { ...p, km: null, minutes: null }
  const km = kmBetween([p.lat, p.lng], dest)
  return { ...p, km: Math.round(km * 10) / 10, minutes: Math.max(2, Math.round(((km * 1.35) / 22) * 60)) }
}
