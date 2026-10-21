import "server-only"
import { cache } from "react"
import { notFound } from "next/navigation"
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n"

// The locale of the page being rendered. Pages call pageLocale(params) first (the root layout calls
// layoutLocale); the CMS readers (getPage, getCatalog, getSettings, ...) then default to it, so
// server components deep in a page don't need the locale passed down. React's cache() scopes the
// value to one request.

const store = cache(() => ({ locale: DEFAULT_LOCALE as Locale }))

export function setRequestLocale(l: Locale) {
  store().locale = l
}

/** The current page's locale (English outside a page render, e.g. in generateStaticParams). */
export function requestLocale(): Locale {
  try {
    return store().locale
  } catch {
    return DEFAULT_LOCALE
  }
}

type LocaleParams = Promise<{ locale?: string }> | { locale?: string } | undefined

/**
 * Reads the [locale] route param, remembers it for this request and returns it. Anything else in
 * the locale's place is a 404: proxy.ts leaves paths that end in a file extension alone (static
 * files), so a missing file like /some-file.pdf arrives here with locale "some-file.pdf".
 */
export async function pageLocale(params: LocaleParams): Promise<Locale> {
  const p = await params
  if (p?.locale !== undefined && !isLocale(p.locale)) notFound()
  return remember(p?.locale)
}

/**
 * The root layout's version: falls back to English instead of a 404, because the 404 page itself
 * renders inside that layout (the page below it calls pageLocale and 404s).
 */
export async function layoutLocale(params: LocaleParams): Promise<Locale> {
  return remember((await params)?.locale)
}

function remember(value: string | undefined): Locale {
  const l = isLocale(value) ? value : DEFAULT_LOCALE
  setRequestLocale(l)
  return l
}
