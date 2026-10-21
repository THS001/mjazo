import "server-only"
import type { Db } from "./db"

// Who did what: every staff action in mission control, with the person's email (or a pro's id,
// "customer" or "system"). Append-only from the app's side: nothing here edits or deletes a row.

export type AuditRow = { id: number; at: string; actor: string; action: string; target: string | null; detail: string | null }

export async function writeAudit(db: Db, a: { actor: string; action: string; target?: string; detail?: string }) {
  await db.query("insert into audit_log (actor, action, target, detail) values ($1, $2, $3, $4::jsonb)", [a.actor.slice(0, 200), a.action.slice(0, 200), a.target?.slice(0, 200) ?? null, a.detail ? JSON.stringify({ text: a.detail.slice(0, 500) }) : null])
}

export type AuditFilter = { actor?: string; q?: string; before?: number; limit?: number }

/** Newest first; `before` pages back by id; `q` matches the action, target or detail. */
export async function listAudit(db: Db, f: AuditFilter = {}): Promise<AuditRow[]> {
  const where: string[] = []
  const vals: unknown[] = []
  if (f.actor) {
    vals.push(f.actor.toLowerCase())
    where.push(`lower(actor) = $${vals.length}`)
  }
  if (f.q) {
    vals.push(`%${f.q.toLowerCase()}%`)
    where.push(`(lower(action) like $${vals.length} or lower(coalesce(target, '')) like $${vals.length} or lower(coalesce(detail->>'text', '')) like $${vals.length})`)
  }
  if (f.before) {
    vals.push(f.before)
    where.push(`id < $${vals.length}`)
  }
  vals.push(Math.min(Math.max(f.limit ?? 100, 1), 500))
  const rows = await db.query<{ id: number; at: string; actor: string; action: string; target: string | null; detail: { text?: string } | null }>(
    `select id, at, actor, action, target, detail from audit_log ${where.length ? `where ${where.join(" and ")}` : ""} order by id desc limit $${vals.length}`,
    vals,
  )
  return rows.map((r) => ({ ...r, detail: r.detail?.text ?? null }))
}

/** The people (actors) seen in the log, most active first. */
export const auditActors = async (db: Db) => (await db.query<{ actor: string }>("select actor from audit_log group by actor order by count(*) desc limit 50")).map((r) => r.actor)
