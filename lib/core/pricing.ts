import type { Catalog } from "@/lib/catalog"
import type { JobItem } from "@/lib/ops/types"

// Server-side pricing: every booking line is priced from the catalogue, never from what the
// browser sent. Options are the variant labels in variant order (as the service page sends them);
// add-ons may be given by name or id. Bundles are "bundle-<slug>" lines at the bundle price.

export type ClientItem = { name: string; category: string; service: string; options: string[]; addOns: string[]; qty: number; unitPrice?: number }
export type PricedItem = JobItem & { duration: number }

export class PricingError extends Error {}

export function priceItems(items: ClientItem[], cat: Catalog): { items: PricedItem[]; subtotal: number; changed: boolean } {
  const out: PricedItem[] = []
  let changed = false
  for (const it of items) {
    const qty = Math.min(10, Math.max(1, Math.round(it.qty)))
    let line: PricedItem
    if (it.service.startsWith("bundle-")) {
      const bundle = cat.bundles.find((b) => b.slug === it.service.slice(7))
      if (!bundle || bundle.status !== "live") throw new PricingError(`"${it.name}" isn't available right now`)
      const duration = bundle.items.reduce((s, i) => s + (cat.getService(i.category, i.service)?.service.duration ?? 0), 0)
      line = { name: bundle.name, category: it.category, service: it.service, options: [], addOns: [], qty, unitPrice: bundle.price, duration }
    } else {
      const found = cat.getService(it.category, it.service)
      if (!found || found.category.status !== "live") throw new PricingError(`"${it.name}" can't be booked right now`)
      const { service } = found
      const variants = service.variants ?? []
      let unit = service.price
      const options = it.options.map((label, i) => {
        const opt = variants[i]?.options.find((o) => o.label === label) ?? variants.flatMap((v) => v.options).find((o) => o.label === label)
        if (!opt) throw new PricingError(`"${label}" isn't an option for ${service.name}`)
        unit += opt.delta
        return opt.label
      })
      const addOns = it.addOns.map((x) => {
        const a = service.addOns?.find((o) => o.id === x || o.name === x)
        if (!a) throw new PricingError(`"${x}" isn't an add-on for ${service.name}`)
        unit += a.price
        return a.name
      })
      // Price on request (0) stays 0: the team quotes it before the visit.
      line = { name: service.name, category: it.category, service: it.service, options, addOns, qty, unitPrice: service.price > 0 ? Math.max(0, unit) : 0, duration: service.duration }
    }
    if (it.unitPrice !== undefined && it.unitPrice !== line.unitPrice) changed = true
    out.push(line)
  }
  return { items: out, subtotal: out.reduce((s, i) => s + i.unitPrice * i.qty, 0), changed }
}
