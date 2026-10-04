import { promises as fs } from "fs"
import path from "path"
import { db } from "@/lib/server/store"

// Reading and matching redirects: the part proxy.ts needs on every request (kept free of the admin's
// heavier modules). Editing lives in lib/cms/redirects.ts.

export type Redirect = { source: string; destination: string; permanent: boolean; hits: number; note: string | null; created_by: string | null; created_at: string }

const FILE = path.join(process.cwd(), ".data", "cms", "redirects.json")
export const readLocal = async (): Promise<Redirect[]> => {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"))
  } catch {
    return []
  }
}
export const writeLocal = async (rows: Redirect[]) => {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(rows, null, 1))
}

export async function listRedirects(): Promise<Redirect[]> {
  if (db) {
    const { data, error } = await db.from("cms_redirects").select("*").order("created_at", { ascending: false })
    if (error) throw error
    return data as Redirect[]
  }
  if (process.env.VERCEL) return []
  return readLocal()
}

export const STAFF = /^\/(api|admin|ops|pro|_next)(\/|$)/
export function normalise(p: string): string {
  let s = p.trim()
  if (/^https?:\/\//i.test(s)) return s
  if (!s.startsWith("/")) s = `/${s}`
  s = s.replace(/^\/(en|ur)(?=\/|$)/, "") || "/"
  return s.length > 1 ? s.replace(/\/+$/, "") : s
}

/** Where a path should go, if anywhere. Exact sources win over wildcards; the longest wildcard wins. */
export function matchRedirect(p: string, rows: Pick<Redirect, "source" | "destination" | "permanent">[]): { destination: string; permanent: boolean; source: string } | null {
  const target = normalise(p)
  const exact = rows.find((r) => r.source === target)
  if (exact) return { destination: exact.destination, permanent: exact.permanent, source: exact.source }
  let best: (typeof rows)[number] | null = null
  for (const r of rows) {
    if (!r.source.endsWith("/*")) continue
    const base = r.source.slice(0, -2)
    if ((target === base || target.startsWith(`${base}/`)) && (!best || r.source.length > best.source.length)) best = r
  }
  if (!best) return null
  const rest = target.slice(best.source.length - 2).replace(/^\//, "")
  return { destination: best.destination.replace("*", rest).replace(/\/+$/, "") || "/", permanent: best.permanent, source: best.source }
}

/** Counts a use (best effort, never blocks the redirect). */
export async function countHit(source: string, current: number) {
  try {
    if (db) await db.from("cms_redirects").update({ hits: current + 1 }).eq("source", source)
    else if (!process.env.VERCEL) {
      const rows = await readLocal()
      const r = rows.find((x) => x.source === source)
      if (r) {
        r.hits++
        await writeLocal(rows)
      }
    }
  } catch {}
}
