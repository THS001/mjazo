import "server-only"
import type { Metadata } from "next"
import { HREFLANG, localePath, OG_LOCALE } from "@/lib/i18n"
import { renderTokens, type Img } from "../fields"
import { requestLocale } from "../locale"
import { getSeoSettings, getSettings } from "../read"
import type { Seo } from "../types/seo"

// Every route's metadata comes from here: the page's SEO fields win, then the page's built-in
// title and description, then the site defaults (Settings → SEO settings). Canonical and hreflang
// addresses follow the page's locale; the Urdu site stays noindex until it's switched on.

type Input = {
  /** The page's path without a locale prefix, e.g. "/services/womens-salon". */
  path: string
  seo?: Seo
  title?: string
  description?: string
  /** {{tokens}} for title and description patterns. */
  vars?: Record<string, string | number>
  image?: Img | { url: string; w?: number; h?: number; alt?: string } | null
  type?: "website" | "article"
  /** Keep out of search results ("follow": but still follow its links). */
  noindex?: boolean | "follow"
  /** Use the title as is (no "· Mjazo" ending), e.g. on the home page. */
  absolute?: boolean
  /** The route has its own generated share card (an opengraph-image file), shown when no image is set. */
  card?: boolean
}

export const fillPattern = (s: string | undefined, vars?: Record<string, string | number>) => (s ? renderTokens(s, vars).replace(/\s+/g, " ").trim() : "")

/**
 * The generated Mjazo card (app/opengraph-image.tsx). A page's own openGraph replaces the one it
 * would inherit, so pages without a share image name the card explicitly. Routes with a card of
 * their own (`card`) set no image instead, because an image set here would replace their card.
 */
const DEFAULT_CARD = { url: "/opengraph-image", w: 1200, h: 630, alt: "" }

export async function pageMetadata(o: Input): Promise<Metadata> {
  const locale = requestLocale()
  const [{ flags }, seoSettings] = await Promise.all([getSettings(locale), getSeoSettings(locale)])
  const title = fillPattern(o.seo?.title, o.vars) || fillPattern(o.title, o.vars) || seoSettings.defaultTitle
  const description = (fillPattern(o.seo?.description, o.vars) || fillPattern(o.description, o.vars) || seoSettings.defaultDescription).slice(0, 300)
  const url = localePath(o.path, locale)
  const canonical = o.seo?.canonical?.trim() || url
  const img = (o.card ? [o.seo?.image, o.image] : [o.seo?.image, o.image, seoSettings.defaultImage, DEFAULT_CARD]).find((x) => x?.url)
  const images = img?.url ? [{ url: img.url, ...(img.w ? { width: img.w } : {}), ...(img.h ? { height: img.h } : {}), alt: img.alt || title }] : undefined
  const noindex = Boolean(o.seo?.noindex || o.noindex || !seoSettings.indexing || (locale === "ur" && !flags.URDU_SITE))
  return {
    title: o.absolute || !o.seo?.title && !o.title ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      ...(flags.URDU_SITE ? { languages: { [HREFLANG.en]: localePath(o.path, "en"), [HREFLANG.ur]: localePath(o.path, "ur"), "x-default": localePath(o.path, "en") } } : {}),
    },
    openGraph: { title, description, url: canonical, siteName: "Mjazo", locale: OG_LOCALE[locale], type: o.type ?? "website", ...(images ? { images } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
    ...(noindex ? { robots: { index: false, follow: o.noindex !== true } } : {}),
  }
}
