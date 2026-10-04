import { f } from "../../fields"
import { HOME_FAQ } from "@/lib/content"
import { cta, faqs, head, lines, page, type Cta, type Faq, type Head } from "./blocks"

export type HomeContent = {
  hero: { badge: string; title: string; search: string; find: string }
  stats: { areas: string; categories: string; services: string; verified: string }
  worlds: Head & { live: string; soon: string }
  mostBooked: Head & { cta: Cta }
  how: Head & { steps: { title: string; body: string }[] }
  trust: { title: string; body: string; features: string[]; cta: Cta; tracker: { when: string; booking: string; live: string; pro: string; proLine: string; checks: string[] } }
  ai: Head & { tools: { name: string; line: string; example: string; action: string; href: string }[] }
  bundles: Head & { heroBadge: string }
  areas: Head & { allAreas: string; checkArea: string }
  promises: Head & { rowA: string[]; rowB: string[] }
  faq: { title: string; items: Faq[] }
  final: { title: string; sub: string; primary: Cta; secondary: Cta; notes: string[] }
}

export const HOME_DEFAULTS: HomeContent = {
  hero: { badge: "Now booking across {{catalog.areaCount}} Karachi neighbourhoods", title: "Everything your home needs.", search: "Search waxing, facial, AC…", find: "Find" },
  stats: { areas: "Karachi neighbourhoods", categories: "Categories", services: "Services", verified: "CNIC-verified pros" },
  worlds: { eyebrow: "What do you need today?", title: "One app. Every corner of your home.", sub: "Glow, clean, cool, fix, heal and care. Pick a world, book in two minutes, and a verified pro is at your door.", live: "Live now", soon: "Coming soon" },
  mostBooked: { eyebrow: "Most booked", title: "Karachi's favourite glow-ups", sub: "", cta: { label: "See the full menu", href: "/services/w/beauty-wellness" } },
  how: {
    eyebrow: "How Mjazo works",
    title: "Pick it. We match it. You glow.",
    sub: "",
    steps: [
      { title: "Pick it.", body: "{{catalog.serviceCount}}+ services with clear, all-in prices. No haggling, no surprises." },
      { title: "Choose a time.", body: "Pick a date and a time window that suits you, morning to late evening." },
      { title: "A verified pro arrives.", body: "CNIC-checked, trained and on time. Women-only for every beauty visit, with a sealed kit." },
      { title: "Relax. Rate. Rebook.", body: "Pay after the service. Loved your pro? Rebook her in one tap." },
    ],
  },
  trust: {
    title: "Safety isn't a feature. It's the whole point.",
    body: "Know who's coming, when they'll arrive, and that they've left safely. Every visit is tracked from kit to check-out.",
    features: ["Women-only beauty pros", "CNIC & background checked", "Sealed single-use kits", "Live check-in & check-out", "All-in prices, pay after", "Love it or we redo it"],
    cta: { label: "How we keep you safe", href: "/safety" },
    tracker: { when: "Today · 4:00–5:00 pm", booking: "The Full Glow", live: "Live", pro: "Your Mjazo pro", proLine: "CNIC-verified · Trained · Women-only", checks: ["Pro assigned & verified", "Sealed kit packed", "On the way", "Checked in at your door", "Service complete", "Checked out safely"] },
  },
  ai: {
    eyebrow: "Mjazo AI",
    title: "A home assistant that speaks your language.",
    sub: "AI tools that do the thinking for you, with a person from our team always one tap away.",
    tools: [
      { name: "Mjazo Concierge", line: "Book by chat or voice, in English, Urdu or Roman Urdu.", example: "“Kal shaam Phase 6 mein do logon ki waxing.”", action: "Ask Mjazo", href: "#concierge" },
      { name: "Ghar Scan", line: "Snap the problem or the look. Get the fix and the price.", example: "AC dripping? Damp wall? A mehndi design you love?", action: "Try Ghar Scan", href: "/ghar-scan" },
      { name: "Home Pulse", line: "Your home's care calendar, planned around Karachi's seasons.", example: "Heatwave next week, waxing due Thursday, Eid glow plan.", action: "See my plan", href: "/home-pulse" },
      { name: "Glam Mirror", line: "Try mehndi on your own hand and makeup live on your face.", example: "Arabic trail or full jaal? Berry lips or nude rose? See it first.", action: "Open the mirror", href: "/glam-mirror" },
      { name: "Shaadi Orchestrator", line: "Glam for the whole family, planned back from photo time.", example: "“Sister starts 5:15, Ammi 5:45, bride 6:00 with two pros.”", action: "Plan my shaadi", href: "/weddings/planner" },
    ],
  },
  bundles: { eyebrow: "Signature bundles", title: "Bundles that make sense. Prices that don't play games.", sub: "", heroBadge: "Hero bundle" },
  areas: { eyebrow: "Where we are", title: "{{catalog.areaCount}} neighbourhoods. One standard.", sub: "From DHA to Bahria Town, every visit gets the same vetted pros, sealed kits and all-in prices.", allAreas: "See all sub-areas", checkArea: "Check my area" },
  promises: {
    eyebrow: "The Mjazo promise",
    title: "Twelve promises. Every visit.",
    sub: "Trust isn't a tagline. It's what's in the kit, who rings your bell and what you pay at the end.",
    rowA: ["Women-only beauty pros", "Sealed single-use kits", "No visit fee", "Pay after the service", "Rebook your favourite pro", "Free reschedule up to {{policy.freeChangeHours}} hrs before"],
    rowB: ["CNIC-verified", "Trained & certified", "Live check-in", "Disposable sheets & towels", "Love it or we redo it", "Women-led support line"],
  },
  faq: { title: "Questions, answered", items: HOME_FAQ.map(([q, a]) => ({ q, a })) },
  final: {
    title: "Skip the salon. Keep the glow.",
    sub: "Book in two minutes. Pay after. Your living room just got a glow-up.",
    primary: { label: "Book your glow", href: "/services/w/beauty-wellness" },
    secondary: { label: "Explore every service", href: "/services" },
    notes: ["No card needed", "Slots from 9am–9pm", "Verified pros"],
  },
}

