import "server-only"
import { localePath } from "@/lib/i18n"
import { SITE_URL } from "@/lib/site"
import { ValidationError } from "../action"
import type { Locale } from "../fields"
import { latestReport, saveReport, type PageSpeed, type Report } from "./reports"
import { analyse } from "./score"

// Running audits: fetch a page the way a visitor (or Google) gets it, score it, keep the report.
// Shared by the admin's SEO dashboard and the weekly check (/api/cron/seo-weekly).

// The dev server compiles each route on its first visit, which is slow: fewer audits at once, more patience.
const DEV = process.env.NODE_ENV === "development"
export const AUDITS_AT_ONCE = DEV ? 2 : 6
const PAGE_TIMEOUT = DEV ? 120_000 : 30_000

/**
 * A path on this site ("/services"), checked before it's appended to the site's address: anything
 * else ("@other.com", "//other.com") would make the server fetch another website.
 */
export function sitePath(p: unknown): string {
  if (typeof p !== "string" || p.length > 300 || !/^\/(?!\/)[^\s\\]*$/.test(p)) throw new ValidationError(["That isn't an address on this site."])
  return p
}

/** Fetches the page from `base` (this site's own address), scores it and keeps the report with its last PageSpeed result. */
export async function auditPage(base: string, path: string, locale: Locale, keyword: string): Promise<Report> {
  const url = `${base}${localePath(sitePath(path), locale)}`
  let res: Response
  try {
    res = await fetch(url, { cache: "no-store", redirect: "follow", headers: { "user-agent": "MjazoSEOAudit/1.0" }, signal: AbortSignal.timeout(PAGE_TIMEOUT) })
  } catch (e) {
    throw new ValidationError([e instanceof Error && e.name === "TimeoutError" ? `The page took more than ${PAGE_TIMEOUT / 1000} seconds to load. Try again.` : "Couldn't reach the page."])
  }
  if (!res.ok) throw new ValidationError([`The page answered ${res.status}.`])
  const landed = new URL(res.url || url)
  if (res.redirected && landed.pathname !== new URL(url).pathname) throw new ValidationError([`This address redirects to ${landed.pathname}. Audit that page instead, or remove the redirect.`])
  const analysis = analyse(await res.text(), { path, keyword, locale, origin: base })
  const prev = await latestReport(path, locale)
  return saveReport({ path, locale, score: analysis.score, analysis, pagespeed: prev?.pagespeed ?? null })
}

/** The public address PageSpeed tests (Google can't reach a local computer). */
export const pagespeedTarget = (path: string) => `${SITE_URL}${path}`
export const pagespeedAvailable = () => !/localhost|127\.0\.0\.1/.test(SITE_URL)

/** Google PageSpeed Insights for the public address, kept with the page's latest English report. */
export async function runPageSpeed(path: string, strategy: "mobile" | "desktop" = "mobile"): Promise<PageSpeed> {
  if (!pagespeedAvailable()) throw new ValidationError(["PageSpeed needs the public site address."])
  const q = new URLSearchParams({ url: pagespeedTarget(sitePath(path)), strategy })
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) q.append("category", c)
  if (process.env.PAGESPEED_API_KEY) q.set("key", process.env.PAGESPEED_API_KEY)
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { cache: "no-store", signal: AbortSignal.timeout(90_000) })
  if (!res.ok) throw new ValidationError([res.status === 429 ? "Google's free PageSpeed quota is used up for now. Add PAGESPEED_API_KEY for more." : `PageSpeed answered ${res.status}.`])
  const j = (await res.json()) as { lighthouseResult?: { categories?: Record<string, { score: number | null }>; audits?: Record<string, { displayValue?: string }> } }
  const cat = j.lighthouseResult?.categories ?? {}
  const audits = j.lighthouseResult?.audits ?? {}
  const pct = (k: string) => (typeof cat[k]?.score === "number" ? Math.round(cat[k].score! * 100) : null)
  const ps: PageSpeed = {
    at: new Date().toISOString(),
    strategy,
    performance: pct("performance"),
    accessibility: pct("accessibility"),
    bestPractices: pct("best-practices"),
    seo: pct("seo"),
    lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
    cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
    tbt: audits["total-blocking-time"]?.displayValue ?? null,
  }
  const prev = await latestReport(path, "en")
  if (prev) await saveReport({ ...prev, pagespeed: ps })
  return ps
}

/** Runs `fn` over `items`, `size` at a time. */
export async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}
