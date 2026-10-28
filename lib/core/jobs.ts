import "server-only"
import type { Db } from "./db"
import type { Catalog } from "@/lib/catalog"
import type { Job, JobEvent, JobItem, PaymentRecord, Pro, Rating } from "@/lib/ops/types"
import { karachiNow } from "@/lib/time"
import { emit } from "./events"
import { applyCredit, customerBalances, packVisitUsed, proShare, settlePayment, visitCompleted, type PayMethod } from "./ledger"
import { creditFor } from "./customers"
import { plusDiscount, referrerOf } from "./growth"
import { clearLocation } from "./tracking"
import { packForBooking } from "./packs"
import { coreId, normalisePhone } from "./phone"
import { bookingTaxTerms } from "./policy"
import { pairRates } from "./pairs"
import { ensureReceipt } from "./receipts"
import { DEFAULT_COMMISSION, taxAmount, totalWithTax } from "@/lib/ops/policy"
import { priceItems, type ClientItem } from "./pricing"
import { checkPromo, PromoError } from "./promos"

// Bookings and pros in the core tables, read and written in the shapes the ops console and the
// pro app already use (lib/ops/types.ts). A booking is an ops job from the moment it's made.
// Changing a job goes through mutateJob(), which locks the row, applies the change and writes
// only what changed, and posts to the ledger when a visit completes or a payment is recorded.

type BookingRow = {
  id: string
  customer_id: string | null
  name: string
  phone: string
  zone: string
  sub_area: string | null
  address: string
  landmark: string | null
  lat: number | null
  lng: number | null
  day: string
  arrival_window: string
  status: Job["status"]
  pro_id: string | null
  route_order: number | null
  eta: string | null
  subtotal: number
  discount: number
  total: number
  payment_method: string
  notes: string | null
  channel: string
  brief: Job["brief"] | null
  wedding: Job["event"] | null
  visit_notes: string[] | null
  preferred_pro_id: string | null
  credit_used: number | null
  pack_id?: string | null // migration 0013
  pack_paid?: number | null
  tax?: number | null // migration 0014
  tax_rate?: number | null
  tax_inclusive?: boolean | null
  tax_base?: "total" | "commission" | null
  created_at: string
}
type ItemRow = { booking_id: string; position: number; name: string; category: string; service: string; options: string[]; add_ons: string[]; qty: number; unit_price: number }
type EventRow = { booking_id: string; type: JobEvent["type"]; at: string; by: JobEvent["by"]; actor: string | null; note: string | null; lat: number | null; lng: number | null }
type PaymentRow = { booking_id: string; amount: number; method: PaymentRecord["method"]; at: string; screenshot: string | null; ocr: PaymentRecord["ocr"] | null; status: PaymentRecord["status"]; checked: boolean; note: string | null }
type RatingRow = { booking_id: string; stars: number; tags: string[]; comment: string | null; at: string }

const json = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v))

