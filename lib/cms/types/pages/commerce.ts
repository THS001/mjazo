import { f } from "../../fields"
import { cards, faqs, head, lines, page, type CardItem, type Faq, type Head } from "./blocks"

// Plus, referrals, offers, gift cards and the app page. Prices come from settings via tokens:
// {{plus.priceText}}, {{plus.period}}, {{plus.discountPct}}, {{referral.friendOffText}}, {{referral.youGetText}}, {{catalog.minOrder}}.

export type PlusContent = {
  hero: Head & { join: string; savings: string }
  perks: CardItem[]
  calc: Head
  join: { title: string; body: string; submit: string; whatsapp: string; success: string; area: string }
  faqTitle: string
  faq: Faq[]
}
page<PlusContent>("plus", {
  label: "Mjazo Plus",
  path: "/plus",
  fields: {
    hero: f.group("Hero", { ...head("x").fields, join: f.text("Join button", { width: "half" }), savings: f.text("Savings button", { width: "half" }) }),
    perks: cards("Perks (four)", {}, { min: 4, max: 4, help: "Icons stay in this order." }),
    calc: head("Calculator section"),
    join: f.group("Join form", { title: f.text("Title"), body: f.textarea("Text"), submit: f.text("Submit button", { width: "half" }), whatsapp: f.text("WhatsApp message", { width: "half" }), success: f.text("Thank-you message"), area: f.text("Area label") }),
    faqTitle: f.text("FAQ title"),
    faq: faqs(),
  },
  defaults: {
    hero: {
      eyebrow: "Mjazo Plus membership",
      title: "The upkeep you'd do anyway, for less.",
      sub: "For regulars: threading every few weeks, waxing every month, AC before summer, a facial before every event. {{plus.priceText}} a {{plus.period}}, and it usually pays for itself in a few visits.",
      join: "Join Plus",
      savings: "See your savings",
    },
    perks: [
      { title: "{{plus.discountPct}}% off every visit", body: "Member prices on every booking, across every service and every neighbourhood." },
      { title: "Priority slots", body: "First pick of evenings, weekends and shaadi-season dates." },
      { title: "Your pro, first", body: "We hold your favourite pro's diary for you before anyone else." },
      { title: "Free reschedules", body: "Change any booking, any time, without a fee." },
    ],
    calc: { eyebrow: "Is it worth it?", title: "Slide to your usual. Watch it pay for itself.", sub: "Plus costs {{plus.priceText}} a {{plus.period}}. Every booking after that is {{plus.discountPct}}% off." },
    join: {
      title: "Join Plus.",
      body: "Send your details and we'll activate your membership on WhatsApp. Pay the {{plus.priceText}} fee by JazzCash, Easypaisa, Raast or cash on your next visit; member prices start immediately.",
      submit: "Activate my Plus",
      whatsapp: "Hi Mjazo! I'd like to join Mjazo Plus.",
      success: "Welcome to Plus! We'll WhatsApp you to confirm your membership.",
      area: "Your area",
    },
    faqTitle: "Plus, explained",
    faq: [
      { q: "How much is Plus?", a: "{{plus.priceText}} a {{plus.period}}. Member prices ({{plus.discountPct}}% off) apply to every booking during your membership." },
      { q: "Which services are included?", a: "Every service on Mjazo, in every neighbourhood we cover." },
      { q: "How do I pay?", a: "Pay the membership fee by JazzCash, Easypaisa, Raast or cash on your next visit." },
      { q: "Can I cancel?", a: "Yes, any time, by WhatsApp." },
    ],
  },
})

// ---------------------------------------------------------------------------

