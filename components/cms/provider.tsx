"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { buildCatalog, type CatalogData } from "@/lib/catalog"
import { waLink, type Settings } from "@/lib/site"
import type { NavContent } from "@/lib/cms/types/nav"

// Hands CMS content to client components. The root layout reads the catalogue and settings on the
// server (lib/cms/read.ts) and passes them here; components use useCatalog() / useSite() / useNav() instead of
// importing static data, so edits in /admin reach every component.

// Only the header and tab bar run in the browser; the footer is server-rendered and gets its part as props.
type Value = { catalog: CatalogData; settings: Settings; nav: Pick<NavContent, "header" | "tabs"> }
const Ctx = createContext<Value | null>(null)

export function CmsProvider({ catalog, settings, nav, children }: Value & { children: ReactNode }) {
  const value = useMemo(() => ({ catalog, settings, nav }), [catalog, settings, nav])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function useCms() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useCatalog/useSite/useNav must be used inside <CmsProvider>")
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
