// Editorial content: FAQs, help centre, blog, safety, partner, about and legal copy.
// Policy values and legal copy should be reviewed by the founder and a lawyer.

// Built-in copy: the CMS defaults (lib/cms/types). {{tokens}} such as {{policy.redoHours}} or
// {{catalog.areaNames}} are filled in from the live settings and catalogue when the page renders.

export const HOME_FAQ: [string, string][] = [
  ["What can I book?", `Everything on the menu: {{catalog.categoryCount}} categories, from salon at home and spa to cleaning, AC service, repairs, health visits and care, across {{catalog.areaCount}} Karachi neighbourhoods: {{catalog.areaNames}}.`],
  ["Who are the pros?", "Every beauty and spa pro is a woman who has passed an interview, a practical test, a CNIC and background check, and Mjazo training."],
  ["Are prices final?", "Yes. Prices are all-in, with no visit fee and no haggling. If you add something on the day, your pro will confirm the price first."],
  ["How do I pay?", "After your service: cash, JazzCash, Easypaisa or Raast. No card needed, nothing to pay upfront."],
  ["What if I'm not happy?", `Tell us within {{policy.redoHours}} hours and we'll send a pro to redo it, free.`],
  ["Can I book for a group or an event?", "Yes. Squad Glam covers 3+ guests, and our Weddings team plans glam for the whole family."],
]

// ---------------------------------------------------------------------------
// Help centre
// ---------------------------------------------------------------------------
export interface HelpTopic {
  slug: string
  title: string
  icon: string
  blurb: string
  articles: [string, string][]
}

export const helpTopics: HelpTopic[] = [
  {
    slug: "booking", title: "Booking", icon: "CalendarCheck", blurb: "Slots, areas, groups and changes",
    articles: [
      ["How do I book?", "Pick your services, add them to your cart, choose a date and time window, enter your address and confirm. It takes about two minutes. You'll get a WhatsApp confirmation."],
      ["Which areas do you cover?", `{{catalog.areaNames}}. Tap ‘Check my area’ on any page to see the sub-areas we cover.`],
      ["How early can I book?", `Up to 7 days ahead. The earliest slot is about {{policy.leadHours}} hours from now, so your pro has time to travel.`],
      ["Can I book for more than one person?", "Yes. Add the service once per person, or use Squad Glam for 3+ guests. For bigger events, use the Weddings & Events enquiry."],
      ["Can I ask for the same pro again?", "Yes. Mention her in the booking notes and we'll match her whenever she's free."],
    ],
  },
  {
    slug: "prices-payment", title: "Prices & payment", icon: "Wallet", blurb: "All-in prices, how to pay",
    articles: [
      ["Are your prices final?", "Yes. Prices are all-in: no visit fee, no travel charge, no haggling. If you add a service on the day, your pro will confirm the price before starting."],
      ["How do I pay?", "After the service: cash, JazzCash, Easypaisa or Raast. Nothing to pay when you book."],
      ["Is there a minimum order?", "Yes, PKR 2,500 per visit, so your pro's travel time is worth it. Bundles make it easy to reach."],
      ["Do you charge tax?", "Prices shown are what you pay. If that changes, we'll show it clearly before you book."],
    ],
  },
  {
    slug: "safety", title: "Safety & pros", icon: "ShieldCheck", blurb: "Vetting, women-only, check-in",
    articles: [
      ["Are beauty pros women?", "Always. Every Mjazo beauty and spa pro is a woman."],
      ["How do you vet pros?", "Five steps: application, interview, practical skills test, CNIC and background check, then Mjazo training and certification. Only then does she get her first booking."],
      ["How do I know who is coming?", "You'll get your pro's first name and photo on WhatsApp before the visit. She checks in when she arrives and checks out when she leaves."],
      ["What if I feel unsafe?", "Call or WhatsApp our women-led support line straight away. In an emergency, call 15 or 1122 first."],
    ],
  },
  {
    slug: "products-hygiene", title: "Products & hygiene", icon: "Sparkles", blurb: "Sealed kits, what we use",
    articles: [
      ["What is a sealed kit?", "Single-use items (spatulas, strips, files, buffers, sheets) packed and sealed for your visit, opened in front of you."],
      ["What products do you use?", "Professional salon brands, chosen by our trainers. If you have allergies or a favourite product, add it to your booking notes."],
      ["Do I need to provide anything?", "Just a little space and good light. Your pro brings sheets, towels and everything else, and cleans up after."],
    ],
  },
  {
    slug: "changes-cancellations", title: "Changes & cancellations", icon: "RefreshCw", blurb: "Reschedule, cancel, redo",
    articles: [
      ["Can I reschedule or cancel?", `Yes, free up to {{policy.freeChangeHours}} hours before your slot. Later changes may carry {{policy.lateFee}}. WhatsApp us to change a booking.`],
      ["What if my pro is late?", "We'll tell you as soon as we know. If she's more than 30 minutes late, we'll offer you a new slot or cancel at no charge."],
      ["What if I'm not happy?", `Tell us within {{policy.redoHours}} hours. We'll send a pro to redo it, free.`],
    ],
  },
  {
    slug: "for-pros", title: "For pros", icon: "BadgeCheck", blurb: "Joining, training, payouts",
    articles: [
      ["How do I join Mjazo?", "Apply online in 2 minutes (English or Urdu), or send a WhatsApp voice note. We'll call you for an interview."],
      ["Do I need my own kit?", "No. Mjazo supplies sealed kits and products."],
      ["How do I get paid?", "Weekly. Final terms are shared at your interview."],
    ],
  },
]

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------
export const SAFETY_STEPS = [
  { title: "Apply", body: "Every pro applies with her experience, skills and references." },
  { title: "Interview", body: "A face-to-face interview with our women-led team." },
  { title: "Practical test", body: "She performs real services for our trainers before anything else." },
  { title: "CNIC & background", body: "Identity verified against her CNIC, plus a background check." },
  { title: "Training", body: "Mjazo training in hygiene, etiquette and our service standards, then certification." },
]