async function hydrate(db: Db, rows: BookingRow[]): Promise<Job[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  // One after another: a transaction runs on a single connection.
  const items = await db.query<ItemRow>("select * from booking_items where booking_id = any($1::text[]) order by booking_id, position", [ids])
  const events = await db.query<EventRow>("select * from booking_events where booking_id = any($1::text[]) order by booking_id, id", [ids])
  const pays = await db.query<PaymentRow>("select * from booking_payments where booking_id = any($1::text[])", [ids])
  const ratings = await db.query<RatingRow>("select * from booking_ratings where booking_id = any($1::text[])", [ids])
  const packIds = [...new Set(rows.map((r) => r.pack_id).filter((x): x is string => Boolean(x)))]
  const packNames = new Map(packIds.length ? (await db.query<{ id: string; name: string }>("select id, name from customer_packs where id = any($1::text[])", [packIds])).map((p) => [p.id, p.name]) : [])
  const group = <T extends { booking_id: string }>(list: T[]) => {
    const m = new Map<string, T[]>()
    for (const x of list) m.set(x.booking_id, [...(m.get(x.booking_id) ?? []), x])
    return m
  }
  const itemsBy = group(items)
  const eventsBy = group(events)
  const payBy = new Map(pays.map((p) => [p.booking_id, p]))
  const rateBy = new Map(ratings.map((r) => [r.booking_id, r]))
  return rows.map((b) => {
    const job: Job = {
      id: b.id,
      createdAt: b.created_at,
      date: b.day,
      window: b.arrival_window,
      area: b.zone,
      address: b.address,
      customer: { name: b.name, phone: b.phone },
      items: (itemsBy.get(b.id) ?? []).map((i): JobItem => ({ name: i.name, category: i.category, service: i.service, options: i.options ?? [], addOns: i.add_ons ?? [], qty: i.qty, unitPrice: i.unit_price })),
      total: b.total,
      payment: b.payment_method,
      channel: b.channel,
      status: b.status,
      events: (eventsBy.get(b.id) ?? []).map((e) => {
        const ev: JobEvent = { type: e.type, at: e.at, by: e.by }
        if (e.actor != null) ev.actor = e.actor
        if (e.note != null) ev.note = e.note
        if (e.lat != null) ev.lat = e.lat
        if (e.lng != null) ev.lng = e.lng
        return ev
      }),
    }
    if (b.sub_area) job.subArea = b.sub_area
    if (b.landmark) job.landmark = b.landmark
    if (b.notes) job.notes = b.notes
    if (b.pro_id) job.proId = b.pro_id
    if (b.route_order != null) job.routeOrder = b.route_order
    if (b.eta) job.eta = b.eta
    if (b.brief) job.brief = b.brief
    if (b.wedding) job.event = b.wedding
    if (b.visit_notes?.length) job.visitNotes = b.visit_notes
    if (b.lat != null && b.lng != null) Object.assign(job, { lat: b.lat, lng: b.lng })
    if (b.credit_used) job.credit = b.credit_used
    if (b.pack_id) job.pack = { id: b.pack_id, name: packNames.get(b.pack_id) ?? "", paid: b.pack_paid ?? 0 }
    if (b.tax_rate != null) job.tax = { amount: b.tax ?? 0, rate: b.tax_rate, inclusive: b.tax_inclusive !== false, base: b.tax_base === "commission" ? "commission" : "total" }
    if (b.preferred_pro_id) job.preferredProId = b.preferred_pro_id
    const p = payBy.get(b.id)
    if (p) {
      const rec: PaymentRecord = { amount: p.amount, method: p.method, at: p.at, status: p.status }
      if (p.screenshot) rec.screenshot = p.screenshot
      if (p.ocr) rec.ocr = p.ocr
      if (p.checked) rec.checked = true
      if (p.note) rec.note = p.note
      job.paymentRecord = rec
    }
    const r = rateBy.get(b.id)
    if (r) {
      job.rating = { stars: r.stars, tags: r.tags ?? [], at: r.at }
      if (r.comment) job.rating.comment = r.comment
    }
    return job
  })
}

