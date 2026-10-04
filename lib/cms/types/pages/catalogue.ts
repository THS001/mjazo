import { f } from "../../fields"
import { cards, cta, faqs, head, lines, page, type CardItem, type Cta, type Faq, type Head } from "./blocks"

// The services menu, the world / category / service templates and the Karachi area pages.
// Templates are shared by every world, category, service or area, so their text uses per-item
// tokens (listed in each description) besides the usual settings and catalogue tokens.

export type ServicesContent = { hero: Head; explore: string; services: string; quote: string }
page<ServicesContent>("services", {
  label: "Services menu",
  path: "/services",
  description: "Text on /services. Worlds, categories and prices come from the Catalogue. Tokens: {{catalog.worldCount}}, {{catalog.categoryCount}}, {{catalog.serviceCount}}; {{world}} in the “Explore” link.",
  fields: {
    hero: head("Hero"),
    explore: f.text("“Explore” link", { width: "third", help: "{{world}} becomes the world's name." }),
    services: f.text("“services” count label", { width: "third" }),
    quote: f.text("Price-on-request label", { width: "third" }),
  },
  defaults: {
    hero: {
      eyebrow: "{{catalog.worldCount}} worlds · {{catalog.categoryCount}} categories · {{catalog.serviceCount}}+ services",
      title: "Every corner of your home, covered.",
      sub: "Spin the worlds or scroll the full menu. Every service is bookable today, with all-in prices you pay after.",
    },
    explore: "Explore {{world}}",
    services: "services",
    quote: "Quote",
  },
})

// ---------------------------------------------------------------------------

export type WorldContent = {
  hero: { live: string; soon: string; book: string; categories: string }
  categories: { eyebrow: string; title: string; services: string; from: string; onRequest: string }
  popular: { eyebrow: string; live: string; soon: string }
  bundles: Head
  promisesWomen: CardItem[]
  promisesOther: CardItem[]
  waitlist: { title: string; body: string }
  faqTitle: string
}
page<WorldContent>("world", {
  label: "World page template",
  path: "/services/w/beauty-wellness",
  description:
    "Shared by every world page (/services/w/...). Tokens: {{world}} (name), {{worldShort}} (its short line), {{count}} (categories), {{price}} (lowest price), plus {{catalog.areaCount}} and the other site tokens.",
  fields: {
    hero: f.group("Hero", {
      live: f.textarea("Intro when live"),
      soon: f.textarea("Intro when coming soon"),
      book: f.text("Book button", { width: "half" }),
      categories: f.text("Categories button", { width: "half" }),
    }),
    categories: f.group("Categories section", {
      eyebrow: f.text("Eyebrow", { width: "half" }),
      title: f.text("Title", { width: "half" }),
      services: f.text("“services” count label", { width: "third" }),
      from: f.text("Lowest price", { width: "third", help: "{{price}} becomes the price." }),
      onRequest: f.text("No price label", { width: "third" }),
    }),
    popular: f.group("Most booked section", { eyebrow: f.text("Eyebrow", { width: "third" }), live: f.text("Title when live", { width: "third" }), soon: f.text("Title when coming soon", { width: "third" }) }),
    bundles: head("Bundles section"),
    promisesWomen: cards("Promises: women-pro worlds (three)", {}, { min: 3, max: 3, help: "Icons stay in this order." }),
    promisesOther: cards("Promises: other worlds (three)", {}, { min: 3, max: 3, help: "Icons stay in this order." }),
    waitlist: f.group("Waitlist band (coming soon only)", { title: f.text("Title"), body: f.textarea("Text") }),
    faqTitle: f.text("FAQ title", { help: "The questions come from the world's first category." }),
  },
  defaults: {
    hero: {
      live: "{{worldShort}}. Book in two minutes and a verified pro comes to you, anywhere across our {{catalog.areaCount}} Karachi neighbourhoods.",
      soon: "{{worldShort}}. Opening area by area: join the waitlist and we'll WhatsApp you when it's live near you.",
      book: "Book now",
      categories: "See categories",
    },
    categories: { eyebrow: "{{count}} categories", title: "Inside {{world}}", services: "services", from: "from {{price}}", onRequest: "price on request" },
    popular: { eyebrow: "Most booked", live: "Start with a favourite", soon: "What's coming" },
    bundles: { eyebrow: "Bundles", title: "Better together", sub: "Bundles are priced below their parts and clear the minimum order in one tap." },
    promisesWomen: [
      { title: "Women-only pros", body: "CNIC-verified, background-checked, trained by us." },
      { title: "Sealed single-use kits", body: "Opened in front of you, never reused." },
      { title: "All-in prices", body: "No visit fee. Pay after the service." },
    ],
    promisesOther: [
      { title: "Verified professionals", body: "CNIC-checked, skill-tested, trained." },
      { title: "Upfront prices", body: "Quoted before any work. Parts only with your OK." },
      { title: "On-time, with warranty", body: "Live check-in, and a service warranty on our work." },
    ],
    waitlist: { title: "Bring {{world}} to your area.", body: "Every ‘Notify me’ is a vote. We open each service, area by area, where the waitlist is loudest." },
    faqTitle: "{{world}}: questions",
  },
})