export const SAFETY_PILLARS = [
  { icon: "UserCheck", title: "Women-only for beauty", body: "Every beauty and spa visit is done by a woman. No exceptions." },
  { icon: "PackageCheck", title: "Sealed single-use kits", body: "Opened in front of you. Spatulas, strips, files and sheets never reused." },
  { icon: "MapPin", title: "Live check-in & out", body: "Ops sees when your pro arrives and leaves. So can you, on WhatsApp." },
  { icon: "PhoneCall", title: "Women-led support", body: "A real person answers, every day 9 am – 9 pm." },
  { icon: "Sparkles", title: "Hygiene standards", body: "Sanitised tools, fresh gloves and disposable sheets, every time." },
  { icon: "RefreshCw", title: "Love it or we redo it", body: `Not happy? Tell us within {{policy.redoHours}} hours and we'll redo it, free.` },
]

// ---------------------------------------------------------------------------
// Become a Pro (English / Urdu / Roman Urdu)
// ---------------------------------------------------------------------------
export type Lang = "en" | "ur" | "ro"

export const PARTNER = {
  h1: { en: "Your skills. Your schedule. Better pay.", ur: "آپ کی مہارت۔ آپ کا وقت۔ بہتر کمائی۔", ro: "Apni skills. Apna time. Behtar kamai." },
  sub: {
    en: "Join Karachi's women-only beauty team. We bring the bookings, the kit and the support. You bring the talent.",
    ur: "کراچی کی خواتین کی بیوٹی ٹیم میں شامل ہوں۔ بکنگ، سامان اور سپورٹ ہماری۔ ہنر آپ کا۔",
    ro: "Karachi ki women-only beauty team join karein. Bookings, saaman aur support humari. Hunar aapka.",
  },
  cta: { en: "Apply in 2 minutes", ur: "۲ منٹ میں درخواست دیں", ro: "2 minute mein apply karein" },
  voice: { en: "Or send a WhatsApp voice note", ur: "یا واٹس ایپ پر وائس نوٹ بھیجیں", ro: "Ya WhatsApp pe voice note bhejein" },
  benefits: [
    { icon: "Wallet", en: "Weekly payouts", ur: "ہفتہ وار ادائیگی", ro: "Har hafte payment" },
    { icon: "CalendarCheck", en: "Pick your own days", ur: "اپنے دن خود چنیں", ro: "Apne din khud chunein" },
    { icon: "Car", en: "Safe transport support", ur: "محفوظ سفر کا انتظام", ro: "Mehfooz safar ka intezam" },
    { icon: "Users", en: "Women-only team & support", ur: "صرف خواتین کی ٹیم اور سپورٹ", ro: "Sirf khawateen ki team aur support" },
    { icon: "GraduationCap", en: "Free training & certificate", ur: "مفت ٹریننگ اور سرٹیفکیٹ", ro: "Muft training aur certificate" },
    { icon: "PackageCheck", en: "Kits & products supplied", ur: "سامان ہم دیں گے", ro: "Saaman hum denge" },
  ],
  steps: [
    { en: "Apply", ur: "درخواست", ro: "Apply" },
    { en: "Interview", ur: "انٹرویو", ro: "Interview" },
    { en: "Practical test", ur: "پریکٹیکل ٹیسٹ", ro: "Practical test" },
    { en: "Training", ur: "ٹریننگ", ro: "Training" },
    { en: "First booking", ur: "پہلی بکنگ", ro: "Pehli booking" },
  ],
  note: {
    en: "Earnings and final terms are shared at your interview.",
    ur: "کمائی اور شرائط انٹرویو میں بتائی جائیں گی۔",
    ro: "Kamai aur shartein interview mein batayi jayengi.",
  },
}

