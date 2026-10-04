import { f } from "../../fields"
import { HOME_FAQ, SAFETY_PILLARS, SAFETY_STEPS, VALUES } from "@/lib/content"
import { cards, cta, ctaList, faqs, head, lines, page, type CardItem, type Cta, type Faq, type Head } from "./blocks"

// About, careers, business, how it works, safety, contact and complaint pages.

const heroFields = (label = "Hero") => head(label)

// ---------------------------------------------------------------------------

export type AboutContent = { title: string; intro: string[]; valuesLabel: string; values: CardItem[]; worldsTitle: string; worldsSub: string; ctas: Cta[] }
page<AboutContent>("about", {
  label: "About",
  path: "/about",
  fields: {
    title: f.text("Headline", { required: true }),
    intro: f.list("Intro paragraphs", f.textarea("Paragraph"), { max: 2 }),
    valuesLabel: f.text("Values label"),
    values: cards("Values", {}, { max: 6 }),
    worldsTitle: f.text("Worlds title"),
    worldsSub: f.textarea("Worlds text"),
    ctas: ctaList(),
  },
  defaults: {
    title: "Built in Karachi, for Karachi.",
    intro: [
      "Getting anything done at home in this city means a dozen WhatsApp numbers, a cousin's recommendation, a price that changes at the door and a lot of hoping. We started Mjazo to replace the hoping with something you can trust.",
      "We built Mjazo around the visit that needs the most trust, a beautician in your home: women-only, properly vetted, sealed kits, clear prices. Then we held every other service to that same standard, from AC technicians to electricians, cleaners and carers.",
    ],
    valuesLabel: "What we stand for",
    values: VALUES.map((v) => ({ title: v.title, body: v.body })),
    worldsTitle: "Everything your home needs.",
    worldsSub: "Eight worlds, one standard. From a threading appointment to a full home deep clean, every visit gets the same vetting, the same clear prices and the same follow-through.",
    ctas: [
      { label: "Explore services", href: "/services" },
      { label: "Join as a pro", href: "/partner" },
      { label: "Work with us", href: "/careers" },
    ],
  },
})

// ---------------------------------------------------------------------------

export type CareersContent = { hero: Head; primary: Cta; secondary: Cta; teamsLabel: string; teams: CardItem[]; careersEmail: string; noteBefore: string; noteAfter: string }
page<CareersContent>("careers", {
  label: "Careers",
  path: "/careers",
  fields: {
    hero: heroFields(),
    primary: cta("Main button"),
    secondary: cta("Second button"),
    teamsLabel: f.text("Teams label"),
    teams: cards("Teams"),
    careersEmail: f.code("Careers email"),
    noteBefore: f.text("Note, before the email"),
    noteAfter: f.text("Note, after the email"),
  },
  defaults: {
    hero: { eyebrow: "Careers", title: "Small team. Big city. Real problems.", sub: "We're building the most trusted way to get things done at home in Karachi. If that sounds like your kind of work, we'd love to hear from you." },
    primary: { label: "Email us your CV", href: "mailto:careers@mjazo.pk?subject=Working%20at%20Mjazo" },
    secondary: { label: "Beauticians: join as a pro", href: "/partner" },
    teamsLabel: "Teams we're growing",
    teams: [
      { title: "Operations", body: "Matching pros to bookings, routes, on-time visits. The engine room." },
      { title: "Customer care", body: "The women-led team customers reach on WhatsApp, every day." },
      { title: "Training", body: "Turning great beauticians into great Mjazo pros." },
      { title: "Technology", body: "The website, app and tools that make it all work." },
    ],
    careersEmail: "careers@mjazo.pk",
    noteBefore: "No open role that fits? Write to",
    noteAfter: "or {{site.email}} and tell us what you'd do.",
  },
})

// ---------------------------------------------------------------------------

