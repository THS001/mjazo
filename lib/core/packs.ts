import "server-only"
import type { Catalog } from "@/lib/catalog"
import { karachiNow } from "@/lib/time"
import { isPackLine, type PackOffer } from "@/lib/packs"
import type { Db } from "./db"
import { writeAudit } from "./audit"
import { InputError } from "./errors"
import { emit } from "./events"
import { packRefunded, packSold } from "./ledger"
import { coreId, normalisePhone } from "./phone"
import { priceItems, type PricedItem } from "./pricing"

// Visit packs (migration 0013): a few visits of one service or bundle, paid upfront for less per
// visit. A customer asks for one (or ops add it by phone); once Finance has the money they activate
// it, which holds the money in the ledger and starts the time to use it. Each booking made with the
// pack is paid from it: the pack's price a visit, with the rest of the service's price as a discount
// Mjazo funds. A cancelled booking's visit goes back to the pack; an unused pack can be cancelled,
// giving back its unused visits.

const PHONE = /^03\d{9}$/
const DAY = 86400_000

export type PackItem = { name: string; category: string; service: string; options: string[] }
export type CustomerPack = {
  id: string
  customerId: string
  slug: string
  name: string
  item: PackItem
  visits: number
  visitPrice: number
  listPrice: number
  everyDays: number
  validDays: number
  status: "requested" | "active" | "cancelled"
  startsAt: string | null
  endsAt: string | null
  paidVia: string | null
  reference: string | null
  requestedAt: string
  activatedBy: string | null
  note: string | null
  refunded: number | null
  /** Visits done. */
  used: number
  /** Visits booked and not done yet. */
  booked: number
  /** Visits still to book. */
  left: number
  /** The day of the last visit done. */
  lastVisit: string | null
  /** When the next visit is due (active packs with visits to book and none booked). */
  nextDue: string | null
  /** Active, but past the time to use it. */
  expired: boolean
}
type PackRow = {
  id: string
  customer_id: string
  slug: string
  name: string
  item: PackItem
  visits: number
  visit_price: number
  list_price: number
  every_days: number
  valid_days: number
  status: CustomerPack["status"]
  starts_at: string | null
  ends_at: string | null
  paid_via: string | null
  reference: string | null
  requested_at: string
  activated_by: string | null
  note: string | null
  refunded: number | null
  used: number
  booked: number
  last_visit: string | null
}

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null)
const day = (t: number) => new Date(t).toISOString().slice(0, 10)

function toPack(r: PackRow, now = new Date()): CustomerPack {
  const left = Math.max(0, r.visits - r.used - r.booked)
  const expired = r.status === "active" && Boolean(r.ends_at) && new Date(r.ends_at!) <= now
  // Due the pack's interval after the last visit, or today (in Karachi) before the first.
  const due = r.status === "active" && !expired && left > 0 && r.booked === 0 ? (r.last_visit ? day(Date.parse(`${r.last_visit}T00:00:00Z`) + r.every_days * DAY) : karachiNow(now).date) : null
  return {
    id: r.id,
    customerId: r.customer_id,
    slug: r.slug,
    name: r.name,
    item: r.item,
    visits: r.visits,
    visitPrice: r.visit_price,
    listPrice: r.list_price,
    everyDays: r.every_days,
    validDays: r.valid_days,
    status: r.status,
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
    paidVia: r.paid_via,
    reference: r.reference,
    requestedAt: iso(r.requested_at)!,
    activatedBy: r.activated_by,
    note: r.note,
    refunded: r.refunded,
    used: r.used,
    booked: r.booked,
    left,
    lastVisit: r.last_visit,
    nextDue: due,
    expired,
  }
}

// Each pack with how many of its visits are done and booked (a no-show doesn't use a visit).
const SELECT = `select k.*,
    (count(b.id) filter (where b.status = 'completed'))::int as used,
    (count(b.id) filter (where b.status not in ('completed', 'cancelled', 'no_show')))::int as booked,
    max(b.day) filter (where b.status = 'completed') as last_visit
  from customer_packs k left join bookings b on b.pack_id = k.id`

const getPack = async (db: Db, id: string) => db.one<PackRow>(`${SELECT} where k.id = $1 group by k.id`, [id])

/** Their packs: asked for, in use, and used up or ended (newest first; cancelled ones aren't shown). */
export async function packsFor(db: Db, customerId: string, now = new Date()): Promise<CustomerPack[]> {
  const rows = await db.query<PackRow>(`${SELECT} where k.customer_id = $1 and k.status <> 'cancelled' group by k.id order by k.requested_at desc limit 20`, [customerId])
  return rows.map((r) => toPack(r, now))
}

