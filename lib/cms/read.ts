import "server-only"
import { cache } from "react"
import { unstable_cache } from "next/cache"
import { draftMode } from "next/headers"
import { buildCatalog, type Area, type Bundle, type Category, type World } from "@/lib/catalog"
import { DEFAULT_SETTINGS, SITE_URL, waLink, type Settings } from "@/lib/site"
import { localizeObject, resolveObject, tokensDeep, zodObject, type Locale, type TokenContext } from "./fields"
import { getType, type ContentType } from "./registry"
import { listRows, type Data, type EntryRow } from "./store"
import type { ServiceCms } from "./types/catalog"
import type { NavContent } from "./types/nav"
import "./types"

// The public site's view of the CMS. Published content is cached per type (tag `cms:<type>`) and
// merged over the built-in defaults, so the site works with no database and survives bad data:
// an entry that fails validation falls back to its default and is logged.
// In preview (Next draft mode) drafts are read live, uncached.

export const SINGLETON = "main"

type Slim = Pick<EntryRow, "id" | "status" | "published" | "position">
const publishedRows = (type: string) =>
  unstable_cache(
    async (): Promise<Slim[]> =>
      (await listRows(type)).map((r) => ({ id: r.id, status: r.status, published: r.published, position: r.position })),
    ["cms-rows", type],
    { tags: ["cms", `cms:${type}`] },
  )()

/** Preview mode: an editor clicked "Preview". Outside a request (build-time params) it is always off. */
export async function isPreview() {
  try {
    return (await draftMode()).isEnabled
  } catch {
    return false
  }
}

async function rowsFor(type: string, preview: boolean): Promise<(Slim & { data: Data | null })[]> {
  try {
    if (preview) return (await listRows(type)).map((r) => ({ ...r, data: r.draft ?? r.published }))
    return (await publishedRows(type)).map((r) => ({ ...r, data: r.published }))
  } catch (e) {
    console.error(`[cms] reading ${type} failed; using built-in content`, e)
    return []
  }
}

/** One stored entry -> the site's shape for a locale (or null if it is invalid). */
function toSite<S>(t: ContentType<S, unknown>, data: Data, base: S | undefined, locale: Locale, ctx?: TokenContext): S | null {
  // Fields added to a type after an entry was saved take their default value.
  const merged = base !== undefined ? { ...localizeObject(t.fields, (t.toCms ? t.toCms(base) : base) as Data), ...data } : data
  const parsed = zodObject(t.fields).safeParse(merged)
  if (!parsed.success) {
    console.error(`[cms] invalid ${t.type} entry; using built-in content`, parsed.error.issues.slice(0, 3))
    return null
  }
  const cms = resolveObject(t.fields, merged, locale, ctx)
  return (t.toSite ? t.toSite(cms) : cms) as S
}

/** A collection: defaults, overridden by published entries, minus deleted ones, in editor order. */
export async function getCollection<S>(type: string, locale: Locale = "en", ctx?: TokenContext): Promise<S[]> {
  const t = getType(type) as ContentType<S, unknown> | undefined
  if (!t || t.kind !== "collection") throw new Error(`Unknown CMS collection: ${type}`)
  const defaults = t.defaults() as S[]
  const items = new Map<string, { pos: number; value: S }>()
  defaults.forEach((d, i) => items.set(t.idOf!(d), { pos: i, value: tokensDeep(d, ctx) }))
  const preview = await isPreview()
  for (const row of await rowsFor(type, preview)) {
    if (row.status === "archived") {
      items.delete(row.id)
      continue
    }
    const base = items.get(row.id)
    if (!row.data) {
      // A built-in item that was only reordered, or a draft that was never published.
      if (base && row.position !== null) base.pos = row.position
      continue
    }
    const value = toSite(t, row.data, base?.value, locale, ctx)
    if (value === null) continue
    items.set(row.id, { pos: row.position ?? base?.pos ?? 100_000, value })
  }
  return [...items.values()].sort((a, b) => a.pos - b.pos).map((x) => x.value)
}

/** A singleton (a page or a settings group): its published entry, else the default. */
export async function getSingleton<S>(type: string, locale: Locale = "en", ctx?: TokenContext): Promise<S> {
  const t = getType(type) as ContentType<S, unknown> | undefined
  if (!t || t.kind !== "singleton") throw new Error(`Unknown CMS singleton: ${type}`)
  const base = t.defaults() as S
  const row = (await rowsFor(type, await isPreview())).find((r) => r.id === SINGLETON)
  if (!row?.data || row.status === "archived") return tokensDeep(base, ctx)
  return toSite(t, row.data, base, locale, ctx) ?? tokensDeep(base, ctx)
}

