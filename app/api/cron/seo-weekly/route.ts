import { NextResponse } from "next/server"
import { safeEqual } from "@/lib/server/session"
import { getCatalog } from "@/lib/cms/read"
import { sitePages } from "@/lib/cms/seo/pages"
import { AUDITS_AT_ONCE, auditPage, pagespeedAvailable, pool, runPageSpeed } from "@/lib/cms/seo/audit"

// The weekly SEO check (vercel.json runs it on Mondays; Vercel sends `Authorization: Bearer
// $CRON_SECRET`): re-audits every English page, then runs PageSpeed (mobile) on the main pages, so
// the dashboard at /admin/seo stays current without anyone pressing "Audit all".

export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const started = Date.now()
  const base = new URL(req.url).origin
  const pages = (await sitePages("en")).filter((p) => !p.noindex)

  // Every page, several at a time; stop starting new ones after two and a half minutes.
  const audits = await pool(pages, AUDITS_AT_ONCE, async (p) => {
    if (Date.now() - started > 150_000) return "skipped"
    try {
      await auditPage(base, p.path, "en", p.keyword)
      return "ok"
    } catch {
      return "error"
    }
  })

  // PageSpeed is slow (20–60 seconds a page), so only the main pages, three at a time.
  const { worlds } = await getCatalog("en")
  const main = ["/", "/services", ...worlds.map((w) => `/services/w/${w.slug}`), "/offers", "/plus", "/karachi"]
  const speeds = pagespeedAvailable()
    ? await pool(main, 3, async (p) => {
        if (Date.now() - started > 200_000) return "skipped"
        try {
          await runPageSpeed(p, "mobile")
          return "ok"
        } catch {
          return "error"
        }
      })
    : []

  const count = (xs: string[], k: string) => xs.filter((x) => x === k).length
  return NextResponse.json({
    audited: count(audits, "ok"),
    auditErrors: count(audits, "error"),
    auditSkipped: count(audits, "skipped"),
    pagespeed: count(speeds, "ok"),
    pagespeedErrors: count(speeds, "error"),
    pagespeedSkipped: count(speeds, "skipped"),
    seconds: Math.round((Date.now() - started) / 1000),
  })
}
