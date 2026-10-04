import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Playfair_Display, Noto_Nastaliq_Urdu } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { CartDrawer } from "@/components/site/cart-drawer"
import { MobileBar, SmoothScroll } from "@/components/site/chrome"
import { ConciergeWidget } from "@/components/ai/concierge-widget"
import { SiteOnly } from "@/components/site/site-only"
import { SITE_URL } from "@/lib/site"
import { getCatalogData, getNav, getSettings } from "@/lib/cms/read"
import { CmsProvider } from "@/components/cms/provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" })
const urdu = Noto_Nastaliq_Urdu({ subsets: ["arabic"], weight: ["400", "600"], variable: "--font-urdu-nastaliq", display: "swap" })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Mjazo · Home services in Karachi: salon at home, cleaning, AC & repairs", template: "%s · Mjazo" },
  description:
    "Book verified pros for salon at home, cleaning, AC service, repairs, health and care across Karachi. Women-only beauty pros, all-in prices, pay after the service.",
  applicationName: "Mjazo",
  keywords: ["home services Karachi", "salon at home Karachi", "beautician at home", "waxing at home", "AC service Karachi", "deep cleaning Karachi", "pest control Karachi", "electrician Karachi", "plumber Karachi", "mehndi artist Karachi"],
  openGraph: { siteName: "Mjazo", type: "website", locale: "en_PK" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = { themeColor: "#f4a437", width: "device-width", initialScale: 1, viewportFit: "cover" }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [catalog, settings, nav] = await Promise.all([getCatalogData(), getSettings(), getNav()])
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
    potentialAction: { "@type": "SearchAction", target: `${site.url}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
  }

  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${urdu.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <CmsProvider catalog={catalog} settings={settings} nav={{ header: nav.header, tabs: nav.tabs }}>
          <SiteOnly>
            <SmoothScroll />
            <Header />
          </SiteOnly>
          <main className="min-h-screen">{children}</main>
          <SiteOnly>
            <Footer worlds={catalog.worlds} liveAreas={catalog.areas.filter((a) => a.status === "live")} site={settings.site} nav={nav.footer} />
          </SiteOnly>
          <CartDrawer />
          <SiteOnly>
            <ConciergeWidget />
            <MobileBar />
          </SiteOnly>
        </CmsProvider>
        <Analytics />
      </body>
    </html>
  )
}
