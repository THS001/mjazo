import "server-only"
import path from "path"
import { db } from "@/lib/server/store"
import { readJson, writeJson } from "../local-json"
import type { Analysis } from "./score"

// SEO and PageSpeed reports: cms_seo_reports (migration 0004), or .data/cms/seo.json locally.
// The dashboard shows the latest report per page and language; older ones are kept as history.

export type PageSpeed = { at: string; strategy: "mobile" | "desktop"; performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null; lcp: string | null; cls: string | null; tbt: string | null }
export type Report = { path: string; locale: string; score: number; analysis: Analysis; pagespeed: PageSpeed | null; created_at: string }

const FILE = path.join(process.cwd(), ".data", "cms", "seo.json")
const readLocal = () => readJson<Report[]>(FILE, [])

// Audits run several at a time: local writes take turns so none is lost.
let queue: Promise<unknown> = Promise.resolve()
const inTurn = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn)
  queue = next.catch(() => {})
  return next
}

export async function saveReport(r: Omit<Report, "created_at">): Promise<Report> {
  const row: Report = { ...r, created_at: new Date().toISOString() }
  if (db) {
    const { error } = await db.from("cms_seo_reports").insert({ path: r.path, locale: r.locale, score: r.score, checks: r.analysis, pagespeed: r.pagespeed })
    if (error) throw error
    return row
  }
  if (process.env.VERCEL) return row
  return inTurn(() => saveLocal(row))
}

async function saveLocal(row: Report): Promise<Report> {
  const rows = await readLocal()
  rows.push(row)
  // Keep the last 10 reports per page and language.
  const kept: Report[] = []
  const count = new Map<string, number>()
  for (const x of [...rows].reverse()) {
    const k = `${x.locale}${x.path}`
    const n = count.get(k) ?? 0
    if (n < 10) kept.push(x)
    count.set(k, n + 1)
  }
  await writeJson(FILE, kept.reverse())
  return row
}

type DbRow = { path: string; locale: string; score: number; checks: Analysis; pagespeed: PageSpeed | null; created_at: string }
const fromDb = (r: DbRow): Report => ({ path: r.path, locale: r.locale, score: r.score, analysis: r.checks, pagespeed: r.pagespeed, created_at: r.created_at })

/** The newest report for every page and language. */
export async function latestReports(): Promise<Report[]> {
  let rows: Report[]
  if (db) {
    const { data, error } = await db.from("cms_seo_reports").select("path,locale,score,checks,pagespeed,created_at").order("created_at", { ascending: false }).limit(3000)
    if (error) throw error
    rows = (data as DbRow[]).map(fromDb)
  } else rows = process.env.VERCEL ? [] : [...(await readLocal())].reverse()
  const seen = new Map<string, Report>()
  for (const r of rows) if (!seen.has(`${r.locale}${r.path}`)) seen.set(`${r.locale}${r.path}`, r)
  return [...seen.values()]
}

/** The newest report for one page, to attach PageSpeed results to. */
export async function latestReport(p: string, locale: string): Promise<Report | null> {
  return (await latestReports()).find((r) => r.path === p && r.locale === locale) ?? null
}
