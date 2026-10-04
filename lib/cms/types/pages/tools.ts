import { f } from "../../fields"
import { cards, cta, faqs, head, lines, page, type CardItem, type Cta, type Faq, type Head } from "./blocks"

// Weddings and the AI tool pages (Shaadi Orchestrator, Ghar Scan, Home Pulse, Glam Mirror).
// Only the page text is here; the tools' own buttons and messages stay in the code for now.

const accentHelp = "Wrap words in *asterisks* to show them in the italic accent colour."

export type WeddingsContent = {
  hero: Head & { primary: Cta; secondary: Cta }
  who: Head & { items: CardItem[] }
  packages: { label: string; perGuest: string; service: string; bundle: string }
  plan: Head & { steps: { when: string; what: string }[]; more: Cta }
  form: {
    title: string
    submit: string
    whatsapp: string
    event: string
    events: string[]
    date: string
    guests: string
    guestsHint: string
    area: string
    services: string
    serviceOptions: string[]
  }
}
page<WeddingsContent>("weddings", {
  label: "Weddings & events",
  path: "/weddings",
  fields: {
    hero: f.group("Hero", { ...head("x").fields, primary: cta("Main button"), secondary: cta("Second button") }),
    who: f.group("Who we glam", { ...head("x").fields, items: cards("Cards", {}, { max: 6, help: "Up to six; the card colours stay in this order." }) }),
    packages: f.group("Packages", {
      label: f.text("Card label", { width: "half" }),
      perGuest: f.text("Per-guest price", { width: "half", help: "{{price}} becomes the service's price." }),
      service: f.code("Per-guest service", { width: "half", help: "category/service, e.g. makeup-mehndi/squad-glam" }),
      bundle: f.code("Bundle", { width: "half", help: "The bundle's slug, e.g. shaadi-ready" }),
    }),
    plan: f.group("Two-week plan", {
      ...head("x").fields,
      steps: f.list("Steps", f.group("Step", { when: f.text("When", { width: "half", required: true }), what: f.text("What", { width: "half", required: true }) }), { itemLabel: "when" }),
      more: cta("Link under the plan"),
    }),
    form: f.group("Enquiry form", {
      title: f.text("Title"),
      submit: f.text("Submit button", { width: "half" }),
      whatsapp: f.text("WhatsApp message", { width: "half" }),
      event: f.text("Event label", { width: "half" }),
      events: lines("Event options"),
      date: f.text("Date label", { width: "half" }),
      guests: f.text("Guests label", { width: "half" }),
      guestsHint: f.text("Guests placeholder", { width: "half" }),
      area: f.text("Area label", { width: "half" }),
      services: f.text("Services label", { width: "half" }),
      serviceOptions: lines("Service options"),
    }),
  },
  defaults: {
    hero: {
      eyebrow: "Shaadi season",
      title: "From dholki to walima, we've got your glam.",
      sub: "Glam for the whole family, at home. One booking, two or more pros, every outfit on time.",
      primary: { label: "Plan it with Shaadi Orchestrator", href: "/weddings/planner" },
      secondary: { label: "Just send us your dates", href: "#enquire" },
    },
    who: {
      eyebrow: "Who we glam",
      title: "Everyone in the family photo.",
      sub: "",
      items: [
        { title: "The family glam", body: "Mothers, sisters, khalas: party makeup and hair for everyone, at home, on schedule." },
        { title: "Mehndi crew", body: "Henna artists for the bride's hands and feet, and quick designs for every guest." },
        { title: "Guest glam", body: "Soft glam or full glam for guests, so nobody sits in salon traffic in their outfit." },
        { title: "Pre-wedding glow", body: "A two-week plan of facials, waxing, mani-pedi and brows, timed to the big days." },
        { title: "Bridal, by request", body: "Tell us your dates. We'll match you with a senior artist and send a fixed quote." },
        { title: "Office & event days", body: "Wellness days and glam stations for corporate events and celebrations." },
      ],
    },
    packages: { label: "Package", perGuest: "from {{price}} per guest", service: "makeup-mehndi/squad-glam", bundle: "shaadi-ready" },
    plan: {
      eyebrow: "The two-week plan",
      title: "Glowing, not freshly waxed.",
      sub: "",
      steps: [
        { when: "14 days before", what: "Facial: time to settle" },
        { when: "7–10 days", what: "Full body wax" },
        { when: "3–4 days", what: "Brows, upper lip, clean-up" },
        { when: "1–2 days", what: "Gel mani-pedi, hair spa" },
        { when: "On the day", what: "Makeup & hair at home" },
      ],
      more: { label: "Read the full plan", href: "/blog/two-week-shaadi-glow-plan" },
    },
    form: {
      title: "Tell us about your event",
      submit: "Plan my shaadi glam",
      whatsapp: "Hi Mjazo! I'd like to plan glam for a wedding event.",
      event: "Event",
      events: ["Dholki", "Mayun", "Mehndi", "Baraat", "Nikkah", "Walima", "Other"],
      date: "Event date",
      guests: "How many people need glam?",
      guestsHint: "e.g. 6",
      area: "Area",
      services: "What do you need?",
      serviceOptions: ["Party makeup", "Hairstyling", "Mehndi", "Pre-event facial", "Waxing", "Mani-pedi", "Bridal"],
    },
  },
})

