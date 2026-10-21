import "server-only"
import type { Db } from "./db"
import { InputError } from "./errors"

// The requests inbox's state: how far the team has got with each enquiry (the enquiries
// themselves stay in the `submissions` table).

export const REQUEST_STATUSES = ["new", "contacted", "done", "declined"] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]
export type RequestState = { status: RequestStatus; note: string | null; handledBy: string | null; updatedAt: string }

export async function requestStates(db: Db, ids: string[]): Promise<Map<string, RequestState>> {
  if (!ids.length) return new Map()
  const rows = await db.query<{ submission_id: string; status: RequestStatus; note: string | null; handled_by: string | null; updated_at: string }>("select * from ops_requests where submission_id = any($1::text[])", [ids])
  return new Map(rows.map((r) => [r.submission_id, { status: r.status, note: r.note, handledBy: r.handled_by, updatedAt: r.updated_at }]))
}

export async function setRequestState(db: Db, id: string, s: { status: RequestStatus; note?: string }, by: string) {
  if (!REQUEST_STATUSES.includes(s.status)) throw new InputError("Unknown status")
  await db.query(
    `insert into ops_requests (submission_id, status, note, handled_by) values ($1, $2, $3, $4)
     on conflict (submission_id) do update set status = excluded.status, note = coalesce(excluded.note, ops_requests.note), handled_by = excluded.handled_by, updated_at = now()`,
    [id, s.status, s.note?.trim().slice(0, 500) || null, by],
  )
}
