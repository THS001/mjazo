import type { MetadataRoute } from "next"
import type { HelpTopic, LegalDoc, Post } from "@/lib/content"
import { getCatalog, getContent, getSettings } from "@/lib/cms/read"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { allServices, areas, visibleCategories, worlds } = await getCatalog()
  const [{ site }, helpTopics, posts, legal] = await Promise.all([getSettings(), getContent<HelpTopic>("help-topic"), getContent<Post>("post"), getContent<LegalDoc>("legal")])
  const u = (path: string, priority = 0.6): MetadataRoute.Sitemap[number] => ({ url: `${site.url}${path}`, changeFrequency: "weekly", priority })
  const statics = ["/ghar-scan", "/home-pulse", "/glam-mirror", "/weddings/planner", "/complaint", "/services", "/offers", "/plus", "/safety", "/how-it-works", "/partner", "/partner/apply", "/business", "/weddings", "/gift-cards", "/refer", "/app", "/help", "/about", "/careers", "/blog", "/contact", "/karachi"]
  return [
    u("/", 1),
    ...statics.map((p) => u(p, 0.8)),
    ...worlds.map((w) => u(`/services/w/${w.slug}`, 0.8)),
    ...visibleCategories.map((c) => u(`/services/${c.slug}`, c.status === "live" ? 0.9 : 0.5)),
    ...allServices.map(({ category, service }) => u(`/services/${category.slug}/${service.slug}`, category.status === "live" ? 0.8 : 0.4)),
    ...areas.map((a) => u(`/karachi/${a.slug}`, a.status === "live" ? 0.8 : 0.4)),
    ...areas.flatMap((a) => visibleCategories.map((c) => u(`/karachi/${a.slug}/${c.slug}`, a.status === "live" && c.status === "live" ? 0.7 : 0.3))),
    ...helpTopics.map((t) => u(`/help/${t.slug}`, 0.5)),
    ...posts.map((p) => u(`/blog/${p.slug}`, 0.6)),
    ...legal.map((d) => u(`/${d.slug}`, 0.2)),
  ]
}
