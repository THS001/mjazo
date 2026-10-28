import "server-only"
import { getCatalog } from "@/lib/cms/read"
import { core, requireCore } from "@/lib/core/db"
import { bookingPaid } from "@/lib/core/ledger"
import { getJob } from "@/lib/core/jobs"
import { ensureReceipt, receiptByNo, receiptNumbers } from "@/lib/core/receipts"
import type { Job } from "@/lib/ops/types"
import { parseReceiptNumber, receiptNumber, type Receipt } from "@/lib/receipts"
import { SITE_URL } from "@/lib/site"
import { safeEqual, signText } from "./session"

// Receipt links: /receipt/MJR-000123?k=… opens without signing in (the link is signed with
// SESSION_SECRET), so it works from WhatsApp or an email. The account, the app and mission control
// get it from here; the page shows the frozen receipt with what was paid and refunded since.

const keyFor = (no: number, bookingId: string) => signText(`receipt:${no}:${bookingId}`)

/** The receipt's link (null when links can't be signed: no SESSION_SECRET in production). */
export function receiptUrl(r: Pick<Receipt, "no" | "number" | "bookingId">, locale: "en" | "ur" = "en") {
  const k = keyFor(r.no, r.bookingId)
  return k ? `${SITE_URL}${locale === "ur" ? "/ur" : ""}/receipt/${r.number}?k=${k}` : null
}

/** Each completed visit's receipt link, issuing any it doesn't have yet (visits done before receipts existed). */
export async function receiptLinks(jobs: Job[], locale: "en" | "ur" = "en"): Promise<Map<string, { number: string; url: string | null }>> {
  const db = await core()
  const done = jobs.filter((j) => j.status === "completed")
  if (!db || !done.length) return new Map()
  const have = await receiptNumbers(db, done.map((j) => j.id))
  const out = new Map<string, { number: string; url: string | null }>()
  for (const j of done) {
    const no = have.get(j.id)
    const r = no ? { no, number: receiptNumber(no), bookingId: j.id } : await ensureReceipt(db, j)
    if (r) out.set(j.id, { number: r.number, url: receiptUrl(r, locale) })
  }
  return out
}

/** The receipt behind a link, with what was paid and refunded: null when the number or the key is wrong. */
export async function receiptForLink(number: string, key: string | null | undefined) {
  const no = parseReceiptNumber(number)
  const db = await core()
  if (!no || !key || !db) return null
  const r = await receiptByNo(db, no)
  const want = r ? keyFor(r.no, r.bookingId) : ""
  if (!r || !want || !safeEqual(key, want)) return null
  const [job, paid, cat] = await Promise.all([getJob(db, r.bookingId), bookingPaid(db, r.bookingId), getCatalog()])
  const area = cat.getArea(r.data.customer.area)?.name ?? r.data.customer.area
  return { receipt: r, area, payment: job?.paymentRecord ? { method: job.paymentRecord.method, amount: job.paymentRecord.amount } : null, refunded: paid.refunded }
}
export type ReceiptPage = NonNullable<Awaited<ReturnType<typeof receiptForLink>>>

/** Mission control: a booking's receipt and its link. */
export async function opsReceipt(bookingId: string) {
  const db = await requireCore()
  const j = await getJob(db, bookingId)
  if (!j) return null
  const r = await ensureReceipt(db, j)
  return r ? { number: r.number, tax: r.tax, url: receiptUrl(r) } : null
}
