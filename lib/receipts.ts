// Receipts (migration 0014): what a customer was charged for a visit, frozen when it was done.
// Shared by the server, the receipt page, the account and mission control.

export type ReceiptTax = {
  amount: number
  rate: number
  /** Inside the listed price, or added on top. */
  inclusive: boolean
  /** On the whole booking, or only on Mjazo's share. */
  base: "total" | "commission"
  /** What the tax was worked out on, before the tax. */
  taxable: number
}

export type ReceiptData = {
  bookingId: string
  date: string
  window: string
  customer: { name: string; area: string; subArea: string | null }
  /** The pro's first name. */
  pro: string | null
  lines: { name: string; options: string[]; addOns: string[]; qty: number; unitPrice: number }[]
  subtotal: number
  /** Every discount together (a promo code, Plus or a friend's referral, and a pack's saving). */
  discount: number
  discounts: ("promo" | "plus" | "referral" | "pack")[]
  promo: string | null
  tax: ReceiptTax | null
  total: number
  /** Wallet credit used. */
  credit: number
  pack: { name: string; paid: number } | null
  /** Mjazo's SRB / NTN registration when it was issued. */
  registration: string
}

export type Receipt = { no: number; number: string; bookingId: string; customerId: string | null; issuedAt: string; total: number; tax: number; data: ReceiptData }

/** MJR-000123 */
export const receiptNumber = (no: number) => `MJR-${String(no).padStart(6, "0")}`

/** The number in "MJR-000123" (or "123"), or null. */
export function parseReceiptNumber(s: string): number | null {
  const m = /^(?:MJR-)?0*(\d{1,12})$/i.exec(s.trim())
  const n = m ? Number(m[1]) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** A receipt link without its domain, so the website opens it on the site it's on (the full link is for messages and the app). */
export const receiptPath = (url: string) => url.replace(/^https?:\/\/[^/]+/, "")

/** What was left to pay at the door: the total less the credit and the pack. */
export const receiptDue = (d: ReceiptData) => Math.max(0, d.total - d.credit - (d.pack?.paid ?? 0))
