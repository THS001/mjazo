"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { buildCatalog, type CatalogData } from "@/lib/catalog"
import { waLink, type Settings } from "@/lib/site"

// Hands CMS content to client components. The root layout reads the catalogue and settings on the
// server (lib/cms/read.ts) and passes them here; components use useCatalog() / useSite() instead of
// importing static data, so edits in /admin reach every component.

type Value = { catalog: CatalogData; settings: Settings }
const Ctx = createContext<Value | null>(null)

export function CmsProvider({ catalog, settings, children }: Value & { children: ReactNode }) {
  const value = useMemo(() => ({ catalog, settings }), [catalog, settings])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function useCms() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useCatalog/useSite must be used inside <CmsProvider>")
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
