import type { MetadataRoute } from "next"
import { getSettings } from "@/lib/cms/read"

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { site } = await getSettings()
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/checkout", "/cart", "/account", "/login", "/booking/", "/search", "/ops", "/pro$", "/pro/", "/partner/interview/"] }],
    sitemap: `${site.url}/sitemap.xml`,
  }
}