export const SKILLS: { id: string; en: string; ur: string; ro: string }[] = [
  { id: "waxing", en: "Waxing", ur: "ویکسنگ", ro: "Waxing" },
  { id: "threading", en: "Threading", ur: "تھریڈنگ", ro: "Threading" },
  { id: "facials", en: "Facials", ur: "فیشل", ro: "Facial" },
  { id: "mani-pedi", en: "Mani-pedi", ur: "مینی کیور پیڈی کیور", ro: "Mani-pedi" },
  { id: "hair", en: "Hair", ur: "بال", ro: "Baal" },
  { id: "makeup", en: "Makeup", ur: "میک اپ", ro: "Makeup" },
  { id: "mehndi", en: "Mehndi", ur: "مہندی", ro: "Mehndi" },
  { id: "nails-lashes", en: "Nails & lashes", ur: "ناخن اور پلکیں", ro: "Nails aur lashes" },
  { id: "massage", en: "Massage", ur: "مساج", ro: "Massage" },
]

export const APPLY_LABELS = {
  name: { en: "Full name", ur: "پورا نام", ro: "Poora naam" },
  phone: { en: "Mobile / WhatsApp number", ur: "موبائل / واٹس ایپ نمبر", ro: "Mobile / WhatsApp number" },
  area: { en: "Where do you live?", ur: "آپ کہاں رہتی ہیں؟", ro: "Aap kahan rehti hain?" },
  skills: { en: "What can you do?", ur: "آپ کیا کام کرتی ہیں؟", ro: "Aap kya kaam karti hain?" },
  experience: { en: "Experience", ur: "تجربہ", ro: "Tajurba" },
  availability: { en: "Which days can you work?", ur: "آپ کن دنوں کام کر سکتی ہیں؟", ro: "Aap kin dinon kaam kar sakti hain?" },
  transport: { en: "Getting around", ur: "آنے جانے کا ذریعہ", ro: "Aane jaane ka zariya" },
  portfolio: { en: "Instagram or portfolio link (optional)", ur: "انسٹاگرام یا کام کا لنک (اختیاری)", ro: "Instagram ya kaam ka link (optional)" },
  next: { en: "Next", ur: "اگلا", ro: "Aage" },
  back: { en: "Back", ur: "پیچھے", ro: "Peeche" },
  submit: { en: "Send application", ur: "درخواست بھیجیں", ro: "Application bhejein" },
  privacy: {
    en: "We never ask for your CNIC online. We'll check it in person at the interview.",
    ur: "ہم آن لائن شناختی کارڈ نہیں مانگتے۔ یہ انٹرویو پر دیکھا جائے گا۔",
    ro: "Hum online CNIC nahi maangte. Yeh interview pe dekha jayega.",
  },
}

