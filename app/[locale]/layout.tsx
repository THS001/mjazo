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
import { SITE_URL } from "@/lib/site"
import { dirOf, LOCALES, OG_LOCALE } from "@/lib/i18n"
import { getCatalogData, getNav, getSettings, getUi, isPreview } from "@/lib/cms/read"
import { pageLocale } from "@/lib/cms/locale"
import { CmsProvider } from "@/components/cms/provider"
import { fontVars } from "../fonts"
import "../globals.css"

// The public site's root layout, once per locale (/ and /ur). Staff apps have their own in (staff).

export const dynamicParams = false
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await pageLocale(params)
  const { flags } = await getSettings(locale)
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: "Mjazo · Home services in Karachi: salon at home, cleaning, AC & repairs", template: "%s · Mjazo" },
    description:
      "Book verified pros for salon at home, cleaning, AC service, repairs, health and care across Karachi. Women-only beauty pros, all-in prices, pay after the service.",
    applicationName: "Mjazo",
    keywords: ["home services Karachi", "salon at home Karachi", "beautician at home", "waxing at home", "AC service Karachi", "deep cleaning Karachi", "pest control Karachi", "electrician Karachi", "plumber Karachi", "mehndi artist Karachi"],
    openGraph: { siteName: "Mjazo", type: "website", locale: OG_LOCALE[locale] },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
    // The Urdu site stays out of search results until it's switched on (Settings → Feature switches).
    ...(locale === "ur" && !flags.URDU_SITE ? { robots: { index: false, follow: false } } : {}),
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
        <CmsProvider locale={locale} catalog={catalog} settings={settings} nav={{ header: nav.header, tabs: nav.tabs }} ui={ui}>
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
        </CmsProvider>
        <Analytics />
      </body>
    </html>
  )
}
