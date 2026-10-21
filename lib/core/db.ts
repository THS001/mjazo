import "server-only"
import { promises as fs } from "fs"
import path from "path"

// The core engine's database. One small interface over two drivers, so the same SQL runs
// everywhere:
// - production: Postgres (Supabase) through `pg`, using DATABASE_URL (the transaction pooler);
// - local development: PGlite, an embedded Postgres kept in .data/pglite (no Supabase needed);
// - tests: an in-memory PGlite per test file (lib/core/test-db.ts).
// Without DATABASE_URL in production the core is off and the site keeps its older paths.

export type Row = Record<string, unknown>

export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>
  /** The first row, or null. */
  one<T = Row>(text: string, params?: unknown[]): Promise<T | null>
  /** Runs `fn` in a transaction; inside a transaction it simply runs `fn` (no nesting). */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>
}

export type CoreMode = "postgres" | "pglite" | "off"

export function coreMode(): CoreMode {
  if (override !== undefined) return override ? "pglite" : "off"
  if (process.env.DATABASE_URL) return "postgres"
  if (process.env.NODE_ENV !== "production" && process.env.CORE_DB !== "off") return "pglite"
  return "off"
}

export const coreEnabled = () => coreMode() !== "off"

/** Postgres prints timestamptz as "2026-10-21 08:00:00.12+00"; everything in the core uses ISO strings. */
export function isoTimestamp(v: string) {
  let s = v.replace(" ", "T")
  if (/[+-]\d\d$/.test(s)) s += ":00"
  return new Date(s).toISOString()
}

// Shared value parsing: dates stay "YYYY-MM-DD", timestamps become ISO strings, and int8/numeric
// become numbers (all amounts are whole PKR, far below 2^53).
const DATE = 1082
const TIMESTAMPTZ = 1184
const TIMESTAMP = 1114
const INT8 = 20
const NUMERIC = 1700
const PARSERS: Record<number, (v: string) => unknown> = {
  [DATE]: (v) => v,
  [TIMESTAMPTZ]: isoTimestamp,
  [TIMESTAMP]: (v) => v,
  [INT8]: (v) => Number(v),
  [NUMERIC]: (v) => Number(v),
}

type Exec = (text: string, params?: unknown[]) => Promise<Row[]>

function wrap(exec: Exec, tx: Db["tx"]): Db {
  const db: Db = {
    query: (text, params) => exec(text, params) as Promise<never[]>,
    one: async (text, params) => ((await exec(text, params))[0] as never) ?? null,
    tx,
  }
  return db
}

// ---------------------------------------------------------------------------
// Postgres (production)
// ---------------------------------------------------------------------------

type PgPool = import("pg").Pool
let pool: PgPool | null = null

async function postgres(): Promise<Db> {
  if (!pool) {
    const pg = await import("pg")
    for (const [oid, fn] of Object.entries(PARSERS)) pg.types.setTypeParser(Number(oid), fn)
    // Supabase signs its database certificate with its own root CA, which isn't in Node's store.
    // With DATABASE_CA_CERT (Supabase → Database settings → SSL → download the certificate) the
    // server is verified; without it the connection is still encrypted but not verified.
    const url = new URL(process.env.DATABASE_URL!)
    url.searchParams.delete("sslmode")
    const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n")
    if (!ca) console.warn("[core/db] DATABASE_CA_CERT not set: the database connection is encrypted but the server isn't verified")
    const ssl = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }
    pool = new pg.Pool({ connectionString: url.toString(), ssl, max: 3, idleTimeoutMillis: 10_000 })
    pool.on("error", (e) => console.error("[core/db] idle client error", e))
  }
  const p = pool
  const exec: Exec = async (text, params) => (await p.query(text, params as unknown[])).rows
  return wrap(exec, async (fn) => {
    const client = await p.connect()
    try {
      await client.query("begin")
      const inner: Exec = async (text, params) => (await client.query(text, params as unknown[])).rows
      const txDb: Db = wrap(inner, (f) => f(txDb))
      const out = await fn(txDb)
      await client.query("commit")
      return out
    } catch (e) {
      await client.query("rollback").catch(() => {})
      throw e
    } finally {
      client.release()
    }
  })
}

// ---------------------------------------------------------------------------
// PGlite (local development and tests)
// ---------------------------------------------------------------------------

type Lite = import("@electric-sql/pglite").PGlite

/** The core migrations: 0005 and later (0001–0004 belong to Supabase's own features). */
export async function coreMigrations(): Promise<{ name: string; sql: string }[]> {
  const dir = path.join(process.cwd(), "supabase", "migrations")
  const files = (await fs.readdir(dir)).filter((f) => /^\d{4}_.*\.sql$/.test(f) && Number(f.slice(0, 4)) >= 5).sort()
  return Promise.all(files.map(async (name) => ({ name, sql: await fs.readFile(path.join(dir, name), "utf8") })))
}

/** Opens a PGlite database (in memory when `dataDir` is omitted) with the core schema applied. */
export async function openLite(dataDir?: string): Promise<Db & { close(): Promise<void> }> {
  const { PGlite } = await import("@electric-sql/pglite")
  // One options object: PGlite ignores a second argument when the first isn't a path.
  const lite: Lite = new PGlite({ dataDir, parsers: PARSERS })
  await lite.waitReady
  await lite.exec("create table if not exists core_migrations (name text primary key, at timestamptz not null default now())")
  const done = new Set((await lite.query<{ name: string }>("select name from core_migrations")).rows.map((r) => r.name))
  for (const m of await coreMigrations()) {
    if (done.has(m.name)) continue
    await lite.transaction(async (tx) => {
      await tx.exec(m.sql)
      await tx.query("insert into core_migrations (name) values ($1)", [m.name])
    })
  }
  // PGlite runs one statement at a time; queue transactions so they never interleave.
  let queue: Promise<unknown> = Promise.resolve()
  const exec: Exec = async (text, params) => (await lite.query<Row>(text, params as unknown[])).rows
  const db = wrap(exec, (fn) => {
    const run = queue.then(() =>
      lite.transaction(async (t) => {
        const inner: Exec = async (text, params) => (await t.query<Row>(text, params as unknown[])).rows
        const txDb: Db = wrap(inner, (f) => f(txDb))
        return fn(txDb)
      }),
    )
    queue = run.catch(() => {})
    return run
  })
  return Object.assign(db, { close: () => lite.close() })
}

// ---------------------------------------------------------------------------
// The shared handle
// ---------------------------------------------------------------------------

// One handle per process, kept on globalThis: the dev server re-runs modules after each edit, and
// a second PGlite opened on the same folder splits the local data in two (and can corrupt it).
const shared = globalThis as typeof globalThis & { __mjazoCore?: Promise<Db> | null }
let override: Db | null | undefined

/** The core database, or null when the core is off (production without DATABASE_URL). */
export async function core(): Promise<Db | null> {
  if (override !== undefined) return override
  const mode = coreMode()
  if (mode === "off") return null
  if (!shared.__mjazoCore) {
    shared.__mjazoCore = (mode === "postgres" ? postgres() : openLite(path.join(process.cwd(), ".data", "pglite"))).catch((e) => {
      shared.__mjazoCore = null
      throw e
    })
  }
  return shared.__mjazoCore
}

/** The core database; throws when the core is off. */
export async function requireCore(): Promise<Db> {
  const db = await core()
  if (!db) throw new Error("The core database isn't configured (DATABASE_URL)")
  return db
}

/** Tests: point the core at a given database (or switch it off with null; undefined resets). */
export function setCoreForTests(db: Db | null | undefined) {
  override = db
}