const isoDaysAgo = (n: number) => new Date(new Date(`${karachiNow().date}T00:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10)

/** Jobs from `sinceDays` ago onwards (all future ones included), oldest first. */
export async function listJobs(db: Db, opts: { sinceDays?: number } = {}): Promise<Job[]> {
  const rows = await db.query<BookingRow>("select * from bookings where day >= $1 order by day, created_at", [isoDaysAgo(opts.sinceDays ?? 180)])
  return hydrate(db, rows)
}

/** One customer's bookings, newest visit first. */
export async function listCustomerJobs(db: Db, customerId: string, limit = 60): Promise<Job[]> {
  return hydrate(db, await db.query<BookingRow>("select * from bookings where customer_id = $1 order by day desc, created_at desc limit $2", [customerId, limit]))
}

export async function getJob(db: Db, id: string): Promise<Job | null> {
  const row = await db.one<BookingRow>("select * from bookings where id = $1", [id])
  return row ? (await hydrate(db, [row]))[0] : null
}

/** The newest booking's creation time (for catching up on website submissions). */
export const latestBookingAt = async (db: Db) => (await db.one<{ at: string | null }>("select max(created_at) as at from bookings"))?.at ?? null

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** The customer with this phone, created on first booking. Returns their id. */
export async function ensureCustomer(db: Db, name: string, phone: string): Promise<string> {
  const row = await db.one<{ id: string }>(
    `insert into customers (id, phone, name) values ($1, $2, $3)
     on conflict (phone) do update set name = case when customers.name = '' then excluded.name else customers.name end, updated_at = now()
     returning id`,
    [coreId("C"), normalisePhone(phone), name.trim()],
  )
  return row!.id
}

// ---------------------------------------------------------------------------
// Creating bookings
// ---------------------------------------------------------------------------

export type NewBooking = {
  id: string
  name: string
  phone: string
  area: string
  subArea?: string
  address: string
  landmark?: string
  date: string
  window: string
  payment: string
  notes?: string
  items: ClientItem[]
  total?: number // what the browser showed; kept for checking, never trusted
  channel?: string
  brief?: Job["brief"]
  createdAt?: string
  /** A friend's referral code: the first booking from a new phone number gets the referral discount. */
  referral?: string
  /** A signed-in customer's own record (otherwise the customer is found, or made, by phone). */
  customerId?: string
  /** A promo code typed at checkout; PromoError when it can't be used. */
  promo?: string
  /** Use the customer's wallet credit (signed-in customers only): set aside now, taken when the visit is done. */
  useCredit?: boolean
  /** "Book her again": the pro the customer asked for. */
  preferredProId?: string
  lat?: number
  lng?: number
  /** The saved address it was booked to. */
  addressId?: string
  /** A visit of the signed-in customer's prepaid pack (PackError when it can't be used). */
  packId?: string
}

export type BookingRules = {
  /** PKR off a new customer's first booking when they come with a referral code (CMS settings). */
  referralOff: number
  now?: Date
}

/**
 * Creates a booking (and its customer) with every line priced from the catalogue. Creating the
 * same id twice returns the existing booking. Throws PricingError for lines that can't be booked.
 */
export async function createBooking(db: Db, b: NewBooking, cat: Catalog, rules: BookingRules = { referralOff: 0 }): Promise<Job> {
  const priced = priceItems(b.items, cat)
  return db.tx(async (t) => {
    if (await t.one("select 1 from bookings where id = $1", [b.id])) return (await getJob(t, b.id))!
    const customerId = b.customerId ?? (await ensureCustomer(t, b.name, b.phone))
    // A pack visit: the pack pays one unit of its line; its saving is part of the discount, and the
    // other discounts below count only on the rest of the booking.
    const pack = b.packId && b.customerId ? await packForBooking(t, { packId: b.packId, customerId, items: priced.items, cat, now: rules.now }) : null
    if (pack?.raise) {
      priced.items[pack.index].unitPrice += pack.raise
      priced.subtotal += pack.raise
    }
    const rest = priced.subtotal - (pack ? pack.paid + pack.saving : 0)
    // A friend's referral code typed in the promo box counts as the referral.
    let referral = b.referral?.trim() || undefined
    let promoCode = b.promo?.trim() || undefined
    if (promoCode && !(await t.one("select 1 from promo_codes where code = upper($1)", [promoCode])) && (await referrerOf(t, promoCode))) {
      referral = promoCode
      promoCode = undefined
    }
    // Referral discount: a real code that isn't their own, on their first booking only.
    const firstBooking = !(await t.one("select 1 from bookings where customer_id = $1 and status not in ('cancelled')", [customerId]))
    const referrer = referral && firstBooking ? await referrerOf(t, referral) : null
    const referralOff = referrer && referrer !== customerId ? Math.min(rules.referralOff, rest) : 0
    let promo: { code: string; discount: number } | null = null
    if (promoCode) {
      const c = await checkPromo(t, promoCode, { subtotal: rest, customerId, now: rules.now })
      if (!c.ok) throw new PromoError(c.problem, c.minOrder)
      promo = c
    }
    // Mjazo Plus members get their discount on every booking.
    const plusOff = await plusDiscount(t, customerId, rest, rules.now)
    // One discount per booking: the largest of Plus, the promo code and a friend's referral.
    const usePromo = Boolean(promo && promo.discount >= referralOff && promo.discount >= plusOff)
    const usePlus = !usePromo && plusOff > 0 && plusOff >= referralOff
    const offer = usePromo ? promo!.discount : usePlus ? plusOff : referralOff
    const discount = offer + (pack?.saving ?? 0)
    // Sales tax, when it's on: frozen on the booking; on top of the price, the total carries it.
    const terms = await bookingTaxTerms(t, rules.now)
    const tax = terms ? taxAmount(terms, { subtotal: priced.subtotal, discount }) : 0
    const total = totalWithTax(priced.subtotal, discount, terms, tax)
    const credit = b.useCredit && b.customerId ? Math.min((await creditFor(t, customerId)).available, total - (pack?.paid ?? 0)) : 0
    const preferred = b.preferredProId && (await t.one("select 1 from pros where id = $1 and status = 'active'", [b.preferredProId])) ? b.preferredProId : null
    const pin = b.lat !== undefined && b.lng !== undefined ? [b.lat, b.lng] : [null, null]
    const addressId = b.addressId && (await t.one("select 1 from addresses where id = $1 and customer_id = $2", [b.addressId, customerId])) ? b.addressId : null
    await t.query(
      `insert into bookings (id, customer_id, name, phone, zone, sub_area, address, landmark, day, arrival_window, status, subtotal, discount, total, client_total, payment_method, notes, channel, brief, created_at, credit_used, preferred_pro_id, lat, lng, address_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new', $11, $18, $19, $12, $13, $14, $15, $16::jsonb, coalesce($17::timestamptz, now()), $20, $21, $22, $23, $24)`,
      [b.id, customerId, b.name.trim(), normalisePhone(b.phone), b.area, b.subArea ?? null, b.address, b.landmark ?? null, b.date, b.window, priced.subtotal, b.total ?? null, b.payment, b.notes ?? null, b.channel ?? "web", json(b.brief), b.createdAt ?? null, discount, total, credit, preferred, pin[0], pin[1], addressId],
    )
    if (usePromo) {
      await t.query("update bookings set promo_code = $2 where id = $1", [b.id, promo!.code])
      await t.query("insert into promo_redemptions (code, booking_id, customer_id, amount) values ($1, $2, $3, $4)", [promo!.code, b.id, customerId, discount])
    } else if (usePlus) await t.query("update bookings set promo_code = 'PLUS' where id = $1", [b.id])
    else if (offer) {
      await t.query("update bookings set promo_code = $2 where id = $1", [b.id, `REF:${referral!.toUpperCase().slice(0, 40)}`])
      // Who referred them: their referrer gets credit when this first visit is done.
      await t.query("update customers set referred_by = $2 where id = $1 and referred_by is null", [customerId, referrer])
    }
    if (pack) await t.query("update bookings set pack_id = $2, pack_paid = $3 where id = $1", [b.id, pack.packId, pack.paid])
    if (terms) await t.query("update bookings set tax = $2, tax_rate = $3, tax_inclusive = $4, tax_base = $5 where id = $1", [b.id, tax, terms.rate, terms.inclusive, terms.base])
    await insertItems(t, b.id, priced.items)
    if (priced.changed || (b.total !== undefined && b.total !== total - credit && b.total !== total)) console.warn(`[core] ${b.id}: browser total ${b.total} replaced by ${total}`)
    await emit(t, "booking.created", { bookingId: b.id, customerId, proId: preferred ?? undefined }, { total, discount, credit, promo: usePromo ? promo!.code : null, packId: pack?.packId ?? null, preferredProId: preferred, channel: b.channel ?? "web" })
    return (await getJob(t, b.id))!
  })
}

