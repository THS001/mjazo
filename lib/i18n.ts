// Locales on the public site. English lives at the plain paths (/services); Urdu under /ur
// (/ur/services). proxy.ts maps plain paths to the app's [locale] segment.

export const LOCALES = ["en", "ur"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "en"

export const isLocale = (s: string | undefined | null): s is Locale => Boolean(s) && (LOCALES as readonly string[]).includes(s!)
export const dirOf = (l: Locale) => (l === "ur" ? "rtl" : "ltr")
export const OG_LOCALE: Record<Locale, string> = { en: "en_PK", ur: "ur_PK" }
export const HREFLANG: Record<Locale, string> = { en: "en-PK", ur: "ur-PK" }

/** Paths that are never localised (staff apps, APIs, files). */
const UNLOCALISED = /^\/(api|admin|ops|pro)(\/|$)|^\/_next\//

/** A site path in a locale: "/services" -> "/ur/services" for Urdu; English has no prefix. */
export function localePath(path: string, l: Locale): string {
  if (!path.startsWith("/") || path.startsWith("//") || UNLOCALISED.test(path)) return path
  const bare = stripLocale(path)
  if (l === DEFAULT_LOCALE) return bare
  return bare === "/" ? "/ur" : bare.startsWith("/#") || bare.startsWith("/?") ? `/ur${bare.slice(1)}` : `/ur${bare}`
}

/** The path without a locale prefix: "/ur/services" -> "/services", "/ur" -> "/". */
export function stripLocale(path: string): string {
  const m = path.match(/^\/(en|ur)(?=\/|$|\?|#)(.*)$/)
  if (!m) return path
  const rest = m[2]
  return !rest ? "/" : rest.startsWith("/") ? rest : `/${rest}`
}

/** The locale a path is in. */
export const localeOfPath = (path: string): Locale => (/^\/ur(\/|$|\?|#)/.test(path) ? "ur" : "en")
