// Glam Mirror → Look Card: maps what the customer tried on to Mjazo services (catalogue prices
// only) and writes a plain brief for the pro. Used in the browser and by the AI endpoint.

import type { Catalog } from "@/lib/catalog"
import { DESIGNS, type DesignId } from "./mehndi"
import { BLUSH, HAIR, KAJAL, LIPS, type MakeupChoice } from "./makeup"

export type GlamSelection = {
  mehndi?: { design: DesignId; coverage: "front" | "front-back"; stain: "fresh" | "dark" }
  makeup?: MakeupChoice & { hairLength?: "Short" | "Medium" | "Long" }
}

export type LookService = { category: string; categoryName: string; service: string; name: string; options: string[]; unitPrice: number; duration: number }

function svc(cat: Pick<Catalog, "getService">, category: string, service: string, picks: string[] = []): LookService | null {
  const f = cat.getService(category, service)
  if (!f) return null
  const variants = f.service.variants ?? []
  const options = variants.map((v, i) => (v.options.find((o) => o.label === picks[i]) ?? v.options[0]).label)
  const delta = variants.reduce((s, v, i) => s + (v.options.find((o) => o.label === options[i])?.delta ?? 0), 0)
  return { category, categoryName: f.category.name, service, name: f.service.name, options, unitPrice: f.service.price + delta, duration: f.service.duration }
}

export function lookServices(sel: GlamSelection, cat: Pick<Catalog, "getService">): LookService[] {
  const out: (LookService | null)[] = []
  if (sel.mehndi) {
    const d = DESIGNS.find((x) => x.id === sel.mehndi!.design)
    // Bridal coverage runs up the arms and feet; every other style is hands, front or front + back.
    if (d?.style === "Bridal") out.push(svc(cat, "makeup-mehndi", "mehndi-full"))
    else out.push(svc(cat, "makeup-mehndi", "mehndi-hands", [sel.mehndi.coverage === "front-back" ? "Both hands, front + back" : "Both hands, front"]))
  }
  const m = sel.makeup
  if (m) {
    const bold = ["classic-red", "berry", "brick"].includes(m.lips) || m.kajal === "winged"
    if (m.lips !== "none" || m.blush !== "none" || m.kajal !== "none") out.push(bold ? svc(cat, "makeup-mehndi", "party-makeup") : svc(cat, "makeup-mehndi", "soft-glam"))
    if (m.hair !== "none") out.push(svc(cat, "hair", "global-colour", [m.hairLength ?? "Medium"]))
  }
  return out.filter((x): x is LookService => Boolean(x))
}

/** Plain-language Look Card when the AI writer isn't available. */
export function lookBrief(sel: GlamSelection) {
  const parts: string[] = []
  let title = "My Glam Mirror look"
  if (sel.mehndi) {
    const d = DESIGNS.find((x) => x.id === sel.mehndi!.design)!
    title = `${d.name} mehndi`
    parts.push(`Mehndi: ${d.name} (${d.style} style). ${d.note} ${sel.mehndi.coverage === "front-back" ? "Front and back of both hands." : "Front of both hands."} Natural henna only; customer prefers a ${sel.mehndi.stain === "dark" ? "deep, dark" : "bright"} stain.`)
  }
  const m = sel.makeup
  if (m && (m.lips !== "none" || m.blush !== "none" || m.kajal !== "none" || m.hair !== "none")) {
    const bits = [
      m.lips !== "none" && `${LIPS.find((x) => x.id === m.lips)?.name} lips`,
      m.blush !== "none" && `${BLUSH.find((x) => x.id === m.blush)?.name} blush`,
      m.kajal !== "none" && KAJAL.find((x) => x.id === m.kajal)?.name.toLowerCase(),
    ].filter(Boolean)
    if (bits.length) parts.push(`Makeup: ${bits.join(", ")}.`)
    if (m.hair !== "none") parts.push(`Hair colour: ${HAIR.find((x) => x.id === m.hair)?.name} (${m.hairLength ?? "Medium"} length). Strand test first.`)
    if (!sel.mehndi) title = bits.length ? `${LIPS.find((x) => x.id === m.lips)?.name ?? "Soft"} glam` : `${HAIR.find((x) => x.id === m.hair)?.name} hair`
  }
  return { title, brief: parts.join(" ") }
}