export type ReferContent = { hero: Head; steps: CardItem[]; box: { title: string; body: string }; faqTitle: string; faq: Faq[] }
page<ReferContent>("refer", {
  label: "Refer & earn",
  path: "/refer",
  fields: {
    hero: head("Hero"),
    steps: cards("Steps (three)", {}, { min: 3, max: 3 }),
    box: f.group("Link box", { title: f.text("Title"), body: f.text("Text") }),
    faqTitle: f.text("FAQ title"),
    faq: faqs(),
  },
  defaults: {
    hero: { eyebrow: "Refer & earn", title: "Good pros travel by word of mouth.", sub: "Share your link. Your friend gets {{referral.friendOffText}} off their first booking, and you get {{referral.youGetText}} credit once their visit is done." },
    steps: [
      { title: "Get your code", body: "Enter your name and number. Your personal link is ready instantly." },
      { title: "Your friend books", body: "They open your link and {{referral.friendOffText}} comes off their first booking automatically." },
      { title: "You get credit", body: "{{referral.youGetText}} credit on your next booking after their visit is done." },
    ],
    box: { title: "Get your link.", body: "Share it with the friend who's always asking for your beautician's number." },
    faqTitle: "Referrals, explained",
    faq: [
      { q: "Who counts as a new friend?", a: "Anyone booking Mjazo for the first time with your link." },
      { q: "When do I get my credit?", a: "Once your friend's first visit is complete, {{referral.youGetText}} is added to your next booking. We'll confirm on WhatsApp." },
      { q: "Is there a limit?", a: "No limit. Every friend who books earns you credit." },
    ],
  },
})

// ---------------------------------------------------------------------------

export type OffersContent = {
  hero: Head
  heroBundle: string
  save: string
  totalTime: string
  seasonalLabel: string
  seasonal: string[]
  freeQuote: string
  inspection: string
  bookMessage: string
  shaadi: { eyebrow: string; title: string; cta: string; href: string }
}
page<OffersContent>("offers", {
  label: "Offers & bundles",
  path: "/offers",
  description: "Text around the bundles. The bundles themselves (names, prices, services) are under Catalogue → Bundles.",
  fields: {
    hero: head("Hero"),
    heroBundle: f.text("Hero bundle tag", { width: "half" }),
    save: f.text("“You save” label", { width: "half" }),
    totalTime: f.text("“Total time” label", { width: "half" }),
    seasonalLabel: f.text("Seasonal section title", { width: "half" }),
    seasonal: lines("Seasonal bundle slugs", { help: "Bundles listed here show in the seasonal section instead of the main list." }),
    freeQuote: f.text("“Free inspection + quote” text", { width: "half" }),
    inspection: f.text("Inspection button (packs priced on request)", { width: "half" }),
    bookMessage: f.text("WhatsApp message", { help: "{{bundle}} becomes the bundle name." }),
    shaadi: f.group("Shaadi banner", { eyebrow: f.text("Eyebrow", { width: "half" }), title: f.text("Title", { width: "half" }), cta: f.text("Link text", { width: "half" }), href: f.code("Link", { width: "half" }) }),
  },
  defaults: {
    hero: { eyebrow: "Bundles & seasonal packs", title: "Bundles that make sense. Prices that don't play games.", sub: "Every bundle costs less than its parts and clears the PKR {{catalog.minOrder}} minimum in one tap." },
    heroBundle: "Our hero bundle",
    save: "You save",
    totalTime: "Total time",
    seasonalLabel: "Seasonal home packs",
    seasonal: ["pre-summer-ac", "pre-monsoon"],
    freeQuote: "Free inspection + quote",
    inspection: "Book an inspection",
    bookMessage: "Hi Mjazo! I'd like to book the {{bundle}}.",
    shaadi: { eyebrow: "Shaadi season", title: "Glam for the whole family, from dholki to walima.", cta: "Plan my shaadi glam", href: "/weddings" },
  },
})

// ---------------------------------------------------------------------------