// ---------------------------------------------------------------------------

export type CategoryContent = {
  hero: { availableIn: string; availableAcross: string; eyebrowArea: string; everywhere: string; live: string; soon: string }
  card: { services: string; from: string; takes: string; quote: string; varies: string; menu: string; waitlist: string }
  waitlist: { titleArea: string; titleAny: string; body: string }
  menuTitle: string
  includes: string
  excludes: string
  chat: { message: string; bold: string; text: string }
  related: { title: string; live: string; soon: string }
  faqTitle: string
}
page<CategoryContent>("category", {
  label: "Category page template",
  path: "/services/womens-salon",
  description:
    "Shared by every category page, and by the local pages like /karachi/dha/womens-salon. Tokens: {{category}}, {{categoryLower}}, {{world}}, {{area}} (local pages), {{where}} (the area, or the “everywhere” text).",
  fields: {
    hero: f.group("Hero", {
      availableIn: f.text("Live chip on local pages", { width: "half" }),
      availableAcross: f.text("Live chip elsewhere", { width: "half" }),
      eyebrowArea: f.text("Eyebrow on local pages", { width: "half", help: "Elsewhere the eyebrow is just the category name." }),
      everywhere: f.text("“Everywhere” text", { width: "half", help: "Used as {{where}} outside local pages." }),
      live: f.text("Intro ending when live"),
      soon: f.text("Intro ending when coming soon"),
    }),
    card: f.group("Summary card", {
      services: f.text("“services” label", { width: "third" }),
      from: f.text("“From” label", { width: "third" }),
      takes: f.text("“Takes” label", { width: "third" }),
      quote: f.text("No price", { width: "third" }),
      varies: f.text("No duration", { width: "third" }),
      menu: f.text("Menu button", { width: "third" }),
      waitlist: f.text("Waitlist button", { width: "third" }),
    }),
    waitlist: f.group("Waitlist box (coming soon only)", { titleArea: f.text("Title on local pages", { width: "half" }), titleAny: f.text("Title elsewhere", { width: "half" }), body: f.textarea("Text") }),
    menuTitle: f.text("Menu title", { width: "third" }),
    includes: f.text("“Included” box title", { width: "third" }),
    excludes: f.text("“Not included” box title", { width: "third" }),
    chat: f.group("WhatsApp box", { message: f.text("WhatsApp message"), bold: f.text("Bold text", { width: "half" }), text: f.text("Text", { width: "half" }) }),
    related: f.group("More in this world", { title: f.text("Title", { width: "third" }), live: f.text("Live label", { width: "third" }), soon: f.text("Coming-soon label", { width: "third" }) }),
    faqTitle: f.text("FAQ title", { help: "The questions themselves are set on each category." }),
  },
  defaults: {
    hero: {
      availableIn: "Available in {{area}}",
      availableAcross: "Available across Karachi",
      eyebrowArea: "{{category}} in {{area}}",
      everywhere: "{{catalog.areaCount}} Karachi neighbourhoods",
      live: "At your door in {{where}}, with all-in prices you pay after.",
      soon: "Coming soon: join the waitlist below.",
    },
    card: { services: "services", from: "From", takes: "Takes", quote: "Quote", varies: "Varies", menu: "See the menu", waitlist: "Join the waitlist" },
    waitlist: { titleArea: "Want {{categoryLower}} in {{area}}?", titleAny: "Want {{categoryLower}} near you?", body: "Join the waitlist. We open each service where it's loudest, and WhatsApp you the day it's live." },
    menuTitle: "The menu",
    includes: "Every visit includes",
    excludes: "Not included",
    chat: { message: "Hi Mjazo! I have a question about {{category}}.", bold: "Prefer to chat?", text: "Ask us anything on WhatsApp." },
    related: { title: "More in {{world}}", live: "Live", soon: "Coming soon" },
    faqTitle: "{{category}}: questions",
  },
})

