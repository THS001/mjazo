import { f, type Fields, type GroupField, type Img } from "../fields"
import { register } from "../registry"

// SEO: the per-page group (title, description, focus keyword, share image, noindex, canonical),
// and site-wide SEO settings (defaults, title patterns for the template pages, robots, verification).

export type Seo = { title?: string; description?: string; keyword?: string; image?: Img; noindex?: boolean; canonical?: string }

/** The SEO group added to every page and every catalogue / editorial item. Editable by the SEO role. */
export const seoGroup = (help = "How this page appears in Google and when shared. Empty fields use the built-in title and description."): GroupField =>
  f.group(
    "SEO",
    {
      title: f.text("Search title", { max: 60, perm: "seo", help: "Shown in Google and the browser tab (30–60 characters). “· Mjazo” is added for you." }),
      description: f.textarea("Search description", { max: 160, perm: "seo", help: "The grey text under the title in Google (70–160 characters)." }),
      keyword: f.text("Focus keyword", { perm: "seo", help: "The phrase this page should rank for, e.g. “waxing at home Karachi”. The SEO score checks it." }),
      image: f.image("Share image", { perm: "seo", help: "Shown when the page is shared on WhatsApp or social media. A JPG or PNG of 1200 × 630 works best." }),
      noindex: f.boolean("Hide from search engines", { perm: "seo" }),
      canonical: f.code("Canonical address", { perm: "seo", help: "Only if this page copies another one: its path (/services) or full address." }),
    },
    { help, ui: "seo" },
  )

// ---------------------------------------------------------------------------
// Site-wide SEO settings
// ---------------------------------------------------------------------------

export type SeoSettings = {
  titleTemplate: string
  defaultTitle: string
  defaultDescription: string
  defaultImage?: Img
  keywords: string[]
  indexing: boolean
  disallow: string[]
  googleVerification: string
  bingVerification: string
  patterns: {
    worldTitle: string
    worldDescription: string
    categoryTitle: string
    categoryDescription: string
    categoryDescriptionSoon: string
    serviceTitle: string
    serviceTitleNoPrice: string
    serviceDescription: string
    serviceDescriptionNoPrice: string
    serviceDescriptionSoon: string
    areaTitle: string
    areaDescription: string
    areaCategoryTitle: string
    areaCategoryDescription: string
    areaCategoryDescriptionSoon: string
    helpTitle: string
    legalDescription: string
  }
}

export const SEO_DEFAULTS: SeoSettings = {
  titleTemplate: "%s · Mjazo",
  defaultTitle: "Mjazo · Home services in Karachi: salon at home, cleaning, AC & repairs",
  defaultDescription: "Book verified pros for salon at home, cleaning, AC service, repairs, health and care across Karachi. Women-only beauty pros, all-in prices, pay after the service.",
  keywords: ["home services Karachi", "salon at home Karachi", "beautician at home", "waxing at home", "AC service Karachi", "deep cleaning Karachi", "pest control Karachi", "electrician Karachi", "plumber Karachi", "mehndi artist Karachi"],
  indexing: true,
  disallow: ["/api/", "/admin", "/checkout", "/cart", "/account", "/login", "/booking/", "/search", "/ops", "/pro$", "/pro/", "/partner/interview/"],
  googleVerification: "",
  bingVerification: "",
  patterns: {
    worldTitle: "{{world}} at home in Karachi: book verified pros",
    worldDescription: "Book {{worldLower}} at home across Karachi: {{categories}}. All-in prices, pay after.",
    categoryTitle: "{{category}} at home in Karachi: {{tagline}}",
    categoryDescription: "{{tagline}}. Book verified pros across Karachi with all-in prices. Pay after the service.",
    categoryDescriptionSoon: "{{tagline}}. Coming soon: join the waitlist.",
    serviceTitle: "{{service}} at home in Karachi from {{price}}",
    serviceTitleNoPrice: "{{service}} at home in Karachi",
    serviceDescription: "{{short}} From {{price}}, all-in. Book across Karachi, pay after.",
    serviceDescriptionNoPrice: "{{short}} Book across Karachi, pay after.",
    serviceDescriptionSoon: "{{short}} Coming soon.",
    areaTitle: "Home services in {{area}}, Karachi: salon at home, cleaning, AC & repairs",
    areaDescription: "Verified pros at your door across {{area}}: {{subAreas}}. Salon and spa at home, cleaning, AC service, repairs and more. All-in prices, pay after.",
    areaCategoryTitle: "{{category}} at home in {{area}}, Karachi",
    areaCategoryDescription: "{{tagline}} in {{area}}. Book today with all-in prices and pay after.",
    areaCategoryDescriptionSoon: "{{tagline}} in {{area}}. Coming soon: join the waitlist.",
    helpTitle: "{{topic}}: help & answers",
    legalDescription: "{{title}} for Mjazo home services in Karachi.",
  },
}