export type GiftContent = {
  hero: Head
  designsHead: Head
  designs: { name: string; sub: string }[]
  order: Head & { submit: string; success: string; whatsapp: string; design: string; amount: string; amounts: string[]; recipient: string; recipientHint: string; phone: string; phoneHint: string; note: string; noteHint: string }
}
page<GiftContent>("gift-cards", {
  label: "Gift cards",
  path: "/gift-cards",
  fields: {
    hero: head("Hero"),
    designsHead: head("Designs section"),
    designs: f.list("Card designs (four)", f.group("Design", { name: f.text("Name", { required: true, width: "half" }), sub: f.text("For", { width: "half" }) }), { itemLabel: "name", min: 4, max: 4, help: "The four card colours stay in this order." }),
    order: f.group("Order form", {
      ...head("x").fields,
      submit: f.text("Submit button", { width: "half" }),
      whatsapp: f.text("WhatsApp message", { width: "half" }),
      success: f.text("Thank-you message"),
      design: f.text("Design label", { width: "half" }),
      amount: f.text("Amount label", { width: "half" }),
      amounts: lines("Amount options"),
      recipient: f.text("Recipient label", { width: "half" }),
      recipientHint: f.text("Recipient placeholder", { width: "half" }),
      phone: f.text("Phone label", { width: "half" }),
      phoneHint: f.text("Phone placeholder", { width: "half" }),
      note: f.text("Message label", { width: "half" }),
      noteHint: f.text("Message placeholder", { width: "half" }),
    }),
  },
  defaults: {
    hero: { eyebrow: "Gift cards", title: "Give a glow-up.", sub: "For birthdays, Eid, the bride-to-be, or just because. Redeemable on every Mjazo service, delivered to their WhatsApp with your message." },
    designsHead: { eyebrow: "Designs", title: "Pick a card for the moment", sub: "" },
    designs: [
      { name: "Glow", sub: "For birthdays" },
      { name: "Eid Mubarak", sub: "For Eid" },
      { name: "Shaadi", sub: "For the bride-to-be" },
      { name: "Shukriya", sub: "For a thank-you" },
    ],
    order: {
      eyebrow: "Order a gift card",
      title: "Order in a minute. We deliver it.",
      sub: "Pick a design and amount, tell us who it's for, and we'll confirm on WhatsApp. Pay by JazzCash, Easypaisa or Raast, and we send the card to them with your message.",
      submit: "Order gift card",
      success: "Order received! We'll WhatsApp you to confirm payment and send the card.",
      whatsapp: "Hi Mjazo! I'd like to buy a gift card.",
      design: "Design",
      amount: "Amount",
      amounts: ["PKR 3,000", "PKR 5,000", "PKR 10,000", "Other"],
      recipient: "Who is it for?",
      recipientHint: "Their first name",
      phone: "Their WhatsApp number",
      phoneHint: "0300 1234567",
      note: "Your message",
      noteHint: "Happy birthday! Treat yourself.",
    },
  },
})

// ---------------------------------------------------------------------------

export type AppContent = { eyebrow: string; title: string; sub: string; features: CardItem[] }
page<AppContent>("app", {
  label: "Get the app",
  path: "/app",
  fields: {
    eyebrow: f.text("Eyebrow"),
    title: f.text("Headline", { required: true }),
    sub: f.textarea("Intro"),
    features: cards("Features (six)", {}, { min: 6, max: 6, help: "Icons stay in this order." }),
  },
  defaults: {
    eyebrow: "iPhone & Android · free",
    title: "Your whole home, one tap away.",
    sub: "Install Mjazo on your home screen in ten seconds. The phone on this page is the real thing: tap through it right now.",
    features: [
      { title: "Opens instantly", body: "Straight from your home screen, full-screen, no app store, no update queue." },
      { title: "Book in two taps", body: "Your area, details and favourites, remembered." },
      { title: "Rebook favourites", body: "Same service, same options, one tap from My bookings." },
      { title: "All of Karachi", body: "Every service, across all {{catalog.areaCount}} neighbourhoods we cover." },
      { title: "WhatsApp updates", body: "Confirmation, your pro's details and check-in, where you already chat." },
      { title: "Tiny and light", body: "A fraction of the size of a store app. Works on any modern phone." },
    ],
  },
})

