import "server-only"
import { cache } from "react"
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n"

// The locale of the page being rendered. Pages and layouts call pageLocale(params) first; the CMS
// readers (getPage, getCatalog, getSettings, ...) then default to it, so server components deep in a
// page don't need the locale passed down. React's cache() scopes the value to one request.

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

/** Reads the [locale] route param, remembers it for this request and returns it. */
export async function pageLocale(params: Promise<{ locale?: string }> | { locale?: string } | undefined): Promise<Locale> {
  const p = await params
  const l = isLocale(p?.locale) ? p!.locale : DEFAULT_LOCALE
  setRequestLocale(l)
  return l
}