page<HomeContent>("home", {
  label: "Home page",
  path: "/",
  fields: {
    hero: f.group("Hero", { badge: f.text("Badge line"), title: f.text("Headline", { required: true, max: 40 }), search: f.text("Search box placeholder"), find: f.text("Search button") }),
    stats: f.group("Counters", { areas: f.text("Areas label", { width: "half" }), categories: f.text("Categories label", { width: "half" }), services: f.text("Services label", { width: "half" }), verified: f.text("Verified label", { width: "half" }) }, { help: "The numbers come from the catalogue; only the labels are editable." }),
    worlds: f.group("Service worlds", { ...head("x").fields, live: f.text("“Live” badge", { width: "half" }), soon: f.text("“Coming soon” badge", { width: "half" }) }),
    mostBooked: f.group("Most booked", { ...head("x").fields, cta: cta() }),
    how: f.group("How it works", { ...head("x").fields, steps: f.list("Steps (four)", f.group("Step", { title: f.text("Title", { required: true }), body: f.textarea("Text") }), { itemLabel: "title", min: 4, max: 4, help: "The scroll scene shows exactly four steps; icons stay in order." }) }),
    trust: f.group("Safety", {
      title: f.text("Title", { required: true }),
      body: f.textarea("Text"),
      features: lines("Checklist", { max: 8 }),
      cta: cta(),
      tracker: f.group("Live tracker card", { when: f.text("Time line", { width: "half" }), booking: f.text("Booking name", { width: "half" }), live: f.text("Live badge", { width: "half" }), pro: f.text("Pro title", { width: "half" }), proLine: f.text("Pro details"), checks: lines("Steps", { min: 6, max: 6 }) }),
    }),
    ai: f.group("Mjazo AI", {
      ...head("x").fields,
      tools: f.list("Tools (five)", f.group("Tool", { name: f.text("Name", { required: true }), line: f.text("Line"), example: f.text("Example"), action: f.text("Action label"), href: f.code("Link", { help: "#concierge opens the chat." }) }), { itemLabel: "name", min: 5, max: 5 }),
    }),
    bundles: f.group("Bundles", { ...head("x").fields, heroBadge: f.text("Hero bundle badge") }),
    areas: f.group("Areas", { ...head("x").fields, allAreas: f.text("“All sub-areas” link", { width: "half" }), checkArea: f.text("“Check my area” button", { width: "half" }) }),
    promises: f.group("Promises", { ...head("x").fields, rowA: lines("Top row"), rowB: lines("Bottom row") }),
    faq: f.group("FAQ", { title: f.text("Title"), items: faqs("Questions") }),
    final: f.group("Final call to action", { title: f.text("Title", { required: true }), sub: f.textarea("Text"), primary: cta("Main button"), secondary: cta("Second button"), notes: lines("Small print", { max: 3 }) }),
  },
  defaults: HOME_DEFAULTS,
})