async function insertItems(db: Db, bookingId: string, items: (JobItem & { duration?: number })[]) {
  for (const [i, it] of items.entries()) {
    await db.query("insert into booking_items (booking_id, position, name, category, service, options, add_ons, qty, unit_price, duration) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)", [
      bookingId,
      i,
      it.name,
      it.category,
      it.service,
      JSON.stringify(it.options ?? []),
      JSON.stringify(it.addOns ?? []),
      it.qty,
      it.unitPrice,
      it.duration ?? 0,
    ])
  }
}

/**
 * Inserts whole jobs that were built elsewhere (wedding plans, records moved from the old store),
 * keeping their status, events, payment and rating. Jobs that already exist are left alone.
 * Returns how many were added.
 */
export async function importJobs(db: Db, jobs: Job[]): Promise<number> {
  let added = 0
  for (const job of jobs) {
    await db.tx(async (t) => {
      if (await t.one("select 1 from bookings where id = $1", [job.id])) return
      const customerId = await ensureCustomer(t, job.customer.name, job.customer.phone)
      const subtotal = job.items.reduce((s, i) => s + i.unitPrice * i.qty, 0) || job.total
      await t.query(
        `insert into bookings (id, customer_id, name, phone, zone, sub_area, address, landmark, day, arrival_window, status, pro_id, route_order, eta, subtotal, discount, total, payment_method, notes, channel, brief, wedding, visit_notes, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22::jsonb, $23::jsonb, $24)`,
        [job.id, customerId, job.customer.name, normalisePhone(job.customer.phone), job.area, job.subArea ?? null, job.address, job.landmark ?? null, job.date, job.window, job.status, job.proId ?? null, job.routeOrder ?? null, job.eta ?? null, subtotal, Math.max(0, subtotal - job.total), job.total, job.payment, job.notes ?? null, job.channel ?? "web", json(job.brief), json(job.event), JSON.stringify(job.visitNotes ?? []), job.createdAt],
      )
      await insertItems(t, job.id, job.items)
      for (const e of job.events) await insertEvent(t, job.id, e)
      if (job.paymentRecord) await writePayment(t, job.id, job.paymentRecord)
      if (job.rating) await writeRating(t, job.id, job.rating)
      await postLedger(t, job.id, null, job)
      await emit(t, "booking.created", { bookingId: job.id, customerId, proId: job.proId }, { total: job.total, channel: job.channel ?? "web", imported: true })
      added++
    })
  }
  return added
}

