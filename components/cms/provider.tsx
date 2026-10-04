"use client"

import { createContext, Fragment, useContext, useMemo, type ReactNode } from "react"
import { buildCatalog, type CatalogData } from "@/lib/catalog"
import { waLink, type Settings } from "@/lib/site"
import type { Locale } from "@/lib/i18n"
import type { NavContent } from "@/lib/cms/types/nav"
import type { UiStrings } from "@/lib/cms/types/ui"

// Hands CMS content to client components. The root layout reads the catalogue, settings, menus and
// UI strings on the server for the page's locale (lib/cms/read.ts) and passes them here; components
// use useCatalog() / useSite() / useNav() / useT() instead of importing static data, so edits in
// /admin reach every component.

// Only the header and tab bar run in the browser; the footer is server-rendered and gets its part as props.
type Value = { locale: Locale; catalog: CatalogData; settings: Settings; nav: Pick<NavContent, "header" | "tabs">; ui: UiStrings }
const Ctx = createContext<Value | null>(null)

export function CmsProvider({ locale, catalog, settings, nav, ui, children }: Value & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, catalog, settings, nav, ui }), [locale, catalog, settings, nav, ui])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function useCms() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useCatalog/useSite/useNav/useT must be used inside <CmsProvider>")
  return v
}

/** The catalogue with all its lookups (getService, searchServices, ...). */
export function useCatalog() {
  const { catalog } = useCms()
  return useMemo(() => buildCatalog(catalog), [catalog])
}

/** Site settings plus a WhatsApp link builder that uses the current number. */
export function useSite() {
  const { settings } = useCms()
  return useMemo(() => ({ ...settings, whatsappLink: (message: string) => waLink(settings.site.whatsapp, message) }), [settings])
}

/** Header, mobile tab bar and footer text and links (Navigation → Header & footer). */
export function useNav() {
  return useCms().nav
}

/** The page's locale ("en" or "ur"). */
export function useLocale(): Locale {
  return useContext(Ctx)?.locale ?? "en"
}

/** Buttons, labels and messages (Navigation → Buttons & labels) for the page's locale. */
export function useT(): UiStrings {
  return useCms().ui
}

// ---------------------------------------------------------------------------
// Filling {{tokens}} in UI strings
// ---------------------------------------------------------------------------

/** "Add {{amount}} more" + { amount: "PKR 500" } -> "Add PKR 500 more". */
export const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

/**
 * Like fill(), but values may be elements (links, bold text). `wrapText` styles the literal parts,
 * e.g. the small grey "from" in "from PKR 2,000".
 */
export function fillNodes(text: string, vars: Record<string, ReactNode>, wrapText?: (s: string) => ReactNode): ReactNode {
  const parts = text.split(/(\{\{\s*\w+\s*\}\})/)
  return parts.map((p, i) => {
    const m = p.match(/^\{\{\s*(\w+)\s*\}\}$/)
    if (m && m[1] in vars) return <Fragment key={i}>{vars[m[1]]}</Fragment>
    if (!p) return null
    return <Fragment key={i}>{wrapText ? wrapText(p) : p}</Fragment>
  })
}

type Leaf<T> = { [K in keyof T & string]: T[K] extends string ? K : never }[keyof T & string]
type Key = { [G in keyof UiStrings & string]: `${G}.${Leaf<UiStrings[G]>}` }[keyof UiStrings & string]

// English section names used in page breadcrumbs -> their UI-strings key (so Urdu pages show Urdu).
const CRUMB_KEYS: Record<string, keyof UiStrings["crumbs"]> = {
  Services: "services",
  Help: "help",
  Areas: "areas",
  "Weddings & events": "weddings",
  "Report a problem": "report",
  "Refer & earn": "refer",
  "Rate your visit": "rate",
  Offers: "offers",
  "Mjazo Plus": "plus",
  Journal: "journal",
  "Home Pulse": "homePulse",
  "Gift cards": "giftCards",
  "Ghar Scan": "gharScan",
  "Get the app": "app",
  Contact: "contact",
  Careers: "careers",
  About: "about",
  "Mjazo for Business": "business",
  "Safety & trust": "safety",
  "How it works": "howItWorks",
}

/** A breadcrumb label: known section names are translated; anything else (a service's name) shows as it is. */
export function CrumbLabel({ label }: { label: string }) {
  const ui = useT()
  if (label === "Home") return <>{ui.common.home}</>
  const k = CRUMB_KEYS[label]
  return <>{k ? ui.crumbs[k] : label}</>
}

/** A UI string inside a server component: <T k="common.home" />, with optional {{tokens}}. */
export function T({ k, vars }: { k: Key; vars?: Record<string, string | number> }) {
  const ui = useT()
  const [g, key] = k.split(".") as [keyof UiStrings, string]
  const s = (ui[g] as Record<string, unknown>)[key]
  return <>{typeof s === "string" ? (vars ? fill(s, vars) : s) : k}</>
}
