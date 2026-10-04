import path from "path"
import { db } from "@/lib/server/store"
import { readJson, writeJson } from "./local-json"

// Reading redirects: the part proxy.ts needs on every request (kept free of the admin's heavier
// modules). Matching is in redirect-match.ts; editing lives in lib/cms/redirects.ts.

export { matchRedirect, normalise, STAFF, traceRedirect } from "./redirect-match"

export type Redirect = { source: string; destination: string; permanent: boolean; hits: number; note: string | null; created_by: string | null; created_at: string }

const FILE = path.join(process.cwd(), ".data", "cms", "redirects.json")
export const readLocal = () => readJson<Redirect[]>(FILE, [])
export const writeLocal = (rows: Redirect[]) => writeJson(FILE, rows, true)

export async function listRedirects(): Promise<Redirect[]> {
  if (db) {
    const { data, error } = await db.from("cms_redirects").select("*").order("created_at", { ascending: false })
    if (error) throw error
    return data as Redirect[]
  }
  if (process.env.VERCEL) return []
  return readLocal()
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