/**
 * A booking imported with the prices its customer saw (the catch-up, when its lines can't be
 * priced any more) gets the sales tax of the day it was made, worked out from its total, so the
 * ledger's sums hold when it's done. On top, the browser's total carried the tax.
 */
export async function taxImported(db: Db, id: string, now: Date) {
  const terms = await bookingTaxTerms(db, now)
  const b = terms && (await db.one<{ subtotal: number; total: number }>("select subtotal, total from bookings where id = $1 and tax_rate is null", [id]))
  if (!terms || !b) return
  const tax = terms.inclusive ? taxAmount(terms, { subtotal: b.subtotal, discount: Math.max(0, b.subtotal - b.total) }) : b.total - Math.round(b.total / (1 + terms.rate))
  const discount = Math.max(0, b.subtotal - b.total + (terms.inclusive ? 0 : tax))
  await db.query("update bookings set tax = $2, tax_rate = $3, tax_inclusive = $4, tax_base = $5, discount = $6 where id = $1", [id, tax, terms.rate, terms.inclusive, terms.base, discount])
}

// ---------------------------------------------------------------------------
// Changing a job
// ---------------------------------------------------------------------------

const insertEvent = (db: Db, bookingId: string, e: JobEvent) =>
  db.query("insert into booking_events (booking_id, type, at, by, actor, note, lat, lng) values ($1, $2, $3, $4, $5, $6, $7, $8)", [bookingId, e.type, e.at, e.by, e.actor ?? null, e.note ?? null, e.lat ?? null, e.lng ?? null])

const writePayment = (db: Db, bookingId: string, p: PaymentRecord) =>
  db.query(
    `insert into booking_payments (booking_id, amount, method, at, screenshot, ocr, status, checked, note) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
     on conflict (booking_id) do update set amount = excluded.amount, method = excluded.method, at = excluded.at, screenshot = excluded.screenshot, ocr = excluded.ocr, status = excluded.status, checked = excluded.checked, note = excluded.note`,
    [bookingId, Math.round(p.amount), p.method, p.at, p.screenshot ?? null, json(p.ocr), p.status, Boolean(p.checked), p.note ?? null],
  )

const writeRating = (db: Db, bookingId: string, r: Rating) =>
  db.query(
    `insert into booking_ratings (booking_id, stars, tags, comment, at) values ($1, $2, $3, $4, $5)
     on conflict (booking_id) do update set stars = excluded.stars, tags = excluded.tags, comment = excluded.comment, at = excluded.at`,
    [bookingId, r.stars, r.tags, r.comment ?? null, r.at],
  )

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** The job's fields that live in plain booking columns. */
const COLUMNS: [keyof Job | "customer.name" | "customer.phone", string, (j: Job) => unknown][] = [
  ["status", "status", (j) => j.status],
  ["proId", "pro_id", (j) => j.proId ?? null],
  ["routeOrder", "route_order", (j) => j.routeOrder ?? null],
  ["eta", "eta", (j) => j.eta ?? null],
  ["notes", "notes", (j) => j.notes ?? null],
  ["date", "day", (j) => j.date],
  ["window", "arrival_window", (j) => j.window],
  ["area", "zone", (j) => j.area],
  ["subArea", "sub_area", (j) => j.subArea ?? null],
  ["address", "address", (j) => j.address],
  ["landmark", "landmark", (j) => j.landmark ?? null],
  ["payment", "payment_method", (j) => j.payment],
  ["channel", "channel", (j) => j.channel ?? "web"],
  ["customer.name", "name", (j) => j.customer.name],
  ["customer.phone", "phone", (j) => normalisePhone(j.customer.phone)],
  ["lat", "lat", (j) => j.lat ?? null],
  ["lng", "lng", (j) => j.lng ?? null],
  ["credit", "credit_used", (j) => j.credit ?? 0],
  ["preferredProId", "preferred_pro_id", (j) => j.preferredProId ?? null],
]
const JSON_COLUMNS: [string, (j: Job) => unknown][] = [
  ["brief", (j) => j.brief ?? null],
  ["wedding", (j) => j.event ?? null],
  ["visit_notes", (j) => j.visitNotes ?? []],
]

