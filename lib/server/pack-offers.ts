import "server-only"
import { getCatalog } from "@/lib/cms/read"
import { priceItems } from "@/lib/core/pricing"
import { packOffers, type PackOffer } from "@/lib/packs"

/**
 * The packs on offer, priced from the English catalogue (as checkout prices them), with their names
 * in the page's language and the cart line for one visit. For the offers page, the account and the
 * phone app.
 */
export async function packOffersIn(lang: "en" | "ur") {
  const en = await getCatalog("en")
  const local = lang === "en" ? en : await getCatalog(lang)
  const itemName = (o: PackOffer) =>
    (o.item.service.startsWith("bundle-") ? local.bundles.find((b) => `bundle-${b.slug}` === o.item.service)?.name : local.getService(o.item.category, o.item.service)?.service.name) || o.item.name
  return packOffers(en).map((o) => {
    const p = local.packs.find((x) => x.slug === o.slug)
    const line = priceItems([o.item], en).items[0]
    return {
      ...o,
      name: p?.name || o.name,
      note: p?.note ?? o.note,
      itemName: itemName(o),
      line: { name: o.item.name, category: o.item.category, service: o.item.service, options: o.item.options, unitPrice: line.unitPrice, duration: line.duration },
    }
  })
}
export type PackOfferView = Awaited<ReturnType<typeof packOffersIn>>[number]