export const EXPERIENCE = [
  { id: "<1", en: "Less than 1 year", ur: "ایک سال سے کم", ro: "1 saal se kam" },
  { id: "1-3", en: "1–3 years", ur: "۱ سے ۳ سال", ro: "1–3 saal" },
  { id: "3-5", en: "3–5 years", ur: "۳ سے ۵ سال", ro: "3–5 saal" },
  { id: "5+", en: "5+ years", ur: "۵ سال سے زیادہ", ro: "5+ saal" },
]
export const DAYS = [
  { id: "mon", en: "Mon", ur: "پیر", ro: "Peer" },
  { id: "tue", en: "Tue", ur: "منگل", ro: "Mangal" },
  { id: "wed", en: "Wed", ur: "بدھ", ro: "Budh" },
  { id: "thu", en: "Thu", ur: "جمعرات", ro: "Jumeraat" },
  { id: "fri", en: "Fri", ur: "جمعہ", ro: "Juma" },
  { id: "sat", en: "Sat", ur: "ہفتہ", ro: "Hafta" },
  { id: "sun", en: "Sun", ur: "اتوار", ro: "Itwaar" },
]
export const TRANSPORT = [
  { id: "own", en: "I have my own transport", ur: "میری اپنی سواری ہے", ro: "Meri apni sawari hai" },
  { id: "need", en: "I need transport support", ur: "مجھے سفر میں مدد چاہیے", ro: "Mujhe safar mein madad chahiye" },
]

// ---------------------------------------------------------------------------
// Blog / guides
// ---------------------------------------------------------------------------
export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  minutes: number
  tag: string
  tint: string
  cover?: import("@/lib/cms/fields").Img
  body: { h?: string; p: string }[]
}