/**
 * Atomic change to one job: `fn` gets the latest copy and edits it in place (it may throw to
 * abort). Events are append-only. Returns null when the job doesn't exist.
 */
export async function mutateJob(db: Db, id: string, fn: (job: Job) => void): Promise<Job | null> {
  return db.tx(async (t) => {
    const row = await t.one<BookingRow>("select * from bookings where id = $1 for update", [id])
    if (!row) return null
    const before = (await hydrate(t, [row]))[0]
    const after = structuredClone(before)
    fn(after)

    const sets: string[] = []
    const vals: unknown[] = [id]
    for (const [, col, get] of COLUMNS) {
      const v = get(after)
      if (!same(v, get(before))) {
        vals.push(v)
        sets.push(`${col} = $${vals.length}`)
      }
    }
    for (const [col, get] of JSON_COLUMNS) {
      const v = get(after)
      if (!same(v, get(before))) {
        vals.push(json(v))
        sets.push(`${col} = $${vals.length}::jsonb`)
      }
    }
    const itemsChanged = !same(after.items, before.items)
    if (itemsChanged || after.total !== before.total) {
      // Sales tax frozen on the booking follows its new price (on top, the total carries it).
      const terms = before.tax ? { rate: before.tax.rate, inclusive: before.tax.inclusive, base: before.tax.base } : null
      const onTop = terms && !terms.inclusive ? before.tax!.amount : 0
      const subtotal = itemsChanged ? after.items.reduce((s, i) => s + i.unitPrice * i.qty, 0) : after.total + row.discount - onTop
      const tax = terms ? (itemsChanged ? taxAmount(terms, { subtotal, discount: row.discount }) : before.tax!.amount) : 0
      const total = itemsChanged ? totalWithTax(subtotal, row.discount, terms, tax) : after.total
      vals.push(subtotal, total)
      sets.push(`subtotal = $${vals.length - 1}`, `total = $${vals.length}`)
      if (terms && tax !== before.tax!.amount) {
        vals.push(tax)
        sets.push(`tax = $${vals.length}`)
        after.tax = { ...before.tax!, amount: tax }
      }
      after.total = total
    }
    if (sets.length) await t.query(`update bookings set ${sets.join(", ")}, updated_at = now() where id = $1`, vals)
    if (itemsChanged) {
      await t.query("delete from booking_items where booking_id = $1", [id])
      await insertItems(t, id, after.items)
    }

    const kept = after.events.slice(0, before.events.length)
    if (after.events.length < before.events.length || !same(kept, before.events)) throw new Error("A job's history can only be added to")
    for (const e of after.events.slice(before.events.length)) await insertEvent(t, id, e)

    if (!same(after.paymentRecord, before.paymentRecord)) {
      if (after.paymentRecord) await writePayment(t, id, after.paymentRecord)
      else await t.query("delete from booking_payments where booking_id = $1", [id])
    }
    if (!same(after.rating, before.rating)) {
      if (after.rating) await writeRating(t, id, after.rating)
      else await t.query("delete from booking_ratings where booking_id = $1", [id])
    }

    await postLedger(t, id, before, after)
    const ref = { bookingId: id, proId: after.proId, customerId: row.customer_id ?? undefined }
    if (after.status !== before.status) await emit(t, `booking.${after.status}`, ref, { from: before.status })
    else if (after.proId !== before.proId) await emit(t, "booking.reassigned", ref, { from: before.proId ?? null })
    // Her live location is kept only while she's on the way.
    if (before.status === "en_route" && after.status !== "en_route") await clearLocation(t, id)
    if (!same(after.paymentRecord, before.paymentRecord) && after.paymentRecord) await emit(t, "payment.recorded", ref, { amount: after.paymentRecord.amount, method: after.paymentRecord.method, status: after.paymentRecord.status })
    if (!same(after.rating, before.rating) && after.rating) await emit(t, "rating.received", ref, { stars: after.rating.stars })
    return after
  })
}

