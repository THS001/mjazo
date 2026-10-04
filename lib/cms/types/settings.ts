import { DEFAULT_SETTINGS, type Settings } from "@/lib/site"
import { f } from "../fields"
import { register } from "../registry"

// Site-wide settings, split into small singletons so each has a focused screen in /admin.

type SiteCms = Omit<Settings["site"], "url">
export const siteType = register<SiteCms, SiteCms>({
  type: "settings-site",
  label: "Company & contact",
  group: "Settings",
  kind: "singleton",
  icon: "Building2",
  perm: "settings",
  tags: ["settings"],
  description: "Name, taglines and the contact details shown across the site, in emails and on WhatsApp links.",
  fields: {
    name: f.text("Company name", { localized: false, required: true }),
    tagline: f.text("Tagline", { max: 60 }),
    positioning: f.textarea("Positioning line", { max: 160 }),
    city: f.text("City"),
    phone: f.code("Support phone", { help: "As shown to customers, e.g. +92 300 1234567." }),
    whatsapp: f.code("WhatsApp number", { help: "Digits only, country code first, e.g. 923001234567. Every “WhatsApp us” button uses this." }),
    email: f.code("Email"),
    instagram: f.code("Instagram URL"),
    hours: f.text("Opening hours"),
  },
  defaults: () => (({ url, ...rest }) => rest)(DEFAULT_SETTINGS.site),
})

export const policyType = register<Settings["policy"], Settings["policy"]>({
  type: "settings-policy",
  label: "Booking policy",
  group: "Settings",
  kind: "singleton",
  icon: "CalendarClock",
  perm: "settings",
  tags: ["settings"],
  description: "Reschedule window, redo promise and lead time. Pages that mention them update automatically. (The six 2-hour time windows are fixed by the booking and dispatch system.)",
  fields: {
    freeChangeHours: f.number("Free changes up to (hours before)", { min: 0, unit: "hrs" }),
    lateFee: f.text("Late-change fee wording"),
    redoHours: f.number("Report an issue within (hours) for a free redo", { min: 0, unit: "hrs" }),
    leadHours: f.number("Earliest slot from now", { min: 0, unit: "hrs" }),
  },
  defaults: () => DEFAULT_SETTINGS.policy,
})

type Money = { plus: Settings["plus"]; referral: Settings["referral"] }
export const moneyType = register<Money, Money>({
  type: "settings-plus",
  label: "Plus & referrals",
  group: "Settings",
  kind: "singleton",
  icon: "Crown",
  perm: "settings",
  tags: ["settings"],
  fields: {
    plus: f.group("Mjazo Plus", {
      price: f.price("Price (PKR)"),
      period: f.text("Billing period", { help: "e.g. year" }),
      discount: f.number("Discount", { min: 0, max: 1, step: 0.01, help: "As a fraction: 0.1 = 10% off." }),
    }),
    referral: f.group("Referrals", {
      friendOff: f.price("Friend gets off first booking (PKR)"),
      youGet: f.price("Referrer gets (PKR)"),
    }),
  },
  defaults: () => ({ plus: DEFAULT_SETTINGS.plus, referral: DEFAULT_SETTINGS.referral }),
})

export const flagsType = register<Settings["flags"], Settings["flags"]>({
  type: "settings-flags",
  label: "Feature switches",
  group: "Settings",
  kind: "singleton",
  icon: "ToggleRight",
  perm: "settings",
  tags: ["settings"],
  description: "Turn features on when the service behind them is ready.",
  fields: {
    ONLINE_PAYMENTS: f.boolean("Online card payments", { help: "Needs a payment gateway merchant account." }),
    OTP_LOGIN: f.boolean("OTP login", { help: "Needs an SMS provider." }),
    PLUS_PURCHASE: f.boolean("Buy Plus online"),
    GIFT_CARDS: f.boolean("Buy gift cards online"),
    URDU_SITE: f.boolean("Urdu site (/ur) public", { help: "Shows the language switch, lists Urdu pages for search engines (hreflang, sitemap) and lets Google index them. Leave off until the Urdu text has been reviewed; editors can preview /ur either way." }),
  },
  defaults: () => DEFAULT_SETTINGS.flags,
})