export const posts: Post[] = [
  {
    slug: "two-week-shaadi-glow-plan", title: "The two-week shaadi glow plan", tag: "Beauty", tint: "#f6d9cf", date: "2026-10-01", minutes: 4,
    excerpt: "What to book, and when, so you walk into the mehndi glowing and not freshly red from a wax.",
    body: [
      { p: "Wedding season in Karachi is a marathon: dholki, mehndi, baraat, walima, and somebody's cousin's nikkah in between. Timing matters more than any single treatment. Here's the plan our trainers give their own families." },
      { h: "14 days before", p: "Book a hydrating or brightening facial. Anything that exfoliates needs a full week or two to settle, and this is the time to find out how your skin reacts. Start drinking water like it's your job." },
      { h: "7–10 days before", p: "Full body wax. Redness and the odd bump calm down within a few days, so a week out is the sweet spot. If you've never had Rica (peel-off) wax and have sensitive skin, try it now rather than the night before." },
      { h: "3–4 days before", p: "Brows and upper lip threading, plus a clean-up if your skin feels congested. Don't try a new product this week." },
      { h: "1–2 days before", p: "Mani-pedi with gel polish so it survives the mehndi. Hair spa or a protein treatment the day before blow-dries." },
      { h: "On the day", p: "Party makeup and hair at home, so you're not sitting in salon traffic in your outfit. For the whole family, book Squad Glam: two pros, one booking." },
    ],
  },
  {
    slug: "pre-monsoon-home-checklist", title: "The pre-monsoon home checklist for Karachi", tag: "Home", tint: "#d7e4f2", date: "2026-09-20", minutes: 3,
    excerpt: "Roofs, drains, tanks and mosquitoes: five jobs to do before the first heavy rain.",
    body: [
      { p: "Karachi's monsoon is short but it finds every weak spot. These five jobs, done in May or June, save the most heartache." },
      { h: "1. Check the roof", p: "Look for cracks, blistered paint and damp patches on top-floor ceilings. A waterproofing coat is far cheaper before the rain than seepage repair after it." },
      { h: "2. Clear the drains", p: "Roof outlets, balcony drains and the main line. A blocked outlet turns a roof into a pool in one evening." },
      { h: "3. Clean the water tanks", p: "Flooding can push dirty water into underground tanks. Clean and disinfect before the season, and again after." },
      { h: "4. Fumigate", p: "Dengue season follows the rain. Fog the lawn, plant pots and any standing water spots." },
      { h: "5. Service the AC drains", p: "Blocked AC drain pipes leak down walls during humid weeks. A quick service fixes it." },
      { p: "Every one of these jobs is on Mjazo: roof waterproofing, tank cleaning, fumigation and AC servicing, booked in two minutes and paid after." },
    ],
  },
  {
    slug: "how-we-vet-every-pro", title: "How we vet every Mjazo pro", tag: "Safety", tint: "#e3e6cf", date: "2026-09-10", minutes: 3,
    excerpt: "Five steps, no shortcuts. What happens before any pro rings your doorbell.",
    body: [
      { p: "Letting someone into your home takes trust. We'd rather earn it slowly than ask for it. Here's exactly what happens before a pro gets her first Mjazo booking." },
      { h: "Application and interview", p: "She tells us about her experience and skills, then meets our women-led team in person." },
      { h: "Practical test", p: "She performs real services for our trainers. Technique, hygiene and manner all count." },
      { h: "CNIC and background check", p: "We verify her identity against her CNIC and run a background check. We never ask for CNICs online: we see them in person." },
      { h: "Training and certification", p: "Our standards: sealed kits, fresh gloves, disposable sheets, check-in and check-out, and how to handle anything unexpected." },
      { h: "And after", p: "Every visit is rated. Pros who fall below our standard are retrained or removed." },
    ],
  },
]

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------
export const VALUES = [
  { title: "Safety first", body: "Women-only beauty pros, real vetting and live check-ins. If a shortcut makes it less safe, we don't take it." },
  { title: "Fair to pros", body: "Weekly pay, free training, supplied kits and safe transport. Good pros stay where they're treated well." },
  { title: "Clear prices", body: "What you see is what you pay. No visit fee, no haggling, no surprises at the door." },
  { title: "Built for Karachi", body: "From shaadi season to load-shedding to the monsoon, we build for the city we live in." },
]

// ---------------------------------------------------------------------------
// Legal (DRAFT: needs review by a Pakistani lawyer before launch)
// ---------------------------------------------------------------------------
export interface LegalDoc {
  slug: string
  title: string
  updated: string
  sections: { h: string; p: string }[]
}

