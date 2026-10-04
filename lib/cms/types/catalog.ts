import { DEFAULT_CATALOG, type Area, type Bundle, type Category, type Service, type World } from "@/lib/catalog"
import { f } from "../fields"
import { register } from "../registry"
import { seoGroup } from "./seo"

// Catalogue content types: worlds, categories, services, areas and bundles. Services are their
// own collection (one editor per service, with a price table across all of them) and are nested
// back under their category when the catalogue is assembled (lib/cms/read.ts).

const STATUS = [
  { value: "live", label: "Live" },
  { value: "waitlist", label: "Waitlist" },
  { value: "hidden", label: "Hidden" },
]
const faqList = f.list("FAQs", f.group("FAQ", { q: f.text("Question", { required: true }), a: f.textarea("Answer", { required: true }) }), { itemLabel: "q" })

export const worldType = register<World, World>({
  type: "world",
  label: "World",
  plural: "Worlds",
  group: "Catalogue",
  kind: "collection",
  icon: "Globe",
  description: "The eight service worlds on the home page and services index.",
  tags: ["catalog"],
  fields: {
    name: f.text("Name", { required: true, max: 40 }),
    slug: f.slug(),
    short: f.text("Short line", { max: 60 }),
    bgWord: f.text("Giant background word", { max: 8, help: "The big pale word behind section titles, e.g. GLOW." }),
    icon: f.icon("Icon"),
    object: f.select("3D object", ["lipstick", "spray", "shield", "ac", "wrench", "stethoscope", "heart", "box"]),
    tint: f.color("Tint"),
    image: f.image("Card photo", { help: "Shown on the world's card on the home page. Without one, the icon on its tint shows." }),
    model: f.model("3D model (GLB)", { help: "Replaces the built-in 3D object on the world page. Keep it under 5 MB." }),
    seo: seoGroup("Overrides the world page's title pattern (Settings → SEO settings)."),
  },
  defaults: () => DEFAULT_CATALOG.worlds,
  idOf: (w) => w.slug,
  titleOf: (w) => w.name,
  path: (w) => `/services/w/${w.slug}`,
})

type CategoryCms = Omit<Category, "faqs" | "services"> & { faqs: { q: string; a: string }[] }
export const categoryType = register<Category, CategoryCms>({
  type: "category",
  label: "Category",
  plural: "Categories",
  group: "Catalogue",
  kind: "collection",
  icon: "LayoutGrid",
  description: "Service categories (Women's Salon, AC Services, ...) with their promises and FAQs.",
  tags: ["catalog"],
  columns: [
    { key: "world", label: "World", format: "ref" },
    { key: "status", label: "Status", format: "status" },
  ],
  fields: {
    name: f.text("Name", { required: true, max: 40 }),
    slug: f.slug(),
    world: f.ref("World", "world", { required: true }),
    status: f.select("Status", STATUS),
    icon: f.icon("Icon"),
    proType: f.select("Pro type", [
      { value: "women", label: "Women-only pros" },
      { value: "technician", label: "Verified technicians" },
      { value: "care", label: "Licensed carers" },
    ]),
    tagline: f.text("Tagline", { max: 80 }),
    heroLine: f.textarea("Hero line", { max: 200 }),
    includes: f.list("What's included", f.text("Item")),
    excludes: f.list("Not included", f.text("Item")),
    faqs: faqList,
    image: f.image("Hero photo", { help: "Shown in the category page's heading. Without one, the tint and icon show." }),
    seo: seoGroup("Overrides the category page's title pattern (Settings → SEO settings)."),
  },
  defaults: () => DEFAULT_CATALOG.categories,
  idOf: (c) => c.slug,
  toCms: ({ services, faqs, ...c }) => ({ ...c, faqs: faqs.map(([q, a]) => ({ q, a })) }),
  toSite: (c) => ({ ...c, faqs: (c.faqs ?? []).map(({ q, a }) => [q, a] as [string, string]), services: [] }),
  titleOf: (c) => c.name,
  path: (c) => `/services/${c.slug}`,
})

