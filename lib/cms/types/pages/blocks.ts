import { f, type Fields } from "../../fields"
import { register, type ContentType } from "../../registry"
import { seoGroup } from "../seo"

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

/** Template pages take their titles from Settings → SEO settings (patterns) and each item's own SEO. */
const NO_SEO = new Set(["world", "category", "service", "area", "legal"])

/** Each page's search title and description (editable in its SEO group; {{tokens}} allowed). */
const PAGE_SEO: Record<string, { title: string; description: string }> = {
  about: { title: "About Mjazo: built in Karachi, for Karachi", description: "Built in Karachi, for Karachi. Why we started Mjazo, what we stand for, and where we're going." },
  app: { title: "Get the Mjazo app: install on iPhone & Android", description: "Install Mjazo on your home screen in seconds. Book home services, rebook favourite pros and manage bookings, on iPhone and Android, no app store needed." },
  blog: { title: "Mjazo Journal: beauty plans & home guides for Karachi", description: "Beauty plans, home checklists and how we work, written for Karachi." },
  business: { title: "Mjazo for Business: corporate wellness, office cleaning & AC servicing", description: "Corporate wellness days, glam stations for events, office cleaning and bulk AC servicing for Karachi offices. One invoice, verified pros." },
  careers: { title: "Careers at Mjazo: jobs in Karachi", description: "Help build Karachi's most trusted home-services platform. Operations, customer care, training and technology." },
  complaint: { title: "Report a problem with a booking", description: "Something not right with your Mjazo visit? Tell us within {{policy.redoHours}} hours for a free redo. A real person reviews every report." },
  contact: { title: "Contact Mjazo: WhatsApp, phone & email", description: "WhatsApp, call or email Mjazo. {{site.hours}}." },
  "ghar-scan": { title: "Ghar Scan: snap a photo, get the fix and the price", description: "Photograph an AC leak, damp wall, termite trail or appliance error, or a beauty look you love. Mjazo's AI tells you the likely issue, the right service and the price range, and books it." },
  "gift-cards": { title: "Mjazo gift cards: give a glow-up in Karachi", description: "Send a Mjazo gift card for birthdays, Eid, the bride-to-be or a thank-you. Redeemable on every service, from salon at home to deep cleaning." },
  "glam-mirror": { title: "Glam Mirror: try mehndi and makeup before you book", description: "Try mehndi designs on a photo of your own hand and see lip colours, blush, kajal and hair colour live on your face. It all runs on your phone. Save the look and send it to your Mjazo pro." },
  help: { title: "Help centre: bookings, payments, safety & more", description: "Answers about booking, prices and payment, safety, products and hygiene, changes and cancellations, and joining as a pro." },
  home: { title: "", description: "" },
  "home-pulse": { title: "Home Pulse: your home's care calendar for Karachi", description: "A 90-day plan for your home and routine: AC service before heatwaves, tank cleaning after the monsoon, dengue fumigation, waxing and facial rhythms, Eid and wedding glow plans. One tap to book." },
  "how-it-works": { title: "How Mjazo works: book home services in 2 minutes", description: "Pick a service, choose a time window, a verified pro arrives and checks in, and you pay after. Here's how Mjazo works for customers and for pros." },
  karachi: { title: "Home services across Karachi: DHA, Clifton, PECHS, Gulshan & more", description: "Mjazo comes to {{catalog.areaCount}} Karachi neighbourhoods: {{catalog.areaNames}}. Salon at home, cleaning, AC, repairs and more, with verified pros." },
  offers: { title: "Offers & bundles: beauty bundles and seasonal home packs", description: "Save with Mjazo bundles: The Quick Refresh, Weekend Reset, Full Glow and Shaadi Season Ready, plus the Pre-summer AC Pack and Pre-monsoon Home Pack. All-in prices, pay after." },
  plus: { title: "Mjazo Plus membership: member prices on every home service", description: "Mjazo Plus: {{plus.discountPct}}% member prices on every booking, priority shaadi-season slots, free reschedules and first pick of your favourite pro. {{plus.priceText}} a {{plus.period}}." },
  refer: { title: "Refer a friend: give and get on Mjazo", description: "Share your Mjazo link: friends get {{referral.friendOffText}} off their first booking and you get {{referral.youGetText}} credit when they book." },
  safety: { title: "Safety & trust: vetted, women-only beauty pros", description: "Women-only beauty pros, five-step vetting with CNIC and background checks, sealed single-use kits, live check-in and check-out, and a women-led support line." },
  services: { title: "All home services in Karachi: salon, cleaning, AC, repairs & more", description: "Book {{catalog.serviceCount}}+ home services in Karachi: salon at home, spa, makeup, deep cleaning, pest control, AC service, appliance repair, electricians, plumbers, painting, health visits and care." },
  weddings: { title: "Bridal party & wedding glam at home in Karachi", description: "Party makeup, hair, mehndi and pre-event glow for the bride's family and guests, at home across Karachi. Squad bookings for 3+ guests." },
  "shaadi-planner": { title: "Shaadi Orchestrator: plan the whole family's wedding glam", description: "Tell us your events and who needs glam. Mjazo's AI plans everyone's pre-wedding glow and works backwards from photo time, so the whole family is ready together. Karachi, at home." },
}

export function page<S extends object>(id: string, opts: { label: string; path: string; description?: string; fields: Fields; defaults: S }) {
  const withHero = HERO_IMAGE.has(id) ? { heroImage, ...opts.fields } : opts.fields
  const fields = NO_SEO.has(id) ? withHero : { ...withHero, seo: seoGroup() }
  const defaults = NO_SEO.has(id) ? opts.defaults : { ...opts.defaults, seo: PAGE_SEO[id] ?? { title: "", description: "" } }
  return register<S, S>({
    type: `page-${id}`,
    label: opts.label,
    group: "Pages",
    kind: "singleton",
    icon: "FileText",
    description: opts.description ?? `Text on ${opts.path}. Use {{tokens}} like {{policy.redoHours}} or {{catalog.areaCount}} for values that come from settings and the catalogue.`,
    fields,
    defaults: () => defaults,
    path: () => opts.path,
  } as ContentType<S, S>)
}
