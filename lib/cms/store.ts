import "server-only"
import { promises as fs } from "fs"
import path from "path"
import { db } from "@/lib/server/store"

// CMS storage: Supabase tables from supabase/migrations/0004_cms.sql when configured; otherwise
// JSON files in .data/cms (local development only; on Vercel without Supabase the CMS is read-only
// and the site shows its built-in content).

export type Status = "draft" | "published" | "scheduled" | "archived"
export type Data = Record<string, unknown>
export type EntryRow = {
  type: string
  id: string
  status: Status
  draft: Data | null
  published: Data | null
  review: boolean
  position: number | null
  version: number
  publish_at: string | null
  updated_by: string | null
  updated_at: string
  published_by: string | null
  published_at: string | null
}
export type VersionRow = { seq: number; type: string; entry_id: string; version: number; kind: "saved" | "published" | "restored" | "imported"; data: Data; note: string | null; user_id: string | null; user_name: string | null; created_at: string }
export type AuditRow = { seq: number; at: string; user_id: string | null; user_name: string | null; action: string; type: string | null; entry_id: string | null; title: string | null; detail: string | null }

export class ConflictError extends Error {
  constructor(public current: EntryRow | null) {
    super("This item was changed by someone else since you opened it.")
  }
}

/** Whether edits can be saved: Supabase, or local files outside Vercel. */
export const writable = () => Boolean(db) || !process.env.VERCEL
export const backend = () => (db ? "supabase" : process.env.VERCEL ? "none" : "local")

// ---------------------------------------------------------------------------
// Local JSON fallback (development)
// ---------------------------------------------------------------------------

type Local = { entries: Record<string, EntryRow>; versions: VersionRow[]; audit: AuditRow[] }
const FILE = path.join(process.cwd(), ".data", "cms", "cms.json")
let chain: Promise<unknown> = Promise.resolve()

async function readLocal(): Promise<Local> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { entries: {}, versions: [], audit: [] }
    throw e
  }
}