// ---------------------------------------------------------------------------

export type ToolHero = { eyebrow: string; title: string; sub: string }
const toolHero = () => f.group("Hero", { eyebrow: f.text("Eyebrow"), title: f.text("Headline", { required: true, help: accentHelp }), sub: f.textarea("Intro") })

export type PlannerContent = { hero: ToolHero }
page<PlannerContent>("shaadi-planner", {
  label: "Shaadi Orchestrator",
  path: "/weddings/planner",
  fields: { hero: toolHero() },
  defaults: {
    hero: {
      eyebrow: "Shaadi Orchestrator · AI",
      title: "Everyone ready, *together*, for every photo.",
      sub: "Tell us your events and who needs glam. We plan each person's pre-wedding glow and work backwards from photo time, so the bride finishes last and nobody waits in their outfit.",
    },
  },
})

export type ToolPageContent = { hero: ToolHero; faqTitle: string; faq: Faq[] }

page<ToolPageContent>("ghar-scan", {
  label: "Ghar Scan",
  path: "/ghar-scan",
  fields: { hero: toolHero(), faqTitle: f.text("FAQ title"), faq: faqs() },
  defaults: {
    hero: {
      eyebrow: "Mjazo AI · Ghar Scan",
      title: "Snap it. See the fix. See the price.",
      sub: "Show us the problem, or the look you want. Our AI reads the photo, names the likely issue and matches it to the right Mjazo service, priced from our menu.",
    },
    faqTitle: "Ghar Scan, explained",
    faq: [
      { q: "Is the price final?", a: "It's a range from the Mjazo menu. Your pro confirms the exact price before starting any work, and parts are always priced separately with your approval." },
      { q: "What happens to my photos?", a: "They're used only to make this recommendation and aren't stored. If you book, nothing from the scan is kept except what you choose to save, like a Look Card." },
      { q: "What if the AI isn't sure?", a: "It tells you so. Tap ‘Show a technician on a video call’ and a person will look at it with you on WhatsApp." },
      { q: "Can it diagnose skin or health problems?", a: "No. Ghar Scan is for home problems and beauty looks only. For health concerns, please see a doctor." },
    ],
  },
})

page<ToolPageContent>("home-pulse", {
  label: "Home Pulse",
  path: "/home-pulse",
  fields: { hero: toolHero(), faqTitle: f.text("FAQ title"), faq: faqs() },
  defaults: {
    hero: {
      eyebrow: "Mjazo AI · Home Pulse",
      title: "Your home's care calendar, kept for you.",
      sub: "Tell us about your home and routine. Home Pulse plans the next 90 days around your bookings, Karachi's seasons, this week's weather, Eid and your family's events, and every reminder is one tap from booking.",
    },
    faqTitle: "Home Pulse, explained",
    faq: [
      { q: "Where does my information go?", a: "Your home profile stays on this device. If you ask for WhatsApp reminders, we keep your number and plan so our team can message you; reply STOP any time." },
      { q: "How does it know what's due?", a: "From your Mjazo bookings on this device, the rhythm you choose, Karachi's seasons (heat, monsoon, dengue, winter), the live weather forecast, Eid dates and the events you add." },
      { q: "Is the Eid date exact?", a: "It follows the Islamic calendar; in Pakistan the moon sighting can move it by a day, so those items are marked approximate." },
    ],
  },
})

export type GlamContent = { hero: ToolHero; tabs: { mehndi: string; makeup: string } }
page<GlamContent>("glam-mirror", {
  label: "Glam Mirror",
  path: "/glam-mirror",
  fields: { hero: toolHero(), tabs: f.group("Mode tabs", { mehndi: f.text("Mehndi tab", { width: "half" }), makeup: f.text("Makeup tab", { width: "half" }) }) },
  defaults: {
    hero: {
      eyebrow: "Glam Mirror · on your phone",
      title: "See the look *before* you book it.",
      sub: "Try mehndi designs on a photo of your own hand, and lip colours, blush, kajal and hair colour live on your face. Pick the one you love and it becomes a Look Card for the pro who comes to you.",
    },
    tabs: { mehndi: "Mehndi on my hand", makeup: "Makeup & hair, live" },
  },
})