export type BusinessContent = {
  hero: Head
  available: string
  offer: CardItem[]
  reasons: CardItem[]
  form: Head & { submit: string; whatsapp: string; company: string; teamSize: string; teamSizes: string[]; area: string; interests: string; interestOptions: string[] }
}
page<BusinessContent>("business", {
  label: "Mjazo for Business",
  path: "/business",
  fields: {
    hero: heroFields(),
    available: f.text("“Available” badge"),
    offer: cards("What we offer (four)", {}, { min: 4, max: 4, help: "Icons stay in this order." }),
    reasons: cards("Why Mjazo (three)", {}, { min: 3, max: 3 }),
    form: f.group("Proposal form", {
      ...head("x").fields,
      submit: f.text("Submit button", { width: "half" }),
      whatsapp: f.text("WhatsApp message", { width: "half" }),
      company: f.text("Company label", { width: "half" }),
      teamSize: f.text("Team size label", { width: "half" }),
      teamSizes: lines("Team size options"),
      area: f.text("Area label", { width: "half" }),
      interests: f.text("Interests label", { width: "half" }),
      interestOptions: lines("Interest options"),
    }),
  },
  defaults: {
    hero: { eyebrow: "Mjazo for Business", title: "Look after your people. We'll handle the rest.", sub: "Wellness days, event glam, office cleaning and AC servicing for Karachi offices. Verified pros, one point of contact, one invoice." },
    available: "Available",
    offer: [
      { title: "Wellness & glam days", body: "Mani-pedi, head massage and quick glam stations for teams and events." },
      { title: "Event glam stations", body: "Makeup and hair pros on site for launches, dinners and celebrations." },
      { title: "Office cleaning", body: "Scheduled cleaning and deep cleans for offices and studios." },
      { title: "Bulk AC servicing", body: "Pre-summer service for every unit, on one visit plan." },
    ],
    reasons: [
      { title: "One contact", body: "A named account manager on WhatsApp, not a call centre." },
      { title: "One invoice", body: "Monthly billing with every visit itemised." },
      { title: "Verified pros", body: "The same vetting and standards as every Mjazo home visit." },
    ],
    form: {
      eyebrow: "Get a proposal",
      title: "Tell us about your team.",
      sub: "We'll reply on WhatsApp or email with a proposal.",
      submit: "Request a proposal",
      whatsapp: "Hi Mjazo! I'd like to discuss Mjazo for Business.",
      company: "Company",
      teamSize: "Team size",
      teamSizes: ["1–20", "21–50", "51–200", "200+"],
      area: "Office area",
      interests: "Interested in",
      interestOptions: ["Wellness days", "Event glam", "Office cleaning", "AC servicing"],
    },
  },
})

// ---------------------------------------------------------------------------

type Flow = { title: string; body: string }
export type HowContent = { hero: Head; tabCustomers: string; tabPros: string; customers: Flow[]; pros: Flow[]; customersCta: Cta; prosCta: Cta; promises: CardItem[]; faq: Faq[]; cta: Cta }
page<HowContent>("how-it-works", {
  label: "How it works",
  path: "/how-it-works",
  fields: {
    hero: heroFields(),
    tabCustomers: f.text("Customers tab", { width: "half" }),
    tabPros: f.text("Pros tab", { width: "half" }),
    customers: cards("Customer steps (five)", {}, { min: 5, max: 5, help: "Icons stay in this order." }),
    customersCta: cta("Customer button"),
    pros: cards("Pro steps (five)", {}, { min: 5, max: 5 }),
    prosCta: cta("Pro button"),
    promises: cards("Promises (three)", {}, { min: 3, max: 3 }),
    faq: faqs(),
    cta: cta("Bottom button"),
  },
  defaults: {
    hero: { eyebrow: "How it works", title: "Pick it. We match it. You glow.", sub: "Two minutes to book. Nothing to pay until it's done." },
    tabCustomers: "For customers",
    tabPros: "For pros",
    customers: [
      { title: "Tell us where", body: "Pick your neighbourhood and sub-area, from DHA to Bahria Town." },
      { title: "Pick your services", body: "Clear, all-in prices. Choose options, add-ons and how many people." },
      { title: "Choose a time window", body: "Any day this week, 9 am to 9 pm, in two-hour windows." },
      { title: "A verified pro arrives", body: "Confirmed on WhatsApp first. She checks in live and opens a sealed kit in front of you." },
      { title: "Pay after, rate, rebook", body: "Cash, JazzCash, Easypaisa or Raast. Loved her? Rebook in one tap." },
    ],
    pros: [
      { title: "Apply in 2 minutes", body: "In English or Urdu, or send a WhatsApp voice note." },
      { title: "Interview & practical test", body: "Meet our women-led team and show us your skills." },
      { title: "Free training", body: "Mjazo hygiene, etiquette and service standards, then certification." },
      { title: "Get bookings", body: "Pick your days. We bring the customers, the kit and the support." },
      { title: "Weekly payouts", body: "Paid every week. Final terms are shared at interview." },
    ],
    customersCta: { label: "Start booking", href: "/services/w/beauty-wellness" },
    prosCta: { label: "Apply as a pro", href: "/partner/apply" },
    promises: [
      { title: "All-in prices", body: "No visit fee, no haggling. What you see is what you pay." },
      { title: "Free changes", body: "Reschedule or cancel up to {{policy.freeChangeHours}} hours before, free." },
      { title: "Love it or we redo it", body: "Tell us within {{policy.redoHours}} hours and we'll make it right." },
    ],
    faq: HOME_FAQ.map(([q, a]) => ({ q, a })),
    cta: { label: "Book your glow", href: "/services/w/beauty-wellness" },
  },
})

// ---------------------------------------------------------------------------

