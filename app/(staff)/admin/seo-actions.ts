"use server"

import { headers } from "next/headers"
import { run, ValidationError } from "@/lib/cms/action"
import { aiEnabled, MODELS } from "@/lib/ai/anthropic"
import { structured } from "@/lib/ai/structured"
import { isLocalized, type Fields, type Locale, type RichDoc } from "@/lib/cms/fields"
import { localePath } from "@/lib/i18n"
import { getType } from "@/lib/cms/registry"
import { deleteRedirect, listRedirects, matchRedirect, saveRedirect } from "@/lib/cms/redirects"
import { latestReport, latestReports, saveReport, type PageSpeed } from "@/lib/cms/seo/reports"
import { sitePages } from "@/lib/cms/seo/pages"
import { analyse } from "@/lib/cms/seo/score"
import { richToText } from "@/lib/cms/fields"
import { SITE_URL } from "@/lib/site"

// SEO tools: audits, PageSpeed, AI suggestions and redirects. Audits and suggestions need "seo";
// anyone signed in can look.

/** This site's own address, as the request reached it (so audits work locally and on Vercel). */
async function origin() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  return host ? `${proto}://${host}` : SITE_URL
}

export async function seoOverviewAction(locale: Locale = "en") {
  return run("view", async () => ({ pages: await sitePages(locale), reports: await latestReports() }))
}

/** Fetches the page as visitors see it, scores it and keeps the report. */
export async function auditAction(path: string, locale: Locale, keyword: string) {
  return run("seo", async () => {
    const base = await origin()
    const res = await fetch(`${base}${localePath(path, locale)}`, { cache: "no-store", redirect: "follow", headers: { "user-agent": "MjazoSEOAudit/1.0" } })
    if (!res.ok) throw new ValidationError([`The page answered ${res.status}.`])
    const analysis = analyse(await res.text(), { path, keyword, locale, origin: base })
    const prev = await latestReport(path, locale)
    return saveReport({ path, locale, score: analysis.score, analysis, pagespeed: prev?.pagespeed ?? null })
  })
}

/** Google PageSpeed Insights for the live address (works for public URLs only). */
export async function pagespeedAction(path: string, strategy: "mobile" | "desktop" = "mobile") {
  return run("seo", async () => {
    if (/localhost|127\.0\.0\.1/.test(SITE_URL)) throw new ValidationError(["PageSpeed needs the public site address."])
    const url = `${SITE_URL}${path}`
    const q = new URLSearchParams({ url, strategy })
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
  })
}

/** Status codes for internal links the audit couldn't match to a known page. */
export async function checkLinksAction(paths: string[]) {
  return run("seo", async () => {
    const base = await origin()
    const out: { path: string; status: number }[] = []
    for (const p of paths.slice(0, 40)) {
      try {
        const r = await fetch(`${base}${p}`, { method: "GET", redirect: "manual", cache: "no-store" })
        out.push({ path: p, status: r.status })
      } catch {
        out.push({ path: p, status: 0 })
      }
    }
    return out
  })
}

/** The page's own words (English), for the AI to suggest a title and description from. */
function pageText(fields: Fields, data: Record<string, unknown>): string {
  const out: string[] = []
  const walk = (fs: Fields, v: Record<string, unknown> | undefined) => {
    for (const [k, fd] of Object.entries(fs)) {
      const x = v?.[k]
      if (x == null || k === "seo") continue
      if (isLocalized(fd)) out.push(fd.kind === "richText" ? richToText((x as { en: RichDoc }).en) : String((x as { en?: string }).en ?? ""))
      else if (fd.kind === "group") walk(fd.fields, x as Record<string, unknown>)
      else if (fd.kind === "list" && Array.isArray(x)) x.forEach((y) => (fd.of.kind === "group" ? walk(fd.of.fields, y as Record<string, unknown>) : isLocalized(fd.of) && out.push(String((y as { en?: string }).en ?? ""))))
    }
  }
  walk(fields, data)
  return out.filter(Boolean).join("\n").slice(0, 6000)
}

export async function seoSuggestAction(type: string, data: Record<string, unknown>, path: string) {
  return run("seo", async () => {
    if (!aiEnabled()) throw new ValidationError(["AI suggestions need ANTHROPIC_API_KEY in the environment."])
    const t = getType(type)
    if (!t) throw new Error("Unknown type")
    const out = await structured<{ title: string; description: string; keyword: string }>({
      model: MODELS.concierge,
      maxTokens: 600,
      system:
        "You write search titles and descriptions for Mjazo, a Karachi home-services company (salon and beauty at home, cleaning, AC repair, health visits). Write for people searching on Google in Pakistan. Title: 35–58 characters, the main search phrase first, no brand name (“· Mjazo” is added automatically). Description: 120–155 characters, specific, with a reason to click (verified pros, all-in prices, pay after). Keyword: the 2–4 word phrase this page should rank for, as people type it (e.g. “waxing at home karachi”). Plain English, no quotes, no emojis.",
      messages: [{ role: "user", content: `Page address: ${path}\n\nPage text:\n${pageText(t.fields, data)}` }],
      tool: {
        name: "seo",
        description: "Suggested search title, description and focus keyword",
        input_schema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, keyword: { type: "string" } }, required: ["title", "description", "keyword"] },
      },
    })
    if (!out?.title) throw new ValidationError(["The AI didn't return a suggestion. Try again."])
    return { title: out.title.trim().slice(0, 70), description: out.description.trim().slice(0, 170), keyword: out.keyword.trim().toLowerCase().slice(0, 60) }
  })
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export async function listRedirectsAction() {
  return run("view", () => listRedirects())
}

export async function saveRedirectAction(r: { source: string; destination: string; permanent: boolean; note?: string }) {
  return run("seo", (u) => saveRedirect(u, r))
}

export async function deleteRedirectAction(source: string) {
  return run("seo", async (u) => {
    await deleteRedirect(u, source)
    return null
  })
}

/** Where a path would end up (for the "test an address" box). */
export async function testRedirectAction(path: string) {
  return run("view", async () => matchRedirect(path, await listRedirects()))
}
