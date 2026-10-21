import "server-only"
import { getCatalog, getSettings } from "@/lib/cms/read"
import type { Locale } from "@/lib/cms/fields"
import { AREA_CENTERS } from "@/lib/geo"
import { WINDOW_LABELS } from "@/lib/time"

// What the Mjazo phone app needs to show the catalogue and take a booking (/api/v1/catalog): the
// live categories and their services with prices, options and add-ons, the areas we cover (with
// their centres, to pick the area from "use my location"), the time windows, the minimum order,
// the booking policy and the contact numbers. In English or Urdu, as the CMS has it.

const abs = (url: string | undefined, origin: string) => (!url ? null : /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`)

export async function appCatalog(lang: Locale, origin: string) {
  const [cat, en, settings] = await Promise.all([getCatalog(lang), getCatalog("en"), getSettings(lang)])
  // A booking names its options by their English labels (the server prices them from the English
  // catalogue): each option carries that label as its key, whatever language is shown.
  const enService = (c: string, s: string) => en.getService(c, s)?.service
  const categories = cat.visibleCategories.map((c) => ({
    slug: c.slug,
    name: c.name,
    world: c.world,
    icon: c.icon,
    tagline: c.tagline,
    proType: c.proType,
    status: c.status,
    includes: c.includes,
    image: abs(c.image?.url, origin),
    services: c.services.map((s) => ({
      slug: s.slug,
      name: s.name,
      short: s.short,
      price: s.price,
      duration: s.duration,
      popular: Boolean(s.popular),
      variants: (s.variants ?? []).map((v, vi) => ({ label: v.label, options: v.options.map((o, oi) => ({ label: o.label, key: enService(c.slug, s.slug)?.variants?.[vi]?.options[oi]?.label ?? o.label, delta: o.delta })) })),
      addOns: s.addOns ?? [],
      includes: s.includes ?? [],
      image: abs(s.image?.url, origin),
    })),
  }))
  return {
    lang,
    worlds: cat.worlds.filter((w) => categories.some((c) => c.world === w.slug)).map((w) => ({ slug: w.slug, name: w.name, short: w.short, icon: w.icon, tint: w.tint, image: abs(w.image?.url, origin) })),
    categories,
    areas: cat.liveAreas.map((a) => ({ slug: a.slug, name: a.name, subAreas: a.subAreas, center: AREA_CENTERS[a.slug] ? { lat: AREA_CENTERS[a.slug][0], lng: AREA_CENTERS[a.slug][1] } : null })),
    windows: WINDOW_LABELS,
    minOrder: cat.MIN_ORDER,
    policy: { freeChangeHours: settings.policy.freeChangeHours, leadHours: settings.policy.leadHours, redoHours: settings.policy.redoHours },
    contact: { phone: settings.site.phone, whatsapp: settings.site.whatsapp, email: settings.site.email, hours: settings.site.hours },
    plus: { price: settings.plus.price, discountPct: Math.round(settings.plus.discount * 100) },
    referral: { friendOff: settings.referral.friendOff, youGet: settings.referral.youGet },
  }
}
export type AppCatalog = Awaited<ReturnType<typeof appCatalog>>