const SEO_UR = {
  titleTemplate: "%s · مجازو",
  defaultTitle: "مجازو · کراچی میں گھر پر سروسز: بیوٹی، صفائی، اے سی اور مرمت",
  defaultDescription: "کراچی بھر میں گھر پر بیوٹی، صفائی، اے سی سروس، مرمت، صحت اور نگہداشت کے لیے تصدیق شدہ پروز بُک کریں۔ بیوٹی کے لیے صرف خواتین پروز، قیمت میں سب کچھ شامل، ادائیگی سروس کے بعد۔",
  patterns: {
    worldTitle: "کراچی میں گھر پر {{world}}: تصدیق شدہ پروز بُک کریں",
    worldDescription: "کراچی بھر میں گھر پر {{world}} بُک کریں: {{categories}}۔ قیمت میں سب کچھ شامل، ادائیگی بعد میں۔",
    categoryTitle: "کراچی میں گھر پر {{category}}: {{tagline}}",
    categoryDescription: "{{tagline}}۔ کراچی بھر میں تصدیق شدہ پروز بُک کریں، قیمت میں سب کچھ شامل۔ ادائیگی سروس کے بعد۔",
    categoryDescriptionSoon: "{{tagline}}۔ جلد آ رہا ہے: ویٹ لسٹ میں نام لکھوائیں۔",
    serviceTitle: "کراچی میں گھر پر {{service}}، {{price}} سے شروع",
    serviceTitleNoPrice: "کراچی میں گھر پر {{service}}",
    serviceDescription: "{{short}} {{price}} سے شروع، سب کچھ شامل۔ کراچی بھر میں بُک کریں، ادائیگی بعد میں۔",
    serviceDescriptionNoPrice: "{{short}} کراچی بھر میں بُک کریں، ادائیگی بعد میں۔",
    serviceDescriptionSoon: "{{short}} جلد آ رہا ہے۔",
    areaTitle: "{{area}}، کراچی میں گھر پر سروسز: بیوٹی، صفائی، اے سی اور مرمت",
    areaDescription: "{{area}} بھر میں آپ کی دہلیز پر تصدیق شدہ پروز: {{subAreas}}۔ گھر پر بیوٹی اور اسپا، صفائی، اے سی سروس، مرمت اور بہت کچھ۔ قیمت میں سب کچھ شامل، ادائیگی بعد میں۔",
    areaCategoryTitle: "{{area}}، کراچی میں گھر پر {{category}}",
    areaCategoryDescription: "{{area}} میں {{tagline}}۔ آج ہی بُک کریں، قیمت میں سب کچھ شامل اور ادائیگی بعد میں۔",
    areaCategoryDescriptionSoon: "{{area}} میں {{tagline}}۔ جلد آ رہا ہے: ویٹ لسٹ میں نام لکھوائیں۔",
    helpTitle: "{{topic}}: مدد اور جوابات",
    legalDescription: "کراچی میں مجازو ہوم سروسز کے لیے {{title}}۔",
  },
}

const pattern = (label: string, tokens: string) => f.text(label, { perm: "seo", help: `Tokens: ${tokens}` })
const fields: Fields = {
  titleTemplate: f.text("Title ending", { perm: "seo", help: "%s is the page's own title, e.g. “%s · Mjazo”." }),
  defaultTitle: f.text("Home page / fallback title", { perm: "seo", max: 70 }),
  defaultDescription: f.textarea("Fallback description", { perm: "seo", max: 160 }),
  defaultImage: f.image("Default share image", { perm: "seo", help: "Used when a page has no share image of its own. Empty: the generated Mjazo card." }),
  keywords: f.list("Keywords", f.text("Keyword", { perm: "seo" })),
  indexing: f.boolean("Let search engines index the site", { perm: "seo", help: "Switch off only for a staging copy of the site." }),
  disallow: f.list("Paths robots shouldn't crawl", f.code("Path", { perm: "seo" })),
  googleVerification: f.code("Google Search Console verification code", { perm: "seo" }),
  bingVerification: f.code("Bing Webmaster verification code", { perm: "seo" }),
  patterns: f.group(
    "Title and description patterns",
    {
      worldTitle: pattern("World page title", "{{world}}"),
      worldDescription: pattern("World page description", "{{world}}, {{worldLower}}, {{categories}}"),
      categoryTitle: pattern("Category page title", "{{category}}, {{tagline}}"),
      categoryDescription: pattern("Category page description", "{{category}}, {{tagline}}"),
      categoryDescriptionSoon: pattern("Category description (coming soon)", "{{category}}, {{tagline}}"),
      serviceTitle: pattern("Service page title", "{{service}}, {{price}}, {{category}}"),
      serviceTitleNoPrice: pattern("Service title (price on request)", "{{service}}, {{category}}"),
      serviceDescription: pattern("Service page description", "{{service}}, {{short}}, {{price}}"),
      serviceDescriptionNoPrice: pattern("Service description (price on request)", "{{service}}, {{short}}"),
      serviceDescriptionSoon: pattern("Service description (coming soon)", "{{service}}, {{short}}"),
      areaTitle: pattern("Area page title", "{{area}}"),
      areaDescription: pattern("Area page description", "{{area}}, {{subAreas}}"),
      areaCategoryTitle: pattern("Area + category page title", "{{category}}, {{area}}"),
      areaCategoryDescription: pattern("Area + category description", "{{category}}, {{area}}, {{tagline}}"),
      areaCategoryDescriptionSoon: pattern("Area + category description (coming soon)", "{{category}}, {{area}}, {{tagline}}"),
      helpTitle: pattern("Help topic title", "{{topic}}"),
      legalDescription: pattern("Legal page description", "{{title}}"),
    },
    { help: "Used for every world, category, service, area and help page unless the item has its own SEO title or description." },
  ),
}

register<SeoSettings, SeoSettings>({
  type: "settings-seo",
  label: "SEO settings",
  group: "Settings",
  kind: "singleton",
  icon: "Search",
  description: "Defaults for search engines and sharing, title patterns for the template pages, and what robots may crawl.",
  tags: ["settings"],
  fields,
  defaults: () => SEO_DEFAULTS,
  translations: { ur: () => SEO_UR },
  path: () => "/",
})