/** For mission control: requests waiting for payment, packs in use, and those ended in the last 60 days. */
export async function listPacks(db: Db, now = new Date()) {
  const rows = await db.query<PackRow & { cname: string; phone: string | null }>(
    `${SELECT.replace("select k.*,", "select k.*, c.name as cname, c.phone,")} join customers c on c.id = k.customer_id
     where k.status = 'requested' or (k.status = 'active' and k.ends_at > $1) or (k.status = 'cancelled' and k.cancelled_at > $1)
     group by k.id, c.name, c.phone
     order by case k.status when 'requested' then 0 when 'active' then 1 else 2 end, k.requested_at desc limit 300`,
    [new Date(now.getTime() - 60 * DAY).toISOString()],
  )
  return rows.map((r) => ({ ...toPack(r, now), customerName: r.cname, phone: r.phone }))
}

/**
 * Packs whose next visit falls due by `until` (YYYY-MM-DD), with visits left, none booked and at
 * least one done (the welcome message asks for the first): for the "time for your next visit" message.
 */
export async function packsDue(db: Db, until: string, now = new Date()) {
  const rows = await db.query<PackRow & { cname: string; phone: string | null; email: string | null; lang: string }>(
    `${SELECT.replace("select k.*,", "select k.*, c.name as cname, c.phone, c.email, c.lang,")} join customers c on c.id = k.customer_id
     where k.status = 'active' and k.ends_at > $1 group by k.id, c.name, c.phone, c.email, c.lang`,
    [now.toISOString()],
  )
  return rows
    .map((r) => ({ ...toPack(r, now), customerName: r.cname, phone: r.phone, email: r.email, lang: r.lang }))
    .filter((k) => k.lastVisit && k.nextDue && k.nextDue <= until)
}

const itemOf = (o: PackOffer): PackItem => ({ name: o.item.name, category: o.item.category, service: o.item.service, options: o.item.options })

async function insertPack(db: Db, customerId: string, o: PackOffer, by: string) {
  const id = coreId("PK")
  await db.query(
    `insert into customer_packs (id, customer_id, slug, name, item, visits, visit_price, list_price, every_days, valid_days, requested_by)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)`,
    [id, customerId, o.slug, o.name, JSON.stringify(itemOf(o)), o.visits, o.visitPrice, o.listPrice, o.everyDays, o.validDays, by],
  )
  return id
}

/** A customer asks for a pack (one request per pack at a time). Ops then take the money and activate it. */
export async function requestPack(db: Db, customerId: string, o: PackOffer, by: string) {
  const waiting = await db.one<{ id: string }>("select id from customer_packs where customer_id = $1 and slug = $2 and status = 'requested'", [customerId, o.slug])
  if (waiting) return { pack: toPack((await getPack(db, waiting.id))!), isNew: false }
  const id = await insertPack(db, customerId, o, by)
  await emit(db, "pack.requested", { customerId }, { packId: id, slug: o.slug })
  return { pack: toPack((await getPack(db, id))!), isNew: true }
}

/**
 * The money is in: the pack is active for its time to use it, and its price is held in the ledger
 * until the visits are done. Ops can also add a pack by phone, without a request (`offer` then says
 * which pack).
 */
export async function activatePack(db: Db, a: { packId?: string; phone?: string; name?: string; offer?: PackOffer; paidVia: string; reference?: string; by: string; now?: Date }) {
  const now = a.now ?? new Date()
  return db.tx(async (t) => {
    let id = a.packId
    if (id) {
      const row = await t.one<{ status: string }>("select status from customer_packs where id = $1 for update", [id])
      if (!row || row.status !== "requested") throw new InputError("This pack request isn't waiting any more")
    } else {
      if (!a.offer) throw new InputError("Pick a pack")
      const p = normalisePhone(a.phone ?? "")
      if (!PHONE.test(p)) throw new InputError("Enter the customer's mobile number (03xx xxxxxxx)")
      const c = await t.one<{ id: string }>(
        `insert into customers (id, phone, name) values ($1, $2, $3)
         on conflict (phone) do update set name = case when customers.name = '' then excluded.name else customers.name end, updated_at = now() returning id`,
        [coreId("C"), p, (a.name ?? "").trim().slice(0, 80)],
      )
      id = (await t.one<{ id: string }>("select id from customer_packs where customer_id = $1 and slug = $2 and status = 'requested' for update", [c!.id, a.offer.slug]))?.id ?? (await insertPack(t, c!.id, a.offer, a.by))
    }
    const k = (await t.one<{ customer_id: string; visits: number; visit_price: number; valid_days: number; name: string }>("select customer_id, visits, visit_price, valid_days, name from customer_packs where id = $1", [id]))!
    const end = new Date(now.getTime() + k.valid_days * DAY)
    await t.query("update customer_packs set status = 'active', starts_at = $2, ends_at = $3, paid_via = $4, reference = $5, activated_by = $6, activated_at = $2 where id = $1", [
      id,
      now.toISOString(),
      end.toISOString(),
      a.paidVia,
      a.reference?.trim() || null,
      a.by,
    ])
    await packSold(t, { packId: id!, customerId: k.customer_id, amount: k.visits * k.visit_price, method: a.paidVia, reference: a.reference, actor: a.by })
    await emit(t, "pack.activated", { customerId: k.customer_id }, { packId: id, endsAt: end.toISOString() })
    await writeAudit(t, { actor: a.by, action: "activated a pack", target: k.customer_id, detail: `${id} ${k.name}: ${k.visits} × ${k.visit_price}, until ${karachiNow(end).date} (${a.paidVia})` })
    return toPack((await getPack(t, id!))!, now)
  })
}

