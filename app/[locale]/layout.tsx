import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { CartDrawer } from "@/components/site/cart-drawer"
import { MobileBar, SmoothScroll } from "@/components/site/chrome"
import { ConciergeWidget } from "@/components/ai/concierge-widget"
import { SiteOnly } from "@/components/site/site-only"
import { PreviewBar } from "@/components/cms/preview-bar"
import { PreviewBridge } from "@/components/cms/preview-bridge"
import { SITE_URL } from "@/lib/site"
import { dirOf, LOCALES, OG_LOCALE } from "@/lib/i18n"
import { browserCatalog, getCatalogData, getNav, getSeoSettings, getSettings, getUi, isPreview } from "@/lib/cms/read"
import { pageLocale } from "@/lib/cms/locale"
import { CmsProvider } from "@/components/cms/provider"
import { fontVars } from "../fonts"
import "../globals.css"

// The public site's root layout, once per locale (/ and /ur). Staff apps have their own in (staff).
// No `dynamicParams = false` here: it would apply to every page below, so services, posts and block
// pages published after a deploy would 404 until the next one. proxy.ts only ever sends en or ur.

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await pageLocale(params)
  const [{ flags }, seo] = await Promise.all([getSettings(locale), getSeoSettings(locale)])
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: seo.defaultTitle, template: seo.titleTemplate.includes("%s") ? seo.titleTemplate : "%s · Mjazo" },
    description: seo.defaultDescription,
    applicationName: "Mjazo",
    keywords: seo.keywords,
    openGraph: { siteName: "Mjazo", type: "website", locale: OG_LOCALE[locale] },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
    verification: { ...(seo.googleVerification ? { google: seo.googleVerification } : {}), ...(seo.bingVerification ? { other: { "msvalidate.01": seo.bingVerification } } : {}) },
    // The Urdu site stays out of search results until it's switched on (Settings → Feature switches).
    ...(!seo.indexing || (locale === "ur" && !flags.URDU_SITE) ? { robots: { index: false, follow: false } } : {}),
  }
}

export const viewport: Viewport = { themeColor: "#f4a437", width: "device-width", initialScale: 1, viewportFit: "cover" }

export default async function RootLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const locale = await pageLocale(params)
  const [catalog, settings, nav, ui, preview] = await Promise.all([getCatalogData(locale), getSettings(locale), getNav(locale), getUi(locale), isPreview()])
  const { site } = settings
  const areas = catalog.areas
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Mjazo",
    description: site.positioning,
    url: site.url,
    logo: `${site.url}/icon`,
    image: `${site.url}/opengraph-image`,
    telephone: site.phone,
    email: site.email,
    priceRange: "PKR",
    sameAs: [site.instagram],
    openingHours: "Mo-Su 09:00-21:00",
    areaServed: areas.map((a) => `${a.name}, Karachi`),
    address: { "@type": "PostalAddress", addressLocality: "Karachi", addressCountry: "PK" },
  }

  const siteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Mjazo",
    url: site.url,
    inLanguage: locale === "ur" ? "ur-PK" : "en-PK",
    potentialAction: { "@type": "SearchAction", target: `${site.url}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
  }

  return (
    <html lang={locale} dir={dirOf(locale)} className={fontVars}>
      <body className="font-sans antialiased bg-background text-foreground">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <CmsProvider locale={locale} catalog={browserCatalog(catalog)} settings={settings} nav={{ header: nav.header, tabs: nav.tabs }} ui={ui}>
          <SiteOnly>
            <SmoothScroll />
            <Header />
          </SiteOnly>
          <main className="min-h-screen">{children}</main>
          <SiteOnly>
            <Footer worlds={catalog.worlds} liveAreas={catalog.areas.filter((a) => a.status === "live")} site={settings.site} nav={nav.footer} locale={locale} />
          </SiteOnly>
          <CartDrawer />
          <SiteOnly>
            <ConciergeWidget />
            <MobileBar />
          </SiteOnly>
          {preview && <PreviewBar />}
          {preview && <PreviewBridge />}
        </CmsProvider>
        <Analytics />
      </body>
    </html>
  )
}
