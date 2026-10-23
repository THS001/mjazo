import type { buildCatalog, Pack } from "./catalog"
import { priceItems, type ClientItem } from "./core/pricing"

// Packs (lib/catalog.ts): prepaid visits of one service or bundle. What each visit is as a booking
// line, and the terms the customer sees, priced from the catalogue as checkout would price it.
// Shared by the server (booking with a pack, the account API) and the browser (the offers page).

type Catalog = ReturnType<typeof buildCatalog>

/** One visit of the pack as a booking line, or null when its service can't be booked now. */
export function packItem(p: Pack, cat: Catalog): ClientItem | null {
  if (p.bundle) {
    const b = cat.bundles.find((x) => x.slug === p.bundle && x.status === "live")
    if (!b?.items.length) return null
    return { name: b.name, category: b.items[0].category, service: `bundle-${b.slug}`, options: [], addOns: [], qty: 1 }
  }
  const found = p.category && p.service ? cat.getService(p.category, p.service) : undefined
  if (!found || found.category.status !== "live") return null
  return { name: found.service.name, category: found.category.slug, service: found.service.slug, options: p.options ?? [], addOns: [], qty: 1 }
}

export type PackOffer = {
  slug: string
  name: string
  note: string
  item: ClientItem
  visits: number
  visitPrice: number
  /** The service's own price for one visit. */
  listPrice: number
  /** Paid upfront: visits × the pack's price a visit. */
  total: number
  /** Saved over the whole pack. */
  saving: number
  everyDays: number
  validDays: number
}

/** A live pack's terms, or null when it's off, its service can't be booked or its numbers are wrong. */
export function packOffer(p: Pack, cat: Catalog): PackOffer | null {
  if (p.status !== "live" || !(p.visits >= 1 && p.visitPrice > 0 && p.everyDays >= 1 && p.validDays >= 7)) return null
  const item = packItem(p, cat)
  if (!item) return null
  let listPrice: number
  try {
    listPrice = priceItems([item], cat).subtotal
  } catch {
    return null
  }
  return {
    slug: p.slug,
    name: p.name,
    note: p.note,
    item,
    visits: p.visits,
    visitPrice: p.visitPrice,
    listPrice,
    total: p.visits * p.visitPrice,
    saving: Math.max(0, (listPrice - p.visitPrice) * p.visits),
    everyDays: p.everyDays,
    validDays: p.validDays,
  }
}

export const packOffers = (cat: Catalog) => cat.packs.map((p) => packOffer(p, cat)).filter((o): o is PackOffer => o !== null)

/** Whether a booking line is one visit of this pack's item (same service or bundle, same options). */
export const isPackLine = (line: Pick<ClientItem, "category" | "service" | "options">, item: Pick<ClientItem, "category" | "service" | "options">) =>
  line.service === item.service && (item.service.startsWith("bundle-") || (line.category === item.category && JSON.stringify(line.options ?? []) === JSON.stringify(item.options ?? [])))
