import type { MetadataRoute } from "next"
import type { HelpTopic, LegalDoc, Post } from "@/lib/content"
import type { BlockPage } from "@/lib/cms/types/block-page"
import { getCatalog, getContent, getPage, getSettings } from "@/lib/cms/read"
import { HREFLANG, localePath } from "@/lib/i18n"

// Every public page. When the Urdu site is switched on (Settings → Feature switches), each page is
// listed in both languages with hreflang alternates. Pages and items set to "Hide from search engines" are left out.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { allServices, areas, visibleCategories, worlds } = await getCatalog("en")
  const [{ site, flags }, helpTopics, posts, legal, blockPages] = await Promise.all([getSettings("en"), getContent<HelpTopic>("help-topic", "en"), getContent<Post>("post", "en"), getContent<LegalDoc>("legal", "en"), getContent<BlockPage>("block-page", "en")])
  const statics = ["/ghar-scan", "/home-pulse", "/glam-mirror", "/weddings/planner", "/complaint", "/services", "/offers", "/plus", "/safety", "/how-it-works", "/partner", "/partner/apply", "/business", "/weddings", "/gift-cards", "/refer", "/app", "/help", "/about", "/careers", "/blog", "/contact", "/karachi"]
  // Static pages whose SEO group says noindex
  const pageId = (p: string) => (p === "/" ? "home" : p === "/weddings/planner" ? "shaadi-planner" : p.slice(1))
  const hidden = new Set(
    (await Promise.all(["/", ...statics].map(async (p) => ((await getPage(pageId(p), "en").catch(() => null))?.seo?.noindex ? p : null)))).filter(Boolean),
  )
  const show = <T extends { seo?: { noindex?: boolean } }>(x: T) => !x.seo?.noindex
  const pages: [string, number][] = [
    ["/", 1],
    ...statics.map((p): [string, number] => [p, 0.8]),
    ...worlds.filter(show).map((w): [string, number] => [`/services/w/${w.slug}`, 0.8]),
    ...visibleCategories.filter(show).map((c): [string, number] => [`/services/${c.slug}`, c.status === "live" ? 0.9 : 0.5]),
    ...allServices.filter(({ service }) => show(service)).map(({ category, service }): [string, number] => [`/services/${category.slug}/${service.slug}`, category.status === "live" ? 0.8 : 0.4]),
    ...areas.filter(show).map((a): [string, number] => [`/karachi/${a.slug}`, a.status === "live" ? 0.8 : 0.4]),
    ...areas.flatMap((a) => visibleCategories.map((c): [string, number] => [`/karachi/${a.slug}/${c.slug}`, a.status === "live" && c.status === "live" ? 0.7 : 0.3])),
    ...helpTopics.filter(show).map((t): [string, number] => [`/help/${t.slug}`, 0.5]),
    ...posts.filter(show).map((p): [string, number] => [`/blog/${p.slug}`, 0.6]),
    ...legal.filter(show).map((d): [string, number] => [`/${d.slug}`, 0.2]),
    ...blockPages.filter(show).map((b): [string, number] => [b.path, 0.6]),
  ]
  const url = (path: string) => `${site.url}${path}`
  return pages.filter(([path]) => !hidden.has(path)).flatMap(([path, priority]) => {
    const en = url(path)
    if (!flags.URDU_SITE) return [{ url: en, changeFrequency: "weekly" as const, priority }]
    const ur = url(localePath(path, "ur"))
    const alternates = { languages: { [HREFLANG.en]: en, [HREFLANG.ur]: ur, "x-default": en } }
    return [
      { url: en, changeFrequency: "weekly" as const, priority, alternates },
      { url: ur, changeFrequency: "weekly" as const, priority: Math.max(0.1, priority - 0.1), alternates },
    ]
  })
}
