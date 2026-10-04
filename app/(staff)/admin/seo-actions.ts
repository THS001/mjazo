"use server"

import { headers } from "next/headers"
import { run, ValidationError } from "@/lib/cms/action"
import { aiEnabled, MODELS } from "@/lib/ai/anthropic"
import { structured } from "@/lib/ai/structured"
import { blockFields, isLocalized, richToText, type Fields, type Locale, type RichDoc } from "@/lib/cms/fields"
import { localePath } from "@/lib/i18n"
import { getType } from "@/lib/cms/registry"
import { getSeoSettings, getSettings } from "@/lib/cms/read"
import { writable } from "@/lib/cms/store"
import { deleteRedirect, listRedirects, saveRedirect } from "@/lib/cms/redirects"
import { BUILTIN } from "@/lib/cms/redirect-match"
import { latestReports } from "@/lib/cms/seo/reports"
import { APP_PATHS, sitePages } from "@/lib/cms/seo/pages"
import { AUDITS_AT_ONCE, auditPage, pagespeedAvailable, pagespeedTarget, pool, runPageSpeed } from "@/lib/cms/seo/audit"
import { analyse } from "@/lib/cms/seo/score"
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

/** Every auditable page with its latest reports, for the dashboard. */
export async function seoOverviewAction(locale: Locale = "en") {
  return run("view", async () => {
    const [pages, reports, settings] = await Promise.all([sitePages(locale), latestReports(), getSettings("en")])
    return {
      pages,
      reports,
      appPaths: APP_PATHS,
      pagespeed: { available: pagespeedAvailable(), host: new URL(pagespeedTarget("/")).host },
      urduPublic: Boolean(settings.flags.URDU_SITE),
    }
  })
}

/** Fetches the page as visitors see it, scores it and keeps the report. */
export async function auditAction(path: string, locale: Locale, keyword: string) {
  return run("seo", async () => auditPage(await origin(), path, locale, keyword))
}

/** Audits up to 24 pages, several at a time (the browser runs one server action at a time, so "Audit all" sends batches). */
export async function auditManyAction(items: { path: string; keyword: string }[], locale: Locale) {
  return run("seo", async () => {
    const base = await origin()
    return pool(items.slice(0, 24), AUDITS_AT_ONCE, async (p) => {
      try {
        return { path: p.path, report: await auditPage(base, p.path, locale, p.keyword), error: null }
      } catch (e) {
        return { path: p.path, report: null, error: e instanceof ValidationError ? e.issues.join(" ") : "Couldn't load the page." }
      }
    })
  })
}

/** Google PageSpeed Insights for the public address (works for public URLs only). */
export async function pagespeedAction(path: string, strategy: "mobile" | "desktop" = "mobile") {
  return run("seo", () => runPageSpeed(path, strategy))
}

/** Status codes for internal links the audit couldn't match to a known page. */
export async function checkLinksAction(paths: string[]) {
  return run("seo", async () => {
    const base = await origin()
    const out: { path: string; status: number; location: string | null }[] = []
    for (const p of paths.slice(0, 40)) {
      try {
        const r = await fetch(`${base}${p}`, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(20_000) })
        const loc = r.headers.get("location")
        out.push({ path: p, status: r.status, location: loc ? new URL(loc, base).pathname : null })
      } catch {
        out.push({ path: p, status: 0, location: null })
      }
    }
    return out
  })
}

/** What the editor's SEO panel shows: the page as it is live now, the title ending, and the latest report. */
export async function seoPanelAction(path: string, locale: Locale = "en") {
  return run("view", async () => {
    const base = await origin()
    const [settings, reports] = await Promise.all([getSeoSettings(locale), latestReports()])
    let live: { title: string; description: string; image: string | null } | null = null
    try {
      const res = await fetch(`${base}${localePath(path, locale)}`, { cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "MjazoSEOAudit/1.0" } })
      if (res.ok) {
        const a = analyse(await res.text(), { path, locale })
        // Share images are absolute on the public address; show them from this server instead.
        live = { title: a.stats.title, description: a.stats.description, image: a.stats.ogImage?.replace(SITE_URL, base) ?? null }
      }
    } catch {}
    const r = reports.find((x) => x.path === path && x.locale === locale)
    const report = r
      ? { score: r.score, at: r.created_at, fails: r.analysis.checks.filter((c) => c.status === "fail").length, warns: r.analysis.checks.filter((c) => c.status === "warn").length, top: r.analysis.checks.filter((c) => c.status !== "pass").sort((a, b) => b.weight - a.weight).slice(0, 3).map((c) => c.label) }
      : null
    return { live, template: settings.titleTemplate, host: new URL(SITE_URL).host, report }
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
      else if (fd.kind === "blocks" && Array.isArray(x)) x.forEach((y) => walk(blockFields(fd, y) ?? {}, y as Record<string, unknown>))
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

/** The CMS's redirects, plus the ones built into the site's code (read-only). */
export async function listRedirectsAction() {
  return run("view", async () => ({ rows: await listRedirects(), builtin: BUILTIN }))
}

export async function saveRedirectAction(r: { source: string; destination: string; permanent: boolean; note?: string; previous?: string | null }) {
  return run("seo", (u) => {
    if (!writable()) throw new ValidationError(["Saving is switched off until Supabase is connected."])
    return saveRedirect(u, r)
  })
}

export async function deleteRedirectAction(source: string) {
  return run("seo", async (u) => {
    if (!writable()) throw new ValidationError(["Saving is switched off until Supabase is connected."])
    await deleteRedirect(u, source)
    return null
  })
}
