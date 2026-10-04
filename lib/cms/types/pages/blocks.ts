import { f, type Fields } from "../../fields"
import { register, type ContentType } from "../../registry"

// Reusable field groups for page content, and `page()` to register a page's editable content as a
// singleton (`page-<id>`), read on the site with getPage("<id>").

export type Head = { eyebrow: string; title: string; sub: string }
export type Cta = { label: string; href: string }
export type Faq = { q: string; a: string }
export type CardItem = { title: string; body: string }

export const head = (label: string, help?: string) =>
  f.group(label, { eyebrow: f.text("Eyebrow", { help: "Small capitals above the title. Optional." }), title: f.text("Title", { required: true }), sub: f.textarea("Intro") }, { help })
export const cta = (label = "Button") => f.group(label, { label: f.text("Label", { required: true, width: "half" }), href: f.code("Link", { required: true, width: "half", help: "A page like /services, or a full https:// address." }) })
export const ctaList = (label = "Buttons") => f.list(label, f.group("Button", { label: f.text("Label", { required: true }), href: f.code("Link", { required: true }) }), { itemLabel: "label" })
export const faqs = (label = "FAQs") => f.list(label, f.group("Question", { q: f.text("Question", { required: true }), a: f.textarea("Answer", { required: true }) }), { itemLabel: "q" })
export const cards = (label: string, extra: Fields = {}, o: { min?: number; max?: number; help?: string } = {}) =>
  f.list(label, f.group("Card", { title: f.text("Title", { required: true }), body: f.textarea("Text"), ...extra }), { itemLabel: "title", ...o })
export const lines = (label: string, o: { min?: number; max?: number; help?: string } = {}) => f.list(label, f.text("Line"), o)

/** FAQ items in the [question, answer] form the FAQ component takes. */
export const pairs = (items: Faq[] | undefined) => (items ?? []).map((x) => [x.q, x.a] as [string, string])

/** Pages whose heading (PageHero) can show a photo from the media library. */
const HERO_IMAGE = new Set(["blog", "business", "careers", "complaint", "contact", "gift-cards", "how-it-works", "karachi", "offers", "plus", "refer", "safety", "services", "weddings"])
const heroImage = f.image("Hero image", { help: "Shown beside the heading, in place of the 3D object where there is one. Leave empty for the built-in design." })

export function page<S extends object>(id: string, opts: { label: string; path: string; description?: string; fields: Fields; defaults: S }) {
  const fields = HERO_IMAGE.has(id) ? { heroImage, ...opts.fields } : opts.fields
  return register<S, S>({
    type: `page-${id}`,
    label: opts.label,
    group: "Pages",
    kind: "singleton",
    icon: "FileText",
    description: opts.description ?? `Text on ${opts.path}. Use {{tokens}} like {{policy.redoHours}} or {{catalog.areaCount}} for values that come from settings and the catalogue.`,
    fields,
    defaults: () => opts.defaults,
    path: () => opts.path,
  } as ContentType<S, S>)
}