export type ServiceCms = Service & { category: string }
export const serviceType = register<ServiceCms, ServiceCms>({
  type: "service",
  label: "Service",
  plural: "Services",
  group: "Catalogue",
  kind: "collection",
  icon: "Tag",
  description: "Every bookable service with its price, duration, options and add-ons.",
  tags: ["catalog"],
  columns: [
    { key: "category", label: "Category", format: "ref" },
    { key: "price", label: "Price", format: "price" },
  ],
  fields: {
    name: f.text("Name", { required: true, max: 60 }),
    slug: f.slug(),
    category: f.ref("Category", "category", { required: true }),
    short: f.text("Short description", { max: 120 }),
    price: f.price("From price (PKR)", { help: "0 shows “On request”." }),
    duration: f.number("Duration", { unit: "min", min: 0, step: 5, help: "0 shows “Flexible”." }),
    popular: f.boolean("Popular", { help: "Shown in “Most booked” and boosted in search." }),
    image: f.image("Photo", { help: "Shown on the service page and its cards. Without one, the category icon on its tint shows." }),
    seo: seoGroup("Overrides the service page's title pattern (Settings → SEO settings)."),
    includes: f.list("What's included", f.text("Item")),
    variants: f.list(
      "Options",
      f.group("Option", {
        label: f.text("Option name", { required: true }),
        options: f.list("Choices", f.group("Choice", { label: f.text("Label", { required: true }), delta: f.price("Price change (PKR)") }), { itemLabel: "label" }),
      }),
      { itemLabel: "label" },
    ),
    addOns: f.list("Add-ons", f.group("Add-on", { id: f.code("ID", { required: true }), name: f.text("Name", { required: true }), price: f.price("Price (PKR)") }), { itemLabel: "name" }),
  },
  defaults: () => DEFAULT_CATALOG.categories.flatMap((c) => c.services.map((s) => ({ ...s, category: c.slug }))),
  idOf: (s) => s.slug,
  titleOf: (s) => s.name,
  path: (s) => `/services/${s.category}/${s.slug}`,
})

export const areaType = register<Area, Area>({
  type: "area",
  label: "Area",
  plural: "Areas",
  group: "Catalogue",
  kind: "collection",
  icon: "MapPin",
  description: "Karachi neighbourhoods Mjazo serves.",
  tags: ["catalog"],
  columns: [{ key: "status", label: "Status", format: "status" }],
  fields: {
    name: f.text("Name", { required: true, max: 40 }),
    slug: f.slug(),
    status: f.select("Status", STATUS),
    blurb: f.textarea("Blurb", { max: 200 }),
    subAreas: f.list("Sub-areas", f.text("Sub-area")),
    seo: seoGroup("Overrides the area page's title pattern (Settings → SEO settings)."),
  },
  defaults: () => DEFAULT_CATALOG.areas,
  idOf: (a) => a.slug,
  titleOf: (a) => a.name,
  path: (a) => `/karachi/${a.slug}`,
})

export const bundleType = register<Bundle, Bundle>({
  type: "bundle",
  label: "Bundle",
  plural: "Bundles",
  group: "Catalogue",
  kind: "collection",
  icon: "Package",
  description: "Signature bundles on the home and offers pages.",
  tags: ["catalog"],
  columns: [
    { key: "price", label: "Price", format: "price" },
    { key: "status", label: "Status", format: "status" },
  ],
  fields: {
    name: f.text("Name", { required: true, max: 50 }),
    slug: f.slug(),
    status: f.select("Status", STATUS),
    price: f.price("Bundle price (PKR)", { help: "0 shows “On request”." }),
    note: f.textarea("Note", { max: 160 }),
    items: f.list("Services in the bundle", f.group("Item", { category: f.ref("Category", "category", { required: true }), service: f.ref("Service", "service", { required: true }) }), { itemLabel: "service" }),
  },
  defaults: () => DEFAULT_CATALOG.bundles,
  idOf: (b) => b.slug,
  titleOf: (b) => b.name,
  path: () => "/offers",
})

type CatalogRules = { minOrder: number; coverage: string }
export const catalogRulesType = register<CatalogRules, CatalogRules>({
  type: "settings-catalog",
  label: "Catalogue rules",
  group: "Settings",
  kind: "singleton",
  icon: "Scale",
  perm: "settings",
  tags: ["catalog"],
  fields: {
    minOrder: f.price("Minimum order (PKR)"),
    coverage: f.text("Coverage line", { help: "e.g. “across Karachi”." }),
  },
  defaults: () => ({ minOrder: DEFAULT_CATALOG.minOrder, coverage: DEFAULT_CATALOG.coverage }),
})

type SearchSite = { synonyms: Record<string, string>; stopWords: string[] }
type SearchCms = { synonyms: { term: string; adds: string }[]; stopWords: string[] }
export const searchType = register<SearchSite, SearchCms>({
  type: "settings-search",
  label: "Search vocabulary",
  group: "Settings",
  kind: "singleton",
  icon: "Search",
  perm: "settings",
  tags: ["catalog"],
  description: "Synonyms (including Roman Urdu) and filler words for the service search and the Concierge.",
  fields: {
    synonyms: f.list("Synonyms", f.group("Synonym", { term: f.code("When someone types", { required: true }), adds: f.code("Also search for", { required: true }) }), { itemLabel: "term" }),
    stopWords: f.list("Ignored words", f.code("Word")),
  },
  defaults: () => ({ synonyms: DEFAULT_CATALOG.synonyms, stopWords: DEFAULT_CATALOG.stopWords }),
  toCms: (s) => ({ synonyms: Object.entries(s.synonyms).map(([term, adds]) => ({ term, adds })), stopWords: s.stopWords }),
  toSite: (c) => ({ synonyms: Object.fromEntries((c.synonyms ?? []).map(({ term, adds }) => [term, adds])), stopWords: c.stopWords ?? [] }),
})