export type SafetyContent = {
  hero: Head & { cta: string }
  journeyLabel: string
  steps: CardItem[]
  pillarsHead: Head
  pillars: (CardItem & { icon: string })[]
  help: { title: string; body: string; whatsapp: string; whatsappMessage: string; call: string }
  faqTitle: string
}
page<SafetyContent>("safety", {
  label: "Safety & trust",
  path: "/safety",
  fields: {
    hero: f.group("Hero", { ...head("x").fields, cta: f.text("Button") }),
    journeyLabel: f.text("Vetting journey label"),
    steps: cards("Vetting steps"),
    pillarsHead: head("Promises section"),
    pillars: cards("Promises", { icon: f.icon("Icon") }),
    help: f.group("Help box", { title: f.text("Title"), body: f.textarea("Text", { help: "{{site.hoursLower}} is the opening hours from settings, in lower case." }), whatsapp: f.text("WhatsApp button", { width: "half" }), whatsappMessage: f.text("WhatsApp message", { width: "half" }), call: f.text("Call button (before the number)", { width: "half" }) }),
    faqTitle: f.text("FAQ title", { help: "The questions come from the “safety” help topic." }),
  },
  defaults: {
    hero: { eyebrow: "Safety & trust", title: "Every pro. Every visit. Every time.", sub: "Letting someone into your home takes trust. Here's exactly how we earn it, before, during and after every visit.", cta: "See how we vet" },
    journeyLabel: "The vetting journey: five steps, no shortcuts",
    steps: SAFETY_STEPS,
    pillarsHead: { eyebrow: "On every visit", title: "Six promises we keep at your door", sub: "" },
    pillars: SAFETY_PILLARS,
    help: {
      title: "If anything ever feels wrong, we're one tap away.",
      body: "Our women-led support line answers {{site.hoursLower}}. In an emergency, call 15 (police) or 1122 (rescue) first, then us.",
      whatsapp: "WhatsApp support",
      whatsappMessage: "Hi Mjazo, I need help with a visit.",
      call: "Call",
    },
    faqTitle: "Safety questions",
  },
})

// ---------------------------------------------------------------------------

export type ContactContent = {
  hero: Head
  whatsapp: CardItem & { cta: string; message: string }
  call: { title: string; cta: string }
  email: { title: string; cta: string }
  instagram: { title: string; handle: string; cta: string }
  form: { title: string; submit: string; success: string }
}
page<ContactContent>("contact", {
  label: "Contact",
  path: "/contact",
  fields: {
    hero: head("Hero", "Leave the eyebrow empty to show the opening hours from settings."),
    whatsapp: f.group("WhatsApp card", { title: f.text("Title", { width: "half" }), body: f.text("Text", { width: "half" }), cta: f.text("Link text", { width: "half" }), message: f.text("Prefilled message", { width: "half" }) }),
    call: f.group("Call card", { title: f.text("Title", { width: "half" }), cta: f.text("Link text", { width: "half" }) }),
    email: f.group("Email card", { title: f.text("Title", { width: "half" }), cta: f.text("Link text", { width: "half" }) }),
    instagram: f.group("Instagram card", { title: f.text("Title", { width: "third" }), handle: f.code("Handle", { width: "third" }), cta: f.text("Link text", { width: "third" }) }),
    form: f.group("Message form", { title: f.text("Title"), submit: f.text("Submit button", { width: "half" }), success: f.text("Thank-you message", { width: "half" }) }),
  },
  defaults: {
    hero: { eyebrow: "", title: "Talk to a real person.", sub: "Our women-led team is on WhatsApp, phone and email. Pick whatever's easiest." },
    whatsapp: { title: "WhatsApp", body: "The fastest way to reach us.", cta: "Chat now", message: "Hi Mjazo!" },
    call: { title: "Call", cta: "Call us" },
    email: { title: "Email", cta: "Write to us" },
    instagram: { title: "Instagram", handle: "@mjazo", cta: "Follow" },
    form: { title: "Or send a message", submit: "Send message", success: "Thanks! We'll get back to you within working hours." },
  },
})

// ---------------------------------------------------------------------------

export type ComplaintContent = { hero: Head; promises: CardItem[]; talk: { title: string; body: string; message: string } }
page<ComplaintContent>("complaint", {
  label: "Report a problem",
  path: "/complaint",
  fields: {
    hero: head("Hero"),
    promises: cards("Promises"),
    talk: f.group("WhatsApp box", { title: f.text("Title", { width: "half" }), body: f.text("Text", { width: "half" }), message: f.text("Prefilled message") }),
  },
  defaults: {
    hero: { eyebrow: "We'll make it right", title: "Something not right? Tell us.", sub: "Share your booking ID and what happened. Add a photo if it helps." },
    promises: [
      { title: "Love it or we redo it", body: "Tell us within {{policy.redoHours}} hours of your visit and we'll send a pro back to put it right, free." },
      { title: "A person decides", body: "Every report is read by our team. Nothing is decided by a bot." },
      { title: "Safety first", body: "If anything about a visit made you feel unsafe, say so here or WhatsApp us: a manager handles it personally." },
    ],
    talk: { title: "Prefer to talk?", body: "WhatsApp us and a person will pick it up.", message: "Hi Mjazo, I have a problem with my booking." },
  },
})
