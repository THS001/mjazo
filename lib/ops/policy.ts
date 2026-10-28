// Money policies: what Finance or an Owner sets in mission control → Money → Policies, kept in
// core_meta (lib/core/policy.ts). Pure: the types, the defaults, the checks and the sums, shared by
// the server, mission control and the receipts, and easy to test.

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Mjazo's usual share, when a pro's own rate isn't known yet (it's set per pro in mission control). */
export const DEFAULT_COMMISSION = 0.25

// ---------------------------------------------------------------------------
// Sales tax
// ---------------------------------------------------------------------------

/**
 * Sindh sales tax as Mjazo charges it. This is separate from the pilot gates' modelling inputs:
 * it's off until Finance sets a rate and a start day, and from then every booking made carries it,
 * frozen on the booking.
 */
export type TaxPolicy = {
  /** Bookings made on or after this day (Karachi time) carry the tax; null: off. */
  from: string | null
  /** e.g. 0.08 */
  rate: number
  /** Inside the listed price (Mjazo bears it), or added on top (the customer pays it). */
  inclusive: boolean
  /** On the whole booking (Mjazo as principal), or only on Mjazo's share (as agent: inside the price only). */
  base: "total" | "commission"
  /** The SRB / NTN registration printed on receipts. */
  registration: string
}
export const DEFAULT_TAX: TaxPolicy = { from: null, rate: 0, inclusive: true, base: "total", registration: "" }

/** What a booking carries, frozen when it's made. */
export type TaxTerms = { rate: number; inclusive: boolean; base: "total" | "commission" }

export function taxProblems(p: Partial<TaxPolicy>): string[] {
  const out: string[] = []
  if (p.from != null && (!DATE.test(p.from) || Number.isNaN(Date.parse(p.from)))) out.push("Pick the day sales tax starts")
  if (p.rate !== undefined && !(p.rate >= 0 && p.rate <= 0.25 && Math.abs(Math.round(p.rate * 10000) - p.rate * 10000) < 1e-6)) out.push("Sales tax must be between 0% and 25%, to two decimal places")
  if (p.registration !== undefined && p.registration.length > 60) out.push("The registration number is too long")
  return out
}

/** The terms a booking made on `day` carries, or null when no tax applies to it. */
export function taxTermsOn(p: TaxPolicy, day: string): TaxTerms | null {
  if (!p.from || !(p.rate > 0) || day < p.from) return null
  // On Mjazo's share only, the tax can't be added on top: the customer's price doesn't show it.
  return { rate: p.rate, inclusive: p.base === "commission" ? true : p.inclusive, base: p.base }
}

/**
 * The tax on a booking. Its base is what the booking costs after discounts (principal), or Mjazo's
 * share of the full price less the discounts it funded (agent). Inside the price, the tax is the
 * part of that base that is tax; on top, it's added to it. `commission`: Mjazo's share of the full
 * price (the subtotal less the pro's share), known once a pro does the visit; until then her usual
 * share stands in for it.
 */
export function taxAmount(t: TaxTerms, v: { subtotal: number; discount: number; commission?: number }): number {
  const base = t.base === "commission" ? Math.max(0, (v.commission ?? Math.round(v.subtotal * DEFAULT_COMMISSION)) - v.discount) : Math.max(0, v.subtotal - v.discount)
  return Math.round(t.inclusive ? (base * t.rate) / (1 + t.rate) : base * t.rate)
}

/** A rate as people write it, to the two decimals the policy keeps: 0.08 → "8", 0.0725 → "7.25". */
export const taxPct = (rate: number) => String(Math.round(rate * 10000) / 100)

/** What the customer pays: the price after discounts, plus the tax when it's added on top. */
export const totalWithTax = (subtotal: number, discount: number, t: TaxTerms | null, tax: number) => Math.max(0, subtotal - discount) + (t && !t.inclusive ? tax : 0)
