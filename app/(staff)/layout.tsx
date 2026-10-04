import type React from "react"
import type { Metadata, Viewport } from "next"
import { SITE_URL } from "@/lib/site"
import { getCatalogData, getNav, getSettings, getUi } from "@/lib/cms/read"
import { setRequestLocale } from "@/lib/cms/locale"
import { CmsProvider } from "@/components/cms/provider"
import { fontVars } from "../fonts"
import "../globals.css"

// Root layout for the staff apps (/admin, /ops, /pro): no marketing chrome, never indexed, English.

export const metadata: Metadata = { metadataBase: new URL(SITE_URL), title: { default: "Mjazo staff", template: "%s · Mjazo" }, robots: { index: false, follow: false } }
export const viewport: Viewport = { themeColor: "#111111", width: "device-width", initialScale: 1, viewportFit: "cover" }

export default async function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  setRequestLocale("en")
  const [catalog, settings, nav, ui] = await Promise.all([getCatalogData("en"), getSettings("en"), getNav("en"), getUi("en")])
  return (
    <html lang="en" dir="ltr" className={fontVars}>
      <body className="font-sans antialiased bg-background text-foreground">
        <CmsProvider locale="en" catalog={catalog} settings={settings} nav={{ header: nav.header, tabs: nav.tabs }} ui={ui}>
          {children}
        </CmsProvider>
      </body>
    </html>
  )
}