/** A payment counts in the books once it's cash, matched to the screenshot, or checked by a person. */
function countedPayment(j: Job | null): { amount: number; method: PayMethod } | null {
  const p = j?.paymentRecord
  if (!p) return null
  if (p.status === "cash" || p.status === "matched" || p.checked) return { amount: Math.round(p.amount), method: p.method }
  return null
}

/** Ledger postings for a change: a visit that just completed, and any change to its counted payment. */
async function postLedger(db: Db, id: string, before: Job | null, after: Job) {
  const completedNow = after.status === "completed" && before?.status !== "completed"
  const pay = countedPayment(after)
  const payChanged = !same(pay, countedPayment(before))
  if (!completedNow && !payChanged) return
  if (!after.proId) {
    console.warn(`[core] ${id}: no pro on the job, so nothing was posted to the ledger`)
    return
  }
  const b = await db.one<{ customer_id: string | null; subtotal: number; discount: number; total: number }>("select customer_id, subtotal, discount, total from bookings where id = $1", [id])
  let customerId = b!.customer_id
  if (!customerId) {
    customerId = await ensureCustomer(db, after.customer.name, after.customer.phone)
    await db.query("update bookings set customer_id = $2 where id = $1", [id, customerId])
  }
  if (completedNow) {
    const pro = await db.one<{ commission_rate: number }>("select commission_rate from pros where id = $1", [after.proId])
    // Her usual share, or the lower one for a regular customer of hers (policy "pair_rate").
    const pair = (await pairRates(db, [{ bookingId: id, proId: after.proId, proRate: pro?.commission_rate ?? DEFAULT_COMMISSION }])).get(id)!
    const rate = pair.rate
    // Sales tax on Mjazo's share only: now that her share is known, it's worked out on the real one.
    let tax = after.tax
    if (tax?.base === "commission") {
      const amount = taxAmount(tax, { subtotal: b!.subtotal, discount: b!.discount, commission: b!.subtotal - proShare(b!.subtotal, rate) })
      if (amount !== tax.amount) {
        await db.query("update bookings set tax = $2 where id = $1", [id, amount])
        tax = after.tax = { ...tax, amount }
      }
    }
    const memo = pair.regular ? `Regular customer: Mjazo's share ${Math.round(rate * 10000) / 100}%` : undefined
    await visitCompleted(db, { bookingId: id, customerId, proId: after.proId, subtotal: b!.subtotal, discount: b!.discount, total: b!.total, commissionRate: rate, tax, memo })
    // Their pack pays its price a visit; the wallet credit set aside at booking pays part of the
    // rest (as much as is still there).
    if (after.pack?.paid) await packVisitUsed(db, { packId: after.pack.id, bookingId: id, customerId, amount: after.pack.paid })
    const use = Math.min(after.credit ?? 0, (await customerBalances(db, customerId)).credit)
    if (use > 0) await applyCredit(db, { customerId, bookingId: id, amount: use })
    // The receipt: numbered and frozen with the visit (once migration 0014 has run).
    await ensureReceipt(db, after, { commission: b!.subtotal - proShare(b!.subtotal, rate) })
  }
  if (payChanged) await settlePayment(db, { bookingId: id, customerId, proId: after.proId, amount: pay?.amount ?? 0, method: pay?.method ?? (after.paymentRecord?.method as PayMethod) ?? "cash" })
}

// ---------------------------------------------------------------------------
// The one-time copy of the older ops records
// ---------------------------------------------------------------------------

/**
 * Copies pros and jobs from the older document store into the core, once (a marker in core_meta
 * records it). Pros that already exist are kept as they are; a job whose pro is unknown keeps
 * its other details and loses only the assignment.
 */