export const legal: Record<string, LegalDoc> = {
  terms: {
    slug: "terms", title: "Terms of service", updated: "2 October 2026",
    sections: [
      { h: "Who we are", p: `{{site.name}} is a marketplace that connects customers in Karachi with vetted, independent service professionals ("pros"). By booking through our website, app or WhatsApp you agree to these terms.` },
      { h: "Bookings", p: "A booking is confirmed when you receive a confirmation from us. We match you with an available pro; we may change the assigned pro if needed and will tell you before the visit." },
      { h: "Prices and payment", p: "Prices shown are all-in for the services listed. Extra services added on the day are priced before they start. You pay after the service by the methods shown at checkout." },
      { h: "Changes and cancellations", p: `You can change or cancel free of charge up to {{policy.freeChangeHours}} hours before your slot. Later changes may carry {{policy.lateFee}}. See our cancellation & refund policy.` },
      { h: "Your responsibilities", p: "Please give accurate address and contact details, provide a safe and suitable space, and treat pros with respect. We may refuse or end a visit if a pro feels unsafe." },
      { h: "Service quality", p: `If you're not happy, tell us within {{policy.redoHours}} hours. We'll investigate and, where appropriate, arrange a redo or refund.` },
      { h: "Liability", p: "We take care in vetting and training pros. To the extent the law allows, our liability is limited to the amount you paid for the affected booking." },
      { h: "Changes to these terms", p: "We may update these terms. The latest version is always on this page." },
      { h: "Contact", p: `Questions? Email {{site.email}} or WhatsApp us.` },
    ],
  },
  privacy: {
    slug: "privacy", title: "Privacy policy", updated: "2 October 2026",
    sections: [
      { h: "What we collect", p: "Your name, phone number, address, booking details and messages with us. If you arrive from an ad, we store the campaign tags (UTM) with your enquiry so we know which ads work." },
      { h: "Why we collect it", p: "To deliver your bookings, send confirmations and reminders, improve our service and, with your consent, tell you about offers." },
      { h: "Who we share it with", p: "Only the pro assigned to your booking (first name, area, address and service details) and service providers who help us run Mjazo (hosting, messaging, analytics). We never sell your data." },
      { h: "Pros' data", p: "We never collect CNIC images online. Identity documents are checked in person." },
      { h: "Cookies and analytics", p: "We use cookies and similar tools to keep your cart and area, and to measure how the site is used." },
      { h: "Your choices", p: `You can ask us to access, correct or delete your data at any time: email {{site.email}}.` },
      { h: "Keeping it safe", p: "Access to customer data is restricted to staff who need it, and every access to booking data is logged." },
    ],
  },
  "cancellation-refund": {
    slug: "cancellation-refund", title: "Cancellation & refund policy", updated: "2 October 2026",
    sections: [
      { h: "Free changes", p: `Cancel or reschedule free of charge up to {{policy.freeChangeHours}} hours before your slot.` },
      { h: "Late changes", p: `Changes within {{policy.freeChangeHours}} hours of your slot, or if your pro arrives and can't start, may carry {{policy.lateFee}}. This pays the pro for her travel and time.` },
      { h: "If we're late or cancel", p: "If your pro is more than 30 minutes late, you can reschedule or cancel at no charge. If we cancel, you'll never be charged." },
      { h: "Not happy?", p: `Tell us within {{policy.redoHours}} hours with details or photos. We'll arrange a free redo, or a refund where a redo isn't suitable.` },
      { h: "Refunds", p: "Refunds for online payments go back to the original payment method. Cash refunds are made by bank transfer, JazzCash or Easypaisa." },
    ],
  },
  "pro-code-of-conduct": {
    slug: "pro-code-of-conduct", title: "Pro code of conduct", updated: "2 October 2026",
    sections: [
      { h: "Respect", p: "Treat every customer and their home with respect. Arrive on time, dressed in Mjazo uniform, with your ID card." },
      { h: "Hygiene", p: "Open the sealed kit in front of the customer. Use fresh gloves and disposable sheets. Never reuse single-use items." },
      { h: "Safety", p: "Check in on arrival and check out on leaving. If you ever feel unsafe, leave and call Mjazo support: your safety comes first." },
      { h: "Honesty", p: "Quote prices only from the Mjazo menu. Confirm any extra service and its price before starting." },
      { h: "Privacy", p: "Never share customer details, photos or addresses. Don't take photos without permission." },
      { h: "Bookings stay on Mjazo", p: "All bookings with Mjazo customers go through Mjazo, which keeps both you and the customer protected." },
    ],
  },
}