// ---------------------------------------------------------------------------
// Settings and the catalogue (memoised per request)
// ---------------------------------------------------------------------------

export const getSettings = cache(async (locale: Locale = "en"): Promise<Settings> => {
  const [site, policy, money, flags] = await Promise.all([
    getSingleton<Omit<Settings["site"], "url">>("settings-site", locale),
    getSingleton<Settings["policy"]>("settings-policy", locale),
    getSingleton<Pick<Settings, "plus" | "referral">>("settings-plus", locale),
    getSingleton<Settings["flags"]>("settings-flags", locale),
  ])
  return { site: { ...DEFAULT_SETTINGS.site, ...site, url: SITE_URL }, policy, plus: money.plus, referral: money.referral, flags }
})

/** A wa.me link to Mjazo's WhatsApp (the number set in Settings → Company & contact). */
export async function whatsappLink(message: string) {
  return waLink((await getSettings()).site.whatsapp, message)
}

/** Settings values for {{tokens}}: {{site.phone}}, {{policy.freeChangeHours}}, {{plus.price}}, {{plus.discountPct}}, ... */
const getSettingsTokens = cache(async (locale: Locale = "en"): Promise<TokenContext> => {
  const s = await getSettings(locale)
  const pkr = (n: number) => `PKR ${n.toLocaleString("en-PK")}`
  return {
    ...s,
    site: { ...s.site, hoursLower: s.site.hours.toLowerCase() },
    plus: { ...s.plus, discountPct: Math.round(s.plus.discount * 100), priceText: pkr(s.plus.price) },
    referral: { ...s.referral, friendOffText: pkr(s.referral.friendOff), youGetText: pkr(s.referral.youGet) },
  }
})

/** Every token for page copy: settings plus catalogue facts ({{catalog.areaCount}}, {{catalog.areaNames}}, ...). */
export const getTokens = cache(async (locale: Locale = "en"): Promise<TokenContext> => {
  const [base, cat] = await Promise.all([getSettingsTokens(locale), getCatalog(locale)])
  const live = cat.liveAreas
  return {
    ...base,
    catalog: {
      worldCount: cat.worlds.length,
      areaCount: live.length,
      areaNames: live.map((a) => a.name).join(", "),
      categoryCount: cat.visibleCategories.length,
      serviceCount: cat.serviceCount,
      minOrder: cat.MIN_ORDER.toLocaleString("en-PK"),
      coverage: cat.COVERAGE,
    },
  }
})

/** A page's editable content (a `page-<id>` singleton), with {{tokens}} filled in. */
export async function getPage<S>(id: string, locale: Locale = "en"): Promise<S> {
  return getSingleton<S>(`page-${id}`, locale, await getTokens(locale))
}

/** Header, mobile tab bar and footer (the `nav` singleton), with {{tokens}} filled in. */
export const getNav = cache(async (locale: Locale = "en") => getSingleton<NavContent>("nav", locale, await getTokens(locale)))

/** A content collection (posts, help topics, ...) with {{tokens}} filled in. */
export async function getContent<S>(type: string, locale: Locale = "en"): Promise<S[]> {
  return getCollection<S>(type, locale, await getTokens(locale))
}

export const getCatalogData = cache(async (locale: Locale = "en") => {
  const ctx = await getSettingsTokens(locale)
  const [worlds, categories, services, areas, bundles, rules, search] = await Promise.all([
    getCollection<World>("world", locale, ctx),
    getCollection<Category>("category", locale, ctx),
    getCollection<ServiceCms>("service", locale, ctx),
    getCollection<Area>("area", locale, ctx),
    getCollection<Bundle>("bundle", locale, ctx),
    getSingleton<{ minOrder: number; coverage: string }>("settings-catalog", locale, ctx),
    getSingleton<{ synonyms: Record<string, string>; stopWords: string[] }>("settings-search", locale),
  ])
  const byCategory = new Map<string, ServiceCms[]>()
  for (const s of services) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s])
  return {
    worlds,
    categories: categories.map((c) => ({ ...c, services: (byCategory.get(c.slug) ?? []).map(({ category, ...s }) => s) })),
    areas,
    bundles,
    minOrder: rules.minOrder,
    coverage: rules.coverage,
    synonyms: search.synonyms,
    stopWords: search.stopWords,
  }
})

export const getCatalog = cache(async (locale: Locale = "en") => buildCatalog(await getCatalogData(locale)))
