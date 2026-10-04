import "server-only"
import type { HelpTopic, LegalDoc, Post } from "@/lib/content"
import { getCatalog, getContent, getPage } from "../read"
import { getType } from "../registry"
import type { Locale } from "../fields"

// Every public page the SEO dashboard audits (in the order its sections show), with its focus
// keyword and where to edit it.

export type SitePage = { path: string; label: string; group: string; keyword: string; edit: string | null; noindex: boolean }

const STATIC: [string, string | null, string?][] = [
  ["/", "home"],
  ["/services", "services"],
  ["/offers", "offers"],
  ["/plus", "plus"],
  ["/safety", "safety"],
  ["/how-it-works", "how-it-works"],
  ["/weddings", "weddings"],
  ["/weddings/planner", "shaadi-planner"],
  ["/ghar-scan", "ghar-scan"],
  ["/home-pulse", "home-pulse"],
  ["/glam-mirror", "glam-mirror"],
  ["/karachi", "karachi"],
  ["/business", "business"],
  ["/gift-cards", "gift-cards"],
  ["/refer", "refer"],
  ["/app", "app"],
  ["/about", "about"],
  ["/careers", "careers"],
  ["/contact", "contact"],
  ["/complaint", "complaint"],
  ["/help", "help"],
  ["/blog", "blog"],
  ["/partner", null, "Become a pro"],
  ["/partner/apply", null, "Pro application"],
]

export async function sitePages(locale: Locale = "en"): Promise<SitePage[]> {
  const [{ worlds, visibleCategories, allServices, areas }, helpTopics, posts, legal] = await Promise.all([
    getCatalog(locale),
    getContent<HelpTopic>("help-topic", locale),
    getContent<Post>("post", locale),
    getContent<LegalDoc>("legal", locale),
  ])
  const statics = await Promise.all(
    STATIC.map(async ([p, id, name]): Promise<SitePage> => {
      const seo = id ? (await getPage(id, locale)).seo : undefined
      return { path: p, label: id ? (getType(`page-${id}`)?.label ?? p) : (name ?? p), group: "Pages", keyword: seo?.keyword ?? "", edit: id ? `/admin/c/page-${id}/main` : null, noindex: Boolean(seo?.noindex) }
    }),
  )
  return [
    ...statics,
    ...worlds.map((w) => ({ path: `/services/w/${w.slug}`, label: w.name, group: "Worlds", keyword: w.seo?.keyword ?? "", edit: `/admin/c/world/${w.slug}`, noindex: Boolean(w.seo?.noindex) })),
    ...visibleCategories.map((c) => ({ path: `/services/${c.slug}`, label: c.name, group: "Categories", keyword: c.seo?.keyword ?? "", edit: `/admin/c/category/${c.slug}`, noindex: Boolean(c.seo?.noindex) })),
    ...allServices.map(({ category, service }) => ({ path: `/services/${category.slug}/${service.slug}`, label: service.name, group: "Services", keyword: service.seo?.keyword ?? "", edit: `/admin/c/service/${service.slug}`, noindex: Boolean(service.seo?.noindex) })),
    ...areas.map((a) => ({ path: `/karachi/${a.slug}`, label: a.name, group: "Areas", keyword: a.seo?.keyword ?? "", edit: `/admin/c/area/${a.slug}`, noindex: Boolean(a.seo?.noindex) })),
    // One page per area and category, all from the title patterns in SEO settings.
    ...areas.flatMap((a) =>
      visibleCategories.map((c) => ({ path: `/karachi/${a.slug}/${c.slug}`, label: `${c.name} · ${a.name}`, group: "Area pages", keyword: `${c.name} ${a.name}`.toLowerCase(), edit: "/admin/c/settings-seo/main", noindex: false })),
    ),
    ...posts.map((p) => ({ path: `/blog/${p.slug}`, label: p.title, group: "Blog", keyword: p.seo?.keyword ?? "", edit: `/admin/c/post/${p.slug}`, noindex: Boolean(p.seo?.noindex) })),
    ...helpTopics.map((t) => ({ path: `/help/${t.slug}`, label: t.title, group: "Help", keyword: t.seo?.keyword ?? "", edit: `/admin/c/help-topic/${t.slug}`, noindex: Boolean(t.seo?.noindex) })),
    ...legal.map((d) => ({ path: `/${d.slug}`, label: d.title, group: "Legal", keyword: d.seo?.keyword ?? "", edit: `/admin/c/legal/${d.slug}`, noindex: Boolean(d.seo?.noindex) })),
  ]
}

/** Paths that exist but aren't audited (app screens): links to them aren't broken. */
export const APP_PATHS = ["/cart", "/checkout", "/login", "/account", "/account/bookings", "/account/addresses", "/search", "/rate", "/booking/confirmed", "/partner/thanks"]