export async function importLegacy(db: Db, load: () => Promise<{ pros: Pro[]; jobs: Job[] }>) {
  if (await db.one("select 1 from core_meta where key = 'legacy_import'")) return null
  const { pros, jobs } = await load()
  let addedPros = 0
  for (const p of pros) {
    if (await db.one("select 1 from pros where id = $1 or phone = $2", [p.id, normalisePhone(p.phone)])) continue
    await savePro(db, p)
    addedPros++
  }
  const known = new Set((await listPros(db)).map((p) => p.id))
  const fixed = jobs.map((j) => {
    if (!j.proId || known.has(j.proId)) return j
    const { proId, eta, routeOrder, ...rest } = j
    void eta
    void routeOrder
    return { ...rest, status: ["new", "assigned", "en_route"].includes(j.status) ? ("new" as const) : j.status, events: [...j.events, { type: "note" as const, at: new Date().toISOString(), by: "system" as const, note: `Was assigned to ${proId}, who wasn't found` }] }
  })
  const addedJobs = await importJobs(db, fixed)
  await db.query("insert into core_meta (key, value) values ('legacy_import', $1::jsonb) on conflict (key) do nothing", [JSON.stringify({ pros: addedPros, jobs: addedJobs })])
  return { pros: addedPros, jobs: addedJobs }
}

// ---------------------------------------------------------------------------
// Pros
// ---------------------------------------------------------------------------

type ProRow = {
  id: string
  name: string
  phone: string
  email: string | null
  home_zone: string
  zones: string[] | null
  skills: string[]
  women: boolean
  status: string
  pin_hash: string | null
  application_id: string | null
  commission_rate: number
  daily_cap: number
  verification: Pro["verification"] | null
  created_at: string
}

const toPro = (r: ProRow): Pro => {
  const p: Pro = { id: r.id, name: r.name, phone: r.phone, area: r.home_zone, skills: r.skills ?? [], women: r.women, status: r.status === "active" ? "active" : "paused", createdAt: r.created_at }
  if (r.email) p.email = r.email
  if (r.pin_hash) p.pinHash = r.pin_hash
  if (r.application_id) p.applicationId = r.application_id
  if (r.zones?.length) p.zones = r.zones
  p.dailyCap = r.daily_cap
  p.commissionRate = r.commission_rate
  if (r.verification && Object.keys(r.verification).length) p.verification = r.verification
  return p
}

/** Adds each pro's weekly availability and days off (from yesterday on). */
async function withSchedule(db: Db, pros: Pro[]): Promise<Pro[]> {
  if (!pros.length) return pros
  const ids = pros.map((p) => p.id)
  const avail = await db.query<{ pro_id: string; weekday: number; windows: string[] }>("select pro_id, weekday, windows from pro_availability where pro_id = any($1::text[])", [ids])
  const off = await db.query<{ pro_id: string; day: string }>("select pro_id, day from pro_time_off where pro_id = any($1::text[]) and day >= $2 order by day", [ids, isoDaysAgo(1)])
  for (const p of pros) {
    const a = avail.filter((x) => x.pro_id === p.id)
    if (a.length) p.availability = Object.fromEntries(a.map((x) => [String(x.weekday), x.windows ?? []]))
    const o = off.filter((x) => x.pro_id === p.id).map((x) => x.day)
    if (o.length) p.timeOff = o
  }
  return pros
}

export const listPros = async (db: Db) => withSchedule(db, (await db.query<ProRow>("select * from pros order by created_at, id")).map(toPro))

export async function getProRow(db: Db, id: string) {
  const r = await db.one<ProRow>("select * from pros where id = $1", [id])
  return r ? (await withSchedule(db, [toPro(r)]))[0] : null
}

/** Creates or updates a pro (the fields the Pro type carries). A changed email unlinks her email sign-in. */
export async function savePro(db: Db, p: Pro) {
  await db.query(
    `insert into pros (id, name, phone, email, home_zone, skills, women, status, pin_hash, application_id, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (id) do update set name = excluded.name, phone = excluded.phone, email = excluded.email,
       auth_user_id = case when pros.email is distinct from excluded.email then null else pros.auth_user_id end, home_zone = excluded.home_zone, skills = excluded.skills,
       women = excluded.women, status = excluded.status, pin_hash = excluded.pin_hash, application_id = excluded.application_id, updated_at = now()`,
    [p.id, p.name, normalisePhone(p.phone), p.email?.trim().toLowerCase() || null, p.area, p.skills, p.women, p.status, p.pinHash ?? null, p.applicationId ?? null, p.createdAt],
  )
}
