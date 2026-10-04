import type { MetadataRoute } from "next"
import { getSeoSettings, getSettings } from "@/lib/cms/read"

// From Settings → SEO settings: the paths robots shouldn't crawl (and their Urdu twins), or the
// whole site when indexing is switched off.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const [{ site }, seo] = await Promise.all([getSettings("en"), getSeoSettings("en")])
  if (!seo.indexing) return { rules: [{ userAgent: "*", disallow: "/" }] }
  const staff = /^\/(api|admin|ops|pro)(\/|\$|$)/
  const disallow = [...new Set(seo.disallow.flatMap((p) => (staff.test(p) ? [p] : [p, `/ur${p}`])))]
  return { rules: [{ userAgent: "*", allow: "/", disallow }], sitemap: `${site.url}/sitemap.xml` }
}