// ---------------------------------------------------------------------------

export type ServiceContent = {
  chips: { available: string; popular: string; sealedKit: string }
  included: string
  prepTitle: string
  prep: { women: string[]; technician: string[]; care: string[] }
  howTitle: string
  step: string
  stepsWomen: CardItem[]
  stepsOther: CardItem[]
  policies: CardItem[]
  related: string
  faqTitle: string
}
page<ServiceContent>("service", {
  label: "Service page template",
  path: "/services/womens-salon/full-arms-wax",
  description: "Shared by every service page. The service's own name, price, options and inclusions are set on the service in the Catalogue. Policy values come from Settings via tokens.",
  fields: {
    chips: f.group("Picture labels", { available: f.text("Live chip", { width: "third" }), popular: f.text("Most booked", { width: "third" }), sealedKit: f.text("Sealed kit", { width: "third" }) }),
    included: f.text("“Included” box title", { width: "half" }),
    prepTitle: f.text("“Before your visit” box title", { width: "half" }),
    prep: f.group("Before your visit, by pro type", { women: lines("Women pros"), technician: lines("Technicians"), care: lines("Care & health") }),
    howTitle: f.text("“How it works” title", { width: "half" }),
    step: f.text("“Step” label", { width: "half" }),
    stepsWomen: cards("Steps with women pros (four)", {}, { min: 4, max: 4, help: "Icons stay in this order." }),
    stepsOther: cards("Steps with other pros (four)", {}, { min: 4, max: 4 }),
    policies: cards("Policy strip (three)", {}, { min: 3, max: 3 }),
    related: f.text("Related services title", { width: "half" }),
    faqTitle: f.text("FAQ title", { width: "half" }),
  },
  defaults: {
    chips: { available: "Available across Karachi", popular: "Most booked", sealedKit: "Sealed kit" },
    included: "What's included",
    prepTitle: "Before your visit",
    prep: {
      women: ["Pick a spot with good light and a little space; your pro brings sheets and towels.", "For waxing, let hair grow about 5 mm (2–3 weeks) and skip moisturiser that day.", "Mention allergies or sensitive skin in your booking notes."],
      technician: ["Clear access to the area (AC unit, sink, appliance) before the visit.", "Keep the model number handy if it's an appliance.", "Any parts are priced and approved by you before fitting."],
      care: ["Share any medical notes or routines in your booking notes.", "Keep prescriptions and reports handy for health visits.", "In an emergency, call 1122 first."],
    },
    howTitle: "How it works",
    step: "Step",
    stepsWomen: [
      { title: "Book in 2 minutes", body: "Pick options, a date and a time window." },
      { title: "We match your pro", body: "A verified woman pro, confirmed on WhatsApp." },
      { title: "She arrives & checks in", body: "With a sealed kit, opened in front of you." },
      { title: "Pay after, rate, rebook", body: "Cash, JazzCash, Easypaisa or Raast." },
    ],
    stepsOther: [
      { title: "Book in 2 minutes", body: "Pick options, a date and a time window." },
      { title: "We match your pro", body: "A verified professional, confirmed on WhatsApp." },
      { title: "Your pro arrives & checks in", body: "With tools, on time, and checks in live." },
      { title: "Pay after, rate, rebook", body: "Cash, JazzCash, Easypaisa or Raast." },
    ],
    policies: [
      { title: "Free changes", body: "Up to {{policy.freeChangeHours}} hrs before your slot." },
      { title: "Love it or we redo it", body: "Tell us within {{policy.redoHours}} hrs." },
      { title: "Pay after", body: "Cash, JazzCash, Easypaisa, Raast." },
    ],
    related: "Often booked with this",
    faqTitle: "Good to know",
  },
})

