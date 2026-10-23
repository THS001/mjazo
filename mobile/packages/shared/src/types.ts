// What the Mjazo API answers, as the apps use it. These mirror the server (lib/server/app-catalog.ts,
// customer-api.ts, pro-api.ts); a field the server adds later is simply ignored.

// ---------------------------------------------------------------------------
// The catalogue (/api/v1/catalog)
// ---------------------------------------------------------------------------

export type VariantOption = { label: string; key: string; delta: number }
export type Service = {
  slug: string
  name: string
  short: string
  price: number // "from" price; 0 = price on request
  duration: number
  popular: boolean
  variants: { label: string; options: VariantOption[] }[]
  addOns: { id: string; name: string; price: number }[]
  includes: string[]
  image: string | null
}
export type Category = { slug: string; name: string; world: string; icon: string; tagline: string; proType: "women" | "technician" | "care"; status: "live" | "waitlist" | "hidden"; includes: string[]; image: string | null; services: Service[] }
export type World = { slug: string; name: string; short: string; icon: string; tint: string; image: string | null }
export type Area = { slug: string; name: string; subAreas: string[]; center: { lat: number; lng: number } | null }
export type Catalog = {
  lang: "en" | "ur"
  worlds: World[]
  categories: Category[]
  areas: Area[]
  windows: string[]
  minOrder: number
  policy: { freeChangeHours: number; leadHours: number; redoHours: number }
  contact: { phone: string; whatsapp: string; email: string; hours: string }
  plus: { price: number; discountPct: number }
  referral: { friendOff: number; youGet: number }
}

/** A line in the cart, as a booking sends it (options by their English key, add-ons by id). */
export type CartItem = { key: string; name: string; category: string; service: string; options: string[]; optionLabels: string[]; addOns: string[]; addOnNames: string[]; qty: number; unitPrice: number; duration: number }

export type Slots = { mode: "off" | "open" | "capacity" | "unavailable"; days: { date: string; windows: { label: string; open: boolean }[] }[] }

// ---------------------------------------------------------------------------
// The customer (/api/v1/customer)
// ---------------------------------------------------------------------------

export type Customer = { id: string; name: string; phone: string | null; email: string | null; lang: string; marketingOk: boolean }
export type MePlus = { status: "requested" | "active"; endsAt: string | null; discountPct: number; price: number }
export type MeReferral = { code: string; friendOff: number; youGet: number; friends: number; rewarded: number; earned: number }
export type Me = { email: string | null; by?: "email" | "phone"; customer: Customer | null; credit: { balance: number; available: number }; plus?: MePlus | null; referral?: MeReferral | null }
export type Address = { id: string; label: string | null; area: string; subArea: string | null; line: string; landmark: string | null; lat: number | null; lng: number | null; isDefault: boolean }
export type BookingStatus = "new" | "assigned" | "en_route" | "checked_in" | "checked_out" | "completed" | "cancelled" | "no_show"
export type CustomerBooking = {
  id: string
  createdAt: string
  date: string
  window: string
  status: BookingStatus
  area: string
  areaName: string
  subArea: string | null
  address: string
  landmark: string | null
  items: { name: string; category: string; service: string; options: string[]; addOns: string[]; qty: number; unitPrice: number }[]
  subtotal: number
  discount: number
  total: number
  credit: number
  /** A visit of their prepaid pack: the pack pays this much of the total. */
  pack: { name: string; paid: number } | null
  due: number
  payment: string
  pro: { firstName: string } | null
  askedFor: { id: string; firstName: string } | null
  eta: string | null
  live: { lat: number; lng: number; at: string; km: number | null; minutes: number | null } | null
  steps: { booked: string; assigned: string | null; onTheWay: string | null; arrived: string | null; done: string | null; cancelled: string | null }
  canChange: boolean
  changeUntil: string | null
  rating: { stars: number } | null
  rebookWith: { id: string; firstName: string } | null
}
export type PromoProblem = "invalid" | "notYet" | "expired" | "minOrder" | "usedUp" | "used"
export type PromoCheck = { ok: true; code: string; discount: number; kind?: "referral" } | { ok: false; code?: string; problem: PromoProblem; minOrder?: number }
/** One visit of a pack as a cart line (unitPrice: the service's own price, without the pack). */
export type PackLine = { name: string; category: string; service: string; options: string[]; unitPrice: number; duration: number }
export type PackOffer = { slug: string; name: string; note: string; itemName: string; visits: number; visitPrice: number; listPrice: number; total: number; saving: number; everyDays: number; validDays: number; line: PackLine }
export type MyPack = {
  id: string
  slug: string
  name: string
  itemName: string
  line: PackLine | null
  status: "requested" | "active" | "cancelled"
  visits: number
  visitPrice: number
  total: number
  everyDays: number
  endsAt: string | null
  used: number
  booked: number
  left: number
  nextDue: string | null
  expired: boolean
}
export type Packs = { offers: PackOffer[]; mine: MyPack[] }

// ---------------------------------------------------------------------------
// The pro (/api/v1/pro)
// ---------------------------------------------------------------------------

export type ProProfile = { id: string; name: string; phone: string; email: string | null; area: string; zones: string[]; skills: string[]; verified: boolean; dailyCap: number; rating: { average: number | null; count: number } }
export type SafetyLevel = "ok" | "late" | "overdue" | "escalated" | "sos"
export type Visit = {
  id: string
  date: string
  window: string
  eta: string | null
  status: BookingStatus
  area: string
  subArea: string | null
  address: string
  landmark: string | null
  customer: { name: string; phone: string }
  items: { name: string; options: string[]; addOns: string[]; qty: number; unitPrice: number }[]
  total: number
  credit: number
  pack: { name: string; paid: number } | null
  due: number
  askedForYou: boolean
  earn: number
  payment: string
  notes: string | null
  minutes: number
  checkedInAt: string | null
  brief: { kind: "scan" | "look"; title: string; text: string; causes?: string[]; parts?: string[] } | null
  photos: string[]
  safety: { level: SafetyLevel; message: string }
  paid: { status: string; amount: number; method: string } | null
  lastNotes: string[]
}
export type Schedule = { today: string; days: { date: string; visits: Visit[] }[]; week: { earned: number; visits: number }; openOffers: number; ai: boolean }
export type Offer = {
  id: string
  status: "pending" | "accepted" | "declined" | "expired" | "withdrawn"
  offeredAt: string
  expiresAt: string
  respondedAt: string | null
  reason: string | null
  visit: { id: string; date: string; window: string; area: string; subArea: string | null; services: { name: string; options: string[]; addOns: string[]; qty: number }[]; minutes: number; earn: number; payment: string; hasBrief: boolean; askedForYou: boolean }
}
export type StatementLine = { entryId: number; at: string; kind: string; bookingId: string | null; memo: string | null; cash: number; earned: number }
export type Payout = { id: string; periodStart: string; periodEnd: string; earned: number; cashHeld: number; netted: number; amount: number; status: "draft" | "approved" | "paid" | "cancelled"; reference: string | null; paidAt: string | null }
export type Earnings = { balances: { owed: number; cashHeld: number; net: number }; week: { earned: number; visits: number }; month: { earned: number; visits: number }; statement: StatementLine[]; payouts: Payout[] }
export type Ratings = { count: number; average: number | null; stars: Record<"1" | "2" | "3" | "4" | "5", number>; recent: { bookingId: string; day: string; services: string[]; stars: number; tags: string[]; comment: string | null; at: string }[] }
export type Availability = { availability: Record<string, string[]> | null; timeOff: string[]; windows: string[]; busyDays: string[]; dailyCap: number }