/** Serialised read-modify-write of the local file. */
function local<T>(fn: (s: Local) => T | Promise<T>, write = false): Promise<T> {
  const run = chain.then(async () => {
    const s = await readLocal()
    const out = await fn(s)
    if (write) {
      await fs.mkdir(path.dirname(FILE), { recursive: true })
      const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`
      await fs.writeFile(tmp, JSON.stringify(s))
      await fs.rename(tmp, FILE)
    }
    return out
  })
  chain = run.catch(() => {})
  return run
}
const key = (type: string, id: string) => `${type}/${id}`

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export async function listRows(type: string): Promise<EntryRow[]> {
  if (db) {
    const { data, error } = await db.from("cms_entries").select("*").eq("type", type).order("position", { ascending: true, nullsFirst: false })
    if (error) throw error
    return data as EntryRow[]
  }
  if (process.env.VERCEL) return []
  return local((s) => Object.values(s.entries).filter((r) => r.type === type))
}

export async function getRow(type: string, id: string): Promise<EntryRow | null> {
  if (db) {
    const { data, error } = await db.from("cms_entries").select("*").eq("type", type).eq("id", id).maybeSingle()
    if (error) throw error
    return (data as EntryRow) ?? null
  }
  if (process.env.VERCEL) return null
  return local((s) => s.entries[key(type, id)] ?? null)
}

/**
 * Insert or update one entry. `expected` is the version the editor loaded (0 = the entry must not
 * exist yet); a mismatch throws ConflictError so nobody silently overwrites someone else's work.
 */
export async function writeRow(row: Omit<EntryRow, "version" | "updated_at">, expected: number): Promise<EntryRow> {
  const now = new Date().toISOString()
  const next = { ...row, version: expected + 1, updated_at: now }
  if (db) {
    if (expected === 0) {
      const { data, error } = await db.from("cms_entries").insert(next).select().single()
      if (error?.code === "23505") throw new ConflictError(await getRow(row.type, row.id))
      if (error) throw error
      return data as EntryRow
    }
    const { data, error } = await db.from("cms_entries").update(next).eq("type", row.type).eq("id", row.id).eq("version", expected).select()
    if (error) throw error
    if (!data?.length) throw new ConflictError(await getRow(row.type, row.id))
    return data[0] as EntryRow
  }
  if (process.env.VERCEL) throw new Error("The CMS needs Supabase to save changes on Vercel.")
  return local((s) => {
    const cur = s.entries[key(row.type, row.id)]
    if ((cur?.version ?? 0) !== expected) throw new ConflictError(cur ?? null)
    s.entries[key(row.type, row.id)] = next
    return next
  }, true)
}

/** Set positions for a whole collection after drag-to-reorder (rows that don't exist yet are created by the caller). */
export async function setPositions(type: string, order: { id: string; position: number }[]) {
  if (db) {
    for (const o of order) {
      const { error } = await db.from("cms_entries").update({ position: o.position }).eq("type", type).eq("id", o.id)
      if (error) throw error
    }
    return
  }
  await local((s) => {
    for (const o of order) {
      const r = s.entries[key(type, o.id)]
      if (r) r.position = o.position
    }
  }, true)
}

export async function deleteRow(type: string, id: string) {
  if (db) {
    const { error } = await db.from("cms_entries").delete().eq("type", type).eq("id", id)
    if (error) throw error
    return
  }
  await local((s) => {
    delete s.entries[key(type, id)]
  }, true)
}

/** Entries whose scheduled time has passed. */
export async function dueScheduled(now = new Date()): Promise<EntryRow[]> {
  if (db) {
    const { data, error } = await db.from("cms_entries").select("*").eq("status", "scheduled").lte("publish_at", now.toISOString())
    if (error) throw error
    return data as EntryRow[]
  }
  if (process.env.VERCEL) return []
  return local((s) => Object.values(s.entries).filter((r) => r.status === "scheduled" && r.publish_at && r.publish_at <= now.toISOString()))
}

/** Every entry (dashboard and export). */
export async function allRows(): Promise<EntryRow[]> {
  if (db) {
    const out: EntryRow[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("cms_entries").select("*").order("type").order("id").range(from, from + 999)
      if (error) throw error
      out.push(...(data as EntryRow[]))
      if (!data || data.length < 1000) return out
    }
  }
  if (process.env.VERCEL) return []
  return local((s) => Object.values(s.entries))
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export async function addVersion(v: Omit<VersionRow, "seq" | "created_at">) {
  if (db) {
    const { error } = await db.from("cms_versions").insert(v)
    if (error) throw error
    return
  }
  await local((s) => {
    s.versions.push({ ...v, seq: (s.versions.at(-1)?.seq ?? 0) + 1, created_at: new Date().toISOString() })
  }, true)
}

export async function listVersions(type: string, id: string, limit = 50): Promise<Omit<VersionRow, "data">[]> {
  if (db) {
    const { data, error } = await db.from("cms_versions").select("seq,type,entry_id,version,kind,note,user_id,user_name,created_at").eq("type", type).eq("entry_id", id).order("seq", { ascending: false }).limit(limit)
    if (error) throw error
    return data as Omit<VersionRow, "data">[]
  }
  if (process.env.VERCEL) return []
  return local((s) =>
    s.versions
      .filter((v) => v.type === type && v.entry_id === id)
      .reverse()
      .slice(0, limit)
      .map(({ data, ...rest }) => rest),
  )
}

export async function getVersion(seq: number): Promise<VersionRow | null> {
  if (db) {
    const { data, error } = await db.from("cms_versions").select("*").eq("seq", seq).maybeSingle()
    if (error) throw error
    return (data as VersionRow) ?? null
  }
  return local((s) => s.versions.find((v) => v.seq === seq) ?? null)
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function addAudit(a: Omit<AuditRow, "seq" | "at">) {
  try {
    if (db) {
      const { error } = await db.from("cms_audit").insert({ ...a, detail: a.detail?.slice(0, 500) ?? null })
      if (error) throw error
      return
    }
    if (process.env.VERCEL) return
    await local((s) => {
      s.audit.push({ ...a, seq: (s.audit.at(-1)?.seq ?? 0) + 1, at: new Date().toISOString() })
      if (s.audit.length > 5000) s.audit.splice(0, s.audit.length - 5000)
    }, true)
  } catch (e) {
    console.error("[cms audit] failed", e)
  }
}

export async function listAudit(opts: { limit?: number; type?: string; entryId?: string; userId?: string } = {}): Promise<AuditRow[]> {
  const limit = opts.limit ?? 100
  if (db) {
    let q = db.from("cms_audit").select("*").order("seq", { ascending: false }).limit(limit)
    if (opts.type) q = q.eq("type", opts.type)
    if (opts.entryId) q = q.eq("entry_id", opts.entryId)
    if (opts.userId) q = q.eq("user_id", opts.userId)
    const { data, error } = await q
    if (error) throw error
    return data as AuditRow[]
  }
  if (process.env.VERCEL) return []
  return local((s) =>
    s.audit
      .filter((a) => (!opts.type || a.type === opts.type) && (!opts.entryId || a.entry_id === opts.entryId) && (!opts.userId || a.user_id === opts.userId))
      .reverse()
      .slice(0, limit),
  )
}