// ---------------------------------------------------------------------------

export type KarachiContent = { hero: Head; mapNote: string; list: Head; outside: { text: string; message: string }; faqTitle: string; faq: Faq[] }
page<KarachiContent>("karachi", {
  label: "Areas (Karachi)",
  path: "/karachi",
  description: "Text on /karachi. The areas themselves are under Catalogue → Areas. Tokens: {{areaCount}} and {{subAreaCount}} (counted from the areas), plus the site tokens.",
  fields: {
    hero: head("Hero"),
    mapNote: f.text("Note under the map"),
    list: head("Area list"),
    outside: f.group("“Outside our areas” link", { text: f.text("Text"), message: f.text("WhatsApp message") }),
    faqTitle: f.text("FAQ title"),
    faq: faqs(),
  },
  defaults: {
    hero: { eyebrow: "{{areaCount}} neighbourhoods · {{subAreaCount}} sub-areas", title: "From Clifton's sea breeze to Bahria's precincts.", sub: "One standard everywhere we go: vetted pros, sealed kits, on-time arrival windows and all-in prices you pay after." },
    mapNote: "Stylised map, not to scale. Hover a zone, click to open it.",
    list: { eyebrow: "Where we come", title: "Pick your neighbourhood", sub: "Every service on Mjazo is bookable in every neighbourhood below." },
    outside: { text: "Just outside these areas? WhatsApp us your location and we'll do our best to come.", message: "Hi Mjazo! Do you cover my area?" },
    faqTitle: "Coverage, answered",
    faq: [
      { q: "Is there a travel fee for farther areas?", a: "No. Prices are all-in wherever you are in our coverage." },
      { q: "How early can someone come?", a: "The earliest slot is about {{policy.leadHours}} hours from when you book, depending on availability. You can book up to 7 days ahead." },
      { q: "Do the same standards apply everywhere?", a: "Yes. Same vetting, same sealed kits, same live check-in and check-out, in every neighbourhood." },
    ],
  },
})

// ---------------------------------------------------------------------------

export type AreaContent = {
  hero: Head & { primary: Cta; secondary: string }
  subAreas: { eyebrow: string; title: string }
  services: { eyebrow: string; title: string; card: string }
  also: string
  faqTitle: string
  faq: Faq[]
}
page<AreaContent>("area", {
  label: "Area page template",
  path: "/karachi/dha",
  description: "Shared by every area page (/karachi/...). Tokens: {{area}}, {{blurb}} (the area's description), {{subAreas}} (its sub-areas, comma-separated), {{category}} (in service cards).",
  fields: {
    hero: f.group("Hero", { ...head("x").fields, primary: cta("Main button"), secondary: f.text("Second button") }),
    subAreas: f.group("Sub-areas section", { eyebrow: f.text("Eyebrow", { width: "half" }), title: f.text("Title", { width: "half" }) }),
    services: f.group("Services section", { eyebrow: f.text("Eyebrow", { width: "third" }), title: f.text("Title", { width: "third" }), card: f.text("Card title", { width: "third" }) }),
    also: f.text("“We also come to” label"),
    faqTitle: f.text("FAQ title"),
    faq: faqs(),
  },
  defaults: {
    hero: {
      eyebrow: "● Available in {{area}}",
      title: "Mjazo in {{area}}.",
      sub: "{{blurb}} Salon, spa, cleaning, AC, repairs and more, at your door with all-in prices you pay after.",
      primary: { label: "Book your glow", href: "/services/w/beauty-wellness" },
      secondary: "All services in {{area}}",
    },
    subAreas: { eyebrow: "Sub-areas covered", title: "Every corner of {{area}}" },
    services: { eyebrow: "Book in your area", title: "Everything {{area}} homes need", card: "{{category}} in {{area}}" },
    also: "We also come to",
    faqTitle: "Mjazo in {{area}}: questions",
    faq: [
      { q: "Do you cover all of {{area}}?", a: "Yes: {{subAreas}}. Just outside? WhatsApp us your location." },
      { q: "Is there a travel or visit fee?", a: "No. Prices are all-in." },
      { q: "How early can someone come?", a: "The earliest slot is about {{policy.leadHours}} hours from when you book, depending on availability. You can book up to 7 days ahead." },
    ],
  },
})
