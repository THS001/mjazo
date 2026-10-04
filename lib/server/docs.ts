import "server-only"
import { promises as fs } from "fs"
import path from "path"
import { db } from "./store"

// A tiny document store for ops data (jobs, pros, applications, complaints).
// Supabase table `ops_docs` (supabase/migrations/0003_ops.sql) when configured; otherwise JSON
// files in .data/ops locally (and /tmp on Vercel, which does not persist: connect Supabase).

export type Doc = { id: string }
const dir = () => (process.env.VERCEL ? "/tmp/ops" : path.join(process.cwd(), ".data", "ops"))
const file = (c: string) => path.join(dir(), `${c}.json`)
const PAGE = 1000 // Supabase returns at most 1000 rows per request

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const transient = (e: unknown) => ["EPERM", "EBUSY", "EACCES"].includes((e as NodeJS.ErrnoException).code ?? "")

/** Retry briefly on Windows file locks; anything else (or a lock that persists) is a real error. */
async function retry<T>(fn: () => Promise<T>) {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (!transient(e) || i >= 6) throw e
      await sleep(25 * (i + 1))
    }
  }
}

// Only a missing file means "empty". A failed read must never look empty, or the next write
// would replace the whole collection.
async function readLocal<T>(c: string): Promise<Record<string, T>> {
  try {
    return JSON.parse(await retry(() => fs.readFile(file(c), "utf8")))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw e
  }
}

async function writeLocal<T>(c: string, data: Record<string, T>) {
  await fs.mkdir(dir(), { recursive: true })
  const tmp = `${file(c)}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data))
  await retry(() => fs.rename(tmp, file(c)))
}

// Read-modify-write of a collection file is serialised per collection within this process.
const locks = new Map<string, Promise<unknown>>()
function withLock<T>(c: string, fn: () => Promise<T>): Promise<T> {
  const run = (locks.get(c) ?? Promise.resolve()).then(fn, fn)
  locks.set(c, run.catch(() => {}))
  return run
}

export async function all<T extends Doc>(c: string): Promise<T[]> {
  if (db) {
    const out: T[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from("ops_docs").select("data").eq("collection", c).order("id").range(from, from + PAGE - 1)
      if (error) throw error
      out.push(...(data ?? []).map((r) => r.data as T))
      if (!data || data.length < PAGE) return out
    }
  }
  return Object.values(await readLocal<T>(c))
}

export async function get<T extends Doc>(c: string, id: string): Promise<T | null> {
  if (db) {
    const { data, error } = await db.from("ops_docs").select("data").eq("collection", c).eq("id", id).maybeSingle()
    if (error) throw error
    return (data?.data as T) ?? null
  }
  return (await readLocal<T>(c))[id] ?? null
}

export async function putMany<T extends Doc>(c: string, docs: T[]) {
  if (!docs.length) return
  if (db) {
    const { error } = await db.from("ops_docs").upsert(docs.map((d) => ({ collection: c, id: d.id, data: d, updated_at: new Date().toISOString() })))
    if (error) throw error
    return
  }
  await withLock(c, async () => {
    const cur = await readLocal<T>(c)
    for (const d of docs) cur[d.id] = d
    await writeLocal(c, cur)
  })
}

export const put = <T extends Doc>(c: string, doc: T) => putMany(c, [doc])

export async function remove(c: string, id: string) {
  if (db) {
    const { error } = await db.from("ops_docs").delete().eq("collection", c).eq("id", id)
    if (error) throw error
    return
  }
  await withLock(c, async () => {
    const cur = await readLocal<Doc>(c)
    if (!(id in cur)) return
    delete cur[id]
    await writeLocal(c, cur)
  })
}

/**
 * Atomic read-modify-write of one document: `fn` gets the latest copy and edits it in place (it may
 * throw to abort). Supabase uses optimistic concurrency on `updated_at`; locally a per-collection
 * lock. Returns null when the document doesn't exist.
 */
export async function mutate<T extends Doc>(c: string, id: string, fn: (doc: T) => void): Promise<T | null> {
  if (db) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: row, error } = await db.from("ops_docs").select("data, updated_at").eq("collection", c).eq("id", id).maybeSingle()
      if (error) throw error
      if (!row) return null
      const doc = row.data as T
      fn(doc)
      const { data: done, error: e2 } = await db.from("ops_docs").update({ data: doc, updated_at: new Date().toISOString() }).eq("collection", c).eq("id", id).eq("updated_at", row.updated_at).select("id")
      if (e2) throw e2
      if (done?.length) return doc
      await sleep(40 * (attempt + 1)) // someone else wrote first: re-read and re-apply
    }
    throw new Error(`Busy updating ${c}/${id}. Please try again.`)
  }
  return withLock(c, async () => {
    const cur = await readLocal<T>(c)
    const doc = cur[id]
    if (!doc) return null
    fn(doc)
    await writeLocal(c, cur)
    return doc
  })
}

/** Insert only documents that don't exist yet, so a concurrent sync never overwrites newer edits. */
export async function insertNew<T extends Doc>(c: string, docs: T[]) {
  if (!docs.length) return
  if (db) {
    const rows = docs.map((d) => ({ collection: c, id: d.id, data: d, updated_at: new Date().toISOString() }))
    const { error } = await db.from("ops_docs").upsert(rows, { onConflict: "collection,id", ignoreDuplicates: true })
    if (error) throw error
    return
  }
  await withLock(c, async () => {
    const cur = await readLocal<T>(c)
    for (const d of docs) if (!cur[d.id]) cur[d.id] = d
    await writeLocal(c, cur)
  })
}