/**
 * A request that won't go ahead, or a pack ended early: its unused visits' money is given back to
 * the customer outside the app (and taken out of the ledger here). Visits already booked with it
 * must be cancelled or done first.
 */
export async function cancelPack(db: Db, packId: string, by: string, note?: string) {
  return db.tx(async (t) => {
    await t.query("select 1 from customer_packs where id = $1 for update", [packId])
    const r = await getPack(t, packId)
    if (!r) throw new InputError("Pack not found")
    if (r.status === "cancelled") throw new InputError("Already cancelled")
    if (r.booked > 0) throw new InputError("It has visits booked: cancel those bookings first, or let them happen")
    const refund = r.status === "active" ? (r.visits - r.used) * r.visit_price : 0
    await t.query("update customer_packs set status = 'cancelled', cancelled_by = $2, cancelled_at = now(), refunded = $3, note = coalesce($4, note) where id = $1", [packId, by, refund || null, note?.trim() || null])
    if (refund > 0) await packRefunded(t, { packId, customerId: r.customer_id, amount: refund, reason: note, actor: by })
    await writeAudit(t, { actor: by, action: "cancelled a pack", target: r.customer_id, detail: `${packId}${refund ? `: PKR ${refund} back` : ""}${note ? `: ${note}` : ""}` })
    return toPack((await getPack(t, packId))!)
  })
}

export class PackError extends InputError {
  constructor(
    readonly code: "missing" | "notActive" | "expired" | "usedUp" | "notInBooking",
    message: string,
  ) {
    super(message)
  }
}

/** What a pack pays on a booking: which line it covers, and the saving on that line. */
export type PackUse = { packId: string; name: string; index: number; paid: number; saving: number; raise: number }

/**
 * Checks that the signed-in customer can use this pack on a booking with these (priced) lines and
 * works out what it pays: one unit of the matching line at the pack's price a visit. The saving is
 * the line's own price (without add-ons, which they pay as usual) less that. Should the service now
 * cost less than the pack's price a visit, the line is raised to it (`raise`), so the pack still
 * pays exactly one visit. Locks the pack inside a transaction.
 */
export async function packForBooking(db: Db, u: { packId: string; customerId: string; items: PricedItem[]; cat: Catalog; now?: Date }): Promise<PackUse> {
  const now = u.now ?? new Date()
  await db.query("select 1 from customer_packs where id = $1 and customer_id = $2 for update", [u.packId, u.customerId])
  const r = await getPack(db, u.packId)
  if (!r || r.customer_id !== u.customerId || r.status === "cancelled") throw new PackError("missing", "That pack isn't on your account")
  const k = toPack(r, now)
  if (k.status !== "active") throw new PackError("notActive", "Your pack starts once we have the payment")
  if (k.expired) throw new PackError("expired", "Your pack's time to use it is over")
  if (k.left < 1) throw new PackError("usedUp", "Every visit of your pack is used or booked")
  const index = u.items.findIndex((l) => isPackLine(l, k.item))
  if (index < 0) throw new PackError("notInBooking", `Add ${k.item.name} to use your pack`)
  const line = u.items[index]
  const unit = line.addOns.length ? priceItems([{ ...line, addOns: [] }], u.cat).items[0].unitPrice : line.unitPrice
  return { packId: k.id, name: k.name, index, paid: k.visitPrice, saving: Math.max(0, unit - k.visitPrice), raise: Math.max(0, k.visitPrice - unit) }
}
