import "server-only"
import type { Db } from "./db"
import { policy, receiptsReady } from "./policy"
import type { Job } from "@/lib/ops/types"
import { receiptNumber, type Receipt, type ReceiptData } from "@/lib/receipts"

// Receipts (migration 0014). One per completed visit, issued in the same transaction that posts
// the visit to the ledger: a gapless number from a locked counter, and a frozen copy of what was
// charged. A visit done before 0014 ran gets its receipt the first time someone opens it.

type ReceiptRow = { no: number; booking_id: string; customer_id: string | null; issued_at: string; total: number; tax: number; data: ReceiptData }

const toReceipt = (r: ReceiptRow): Receipt => ({ no: r.no, number: receiptNumber(r.no), bookingId: r.booking_id, customerId: r.customer_id, issuedAt: r.issued_at, total: r.total, tax: r.tax, data: r.data })
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

/**
 * The receipt for a completed visit, issued now if it has none yet. `commission`: Mjazo's share of
 * the full price, when the caller knows it (for tax on Mjazo's share only). Null for a visit that
 * isn't done, or before migration 0014.
 */
export async function ensureReceipt(db: Db, job: Job, opts: { commission?: number } = {}): Promise<Receipt | null> {
  if (job.status !== "completed" || !(await receiptsReady(db))) return null
  return db.tx(async (t) => {
    // The booking's lock first, then the counter's: one receipt per visit, and no gaps.
    const b = await t.one<{ customer_id: string | null; subtotal: number; discount: number; promo_code: string | null }>("select customer_id, subtotal, discount, promo_code from bookings where id = $1 for update", [job.id])
    if (!b) return null
    const have = await t.one<ReceiptRow>("select * from receipts where booking_id = $1", [job.id])
    if (have) return toReceipt(have)
    const pro = job.proId ? await t.one<{ name: string }>("select name from pros where id = $1", [job.proId]) : null
    const credit = (await t.one<{ n: number }>("select coalesce(sum(p.amount), 0)::int as n from journal_entries e join postings p on p.entry_id = e.id where e.booking_id = $1 and e.kind = 'credit_applied' and p.account_id like 'cust:%:credit'", [job.id]))!.n
    const { registration } = await policy(t, "tax")
    const code = b.promo_code
    const discounts: ReceiptData["discounts"] = []
    if (code === "PLUS") discounts.push("plus")
    else if (code?.startsWith("REF:")) discounts.push("referral")
    else if (code) discounts.push("promo")
    if (job.pack) discounts.push("pack")
    const tax = job.tax?.amount ? job.tax : null
    const data: ReceiptData = {
      bookingId: job.id,
      date: job.date,
      window: job.window,
      customer: { name: job.customer.name, area: job.area, subArea: job.subArea ?? null },
      pro: pro ? firstName(pro.name) : null,
      lines: job.items.map((i) => ({ name: i.name, options: i.options, addOns: i.addOns, qty: i.qty, unitPrice: i.unitPrice })),
      subtotal: b.subtotal,
      discount: b.discount,
      discounts,
      promo: code && code !== "PLUS" && !code.startsWith("REF:") ? code : null,
      tax: tax && {
        amount: tax.amount,
        rate: tax.rate,
        inclusive: tax.inclusive,
        base: tax.base,
        taxable: tax.base === "commission" ? (opts.commission !== undefined ? Math.max(0, opts.commission - b.discount) - tax.amount : Math.round(tax.amount / tax.rate)) : Math.max(0, b.subtotal - b.discount) - (tax.inclusive ? tax.amount : 0),
      },
      total: job.total,
      credit,
      pack: job.pack ? { name: job.pack.name, paid: job.pack.paid } : null,
      registration,
    }
    const no = (await t.one<{ last: number }>("update receipt_counter set last = last + 1 where id = 1 returning last"))!.last
    const row = await t.one<ReceiptRow>("insert into receipts (no, booking_id, customer_id, total, tax, data) values ($1, $2, $3, $4, $5, $6::jsonb) returning *", [no, job.id, b.customer_id, job.total, tax?.amount ?? 0, JSON.stringify(data)])
    return toReceipt(row!)
  })
}

export async function receiptForBooking(db: Db, bookingId: string): Promise<Receipt | null> {
  if (!(await receiptsReady(db))) return null
  const r = await db.one<ReceiptRow>("select * from receipts where booking_id = $1", [bookingId])
  return r ? toReceipt(r) : null
}

export async function receiptByNo(db: Db, no: number): Promise<Receipt | null> {
  if (!(await receiptsReady(db))) return null
  const r = await db.one<ReceiptRow>("select * from receipts where no = $1", [no])
  return r ? toReceipt(r) : null
}

/** Receipt numbers for some bookings (booking id → number). */
export async function receiptNumbers(db: Db, bookingIds: string[]): Promise<Map<string, number>> {
  if (!bookingIds.length || !(await receiptsReady(db))) return new Map()
  const rows = await db.query<{ no: number; booking_id: string }>("select no, booking_id from receipts where booking_id = any($1::text[])", [bookingIds])
  return new Map(rows.map((r) => [r.booking_id, r.no]))
}

// ---------------------------------------------------------------------------
// Sales tax for the SRB return (mission control → Money)
// ---------------------------------------------------------------------------

export type TaxMonth = { month: string; receipts: number; total: number; taxable: number; tax: number }

/** Each month's receipts with their sales tax, newest first (Karachi time). */
export async function taxMonths(db: Db, limit = 12): Promise<TaxMonth[]> {
  if (!(await receiptsReady(db))) return []
  const rows = await db.query<TaxMonth>(
    `select to_char(issued_at at time zone 'Asia/Karachi', 'YYYY-MM') as month, count(*)::int as receipts, coalesce(sum(total), 0)::int as total,
       coalesce(sum((data->'tax'->>'taxable')::int) filter (where tax > 0), 0)::int as taxable, coalesce(sum(tax), 0)::int as tax
     from receipts group by 1 order by 1 desc limit $1`,
    [limit],
  )
  return rows
}

/** One month's receipts (YYYY-MM, Karachi time), oldest first: the lines of the CSV. */
export async function receiptsInMonth(db: Db, month: string): Promise<Receipt[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !(await receiptsReady(db))) return []
  const rows = await db.query<ReceiptRow>("select * from receipts where to_char(issued_at at time zone 'Asia/Karachi', 'YYYY-MM') = $1 order by no", [month])
  return rows.map(toReceipt)
}
