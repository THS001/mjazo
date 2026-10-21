import "server-only"
import { randomInt } from "node:crypto"
import type { Db } from "./db"
import { writeAudit } from "./audit"
import { InputError } from "./errors"
import { emit } from "./events"
import { giftCardRedeemed, giftCardRefunded, giftCardSold, plusFeePaid, referralRewarded } from "./ledger"
import { coreId, normalisePhone } from "./phone"

// Mjazo Plus, gift cards and referral rewards (migration 0010).
// - Plus: a customer asks to join; once ops have the fee they activate it, which gives a year of
//   the member's discount on every booking (createBooking takes the larger of Plus, a promo code or
//   a friend's referral, never two).
// - Gift cards: ops issue a code once the buyer has paid; whoever has it turns it into credit (once).
// - Referrals: each customer with a number has a code (NAME-1234). A friend's first booking with it
//   gets the friend discount; when that visit is done, the referrer gets credit (once per friend).

const PHONE = /^03\d{9}$/
const DAY = 86400_000

// ---------------------------------------------------------------------------
// Referral codes
// ---------------------------------------------------------------------------

const codeBase = (name: string, phone: string) => `${name.trim().split(/\s+/)[0]?.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 10) || "MJAZO"}-${phone.slice(-4)}`

/** The customer's referral code, made the first time it's asked for (needs their phone number). */
export async function referralCode(db: Db, customerId: string): Promise<string | null> {
  const c = await db.one<{ name: string; phone: string | null; referral_code: string | null }>("select name, phone, referral_code from customers where id = $1", [customerId])
  if (!c?.phone) return null
  if (c.referral_code) return c.referral_code
  const base = codeBase(c.name, c.phone)
  for (let i = 0; i < 20; i++) {
    const code = i === 0 ? base : `${base}${randomInt(2, 99)}`
    const r = await db.one<{ referral_code: string }>(
      "update customers set referral_code = $2, updated_at = now() where id = $1 and referral_code is null and not exists (select 1 from customers where referral_code = $2) returning referral_code",
      [customerId, code],
    )
    if (r) return r.referral_code
    const now = await db.one<{ referral_code: string | null }>("select referral_code from customers where id = $1", [customerId])
    if (now?.referral_code) return now.referral_code
  }
  throw new Error("Couldn't make a referral code")
}

/** A code for someone who isn't signed in: their customer (by number) is found or started. */
export async function referralCodeForPhone(db: Db, name: string, phone: string) {
  const p = normalisePhone(phone)
  if (!PHONE.test(p)) throw new InputError("Enter a Pakistani mobile number (03xx xxxxxxx)")
  if (name.trim().length < 2) throw new InputError("Enter your name")
  const row = await db.one<{ id: string }>(
    `insert into customers (id, phone, name) values ($1, $2, $3)
     on conflict (phone) do update set name = case when customers.name = '' then excluded.name else customers.name end, updated_at = now()
     returning id`,
    [coreId("C"), p, name.trim().slice(0, 80)],
  )
  return (await referralCode(db, row!.id))!
}

/** Who a referral code belongs to (case doesn't matter), or null. */
export async function referrerOf(db: Db, code: string): Promise<string | null> {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z0-9-]{3,24}$/.test(c)) return null
  return (await db.one<{ id: string }>("select id from customers where referral_code = $1", [c]))?.id ?? null
}

/**
 * When a friend's first visit is done: credit for the customer who referred them (once per friend).
 * Null when the booking didn't come with a referral, or the reward was already given.
 */
export async function rewardReferral(db: Db, bookingId: string, amount: number): Promise<{ referrerId: string; friendId: string; amount: number } | null> {
  if (amount <= 0) return null
  const b = await db.one<{ customer_id: string | null; status: string; promo_code: string | null }>("select customer_id, status, promo_code from bookings where id = $1", [bookingId])
  if (!b?.customer_id || b.status !== "completed" || !b.promo_code?.startsWith("REF:")) return null
  const friend = await db.one<{ referred_by: string | null }>("select referred_by from customers where id = $1", [b.customer_id])
  if (!friend?.referred_by || friend.referred_by === b.customer_id) return null
  return db.tx(async (t) => {
    const row = await t.one("insert into referral_rewards (friend_customer_id, referrer_customer_id, booking_id, amount) values ($1, $2, $3, $4) on conflict (friend_customer_id) do nothing returning 1", [b.customer_id, friend.referred_by, bookingId, amount])
    if (!row) return null
    await referralRewarded(t, { referrerId: friend.referred_by!, friendId: b.customer_id!, bookingId, amount })
    await emit(t, "referral.rewarded", { bookingId, customerId: friend.referred_by! }, { friendId: b.customer_id, amount })
    return { referrerId: friend.referred_by!, friendId: b.customer_id!, amount }
  })
}

export async function referralSummary(db: Db, customerId: string) {
  const r = await db.one<{ n: number; total: number }>("select count(*)::int as n, coalesce(sum(amount), 0)::int as total from referral_rewards where referrer_customer_id = $1", [customerId])
  const friends = await db.one<{ n: number }>("select count(*)::int as n from customers where referred_by = $1", [customerId])
  return { friends: friends!.n, rewarded: r!.n, earned: r!.total }
}

// ---------------------------------------------------------------------------
// Mjazo Plus
// ---------------------------------------------------------------------------

export type Plus = { id: string; customerId: string; status: "requested" | "active" | "cancelled"; price: number; discountPct: number; startsAt: string | null; endsAt: string | null; paidVia: string | null; reference: string | null; requestedAt: string; activatedBy: string | null; note: string | null }
type PlusRow = { id: string; customer_id: string; status: Plus["status"]; price: number; discount_pct: number; starts_at: string | null; ends_at: string | null; paid_via: string | null; reference: string | null; requested_at: string; activated_by: string | null; note: string | null }
const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null)
const toPlus = (r: PlusRow): Plus => ({ id: r.id, customerId: r.customer_id, status: r.status, price: r.price, discountPct: r.discount_pct, startsAt: iso(r.starts_at), endsAt: iso(r.ends_at), paidVia: r.paid_via, reference: r.reference, requestedAt: iso(r.requested_at)!, activatedBy: r.activated_by, note: r.note })

/**
 * Their membership now: active and not over (after an early renewal, the one ending last, so
 * "member until" shows the whole paid time), else a request waiting for payment, else null.
 */
export async function plusFor(db: Db, customerId: string, now = new Date()): Promise<Plus | null> {
  const rows = await db.query<PlusRow>("select * from plus_memberships where customer_id = $1 and status <> 'cancelled' order by requested_at desc", [customerId])
  const active = rows.filter((r) => r.status === "active" && r.ends_at && new Date(r.ends_at) > now).sort((a, b) => Date.parse(b.ends_at!) - Date.parse(a.ends_at!))[0]
  return active ? toPlus(active) : rows.find((r) => r.status === "requested") ? toPlus(rows.find((r) => r.status === "requested")!) : null
}

/** The member's discount on a booking right now (whole rupees), or 0. */
export async function plusDiscount(db: Db, customerId: string, subtotal: number, now = new Date()) {
  const p = await plusFor(db, customerId, now)
  return p?.status === "active" ? Math.round((subtotal * p.discountPct) / 100) : 0
}

/** A customer asks to join (once at a time). Ops then take the fee and activate it. */
export async function requestPlus(db: Db, customerId: string, terms: { price: number; discountPct: number }, by: string) {
  const now = await plusFor(db, customerId)
  if (now) return now
  const id = coreId("PL")
  await db.query("insert into plus_memberships (id, customer_id, price, discount_pct, requested_by) values ($1, $2, $3, $4, $5)", [id, customerId, terms.price, terms.discountPct, by])
  await emit(db, "plus.requested", { customerId }, { membershipId: id })
  return (await plusFor(db, customerId))!
}

/**
 * The fee is in: the membership runs for a year (from the end of a current one, if they renew
 * early). Ops can also add a member by phone, without a request.
 */
export async function activatePlus(db: Db, a: { membershipId?: string; phone?: string; name?: string; terms: { price: number; discountPct: number }; paidVia: string; reference?: string; by: string; now?: Date }) {
  const now = a.now ?? new Date()
  return db.tx(async (t) => {
    let row: PlusRow | null = null
    if (a.membershipId) {
      row = await t.one<PlusRow>("select * from plus_memberships where id = $1 for update", [a.membershipId])
      if (!row || row.status !== "requested") throw new InputError("This Plus request isn't waiting any more")
    } else {
      const p = normalisePhone(a.phone ?? "")
      if (!PHONE.test(p)) throw new InputError("Enter the customer's mobile number (03xx xxxxxxx)")
      const c = await t.one<{ id: string }>(
        `insert into customers (id, phone, name) values ($1, $2, $3)
         on conflict (phone) do update set name = case when customers.name = '' then excluded.name else customers.name end, updated_at = now() returning id`,
        [coreId("C"), p, (a.name ?? "").trim().slice(0, 80)],
      )
      row = await t.one<PlusRow>("select * from plus_memberships where customer_id = $1 and status = 'requested' for update", [c!.id])
      if (!row) {
        const id = coreId("PL")
        row = await t.one<PlusRow>("insert into plus_memberships (id, customer_id, price, discount_pct, requested_by) values ($1, $2, $3, $4, $5) returning *", [id, c!.id, a.terms.price, a.terms.discountPct, a.by])
      }
    }
    const current = await t.one<{ ends_at: string }>("select ends_at from plus_memberships where customer_id = $1 and status = 'active' and ends_at > $2 order by ends_at desc limit 1", [row!.customer_id, now.toISOString()])
    const start = current ? new Date(current.ends_at) : now
    const end = new Date(start.getTime() + 365 * DAY)
    await t.query("update plus_memberships set status = 'active', starts_at = $2, ends_at = $3, paid_via = $4, reference = $5, activated_by = $6, activated_at = $7 where id = $1", [row!.id, start.toISOString(), end.toISOString(), a.paidVia, a.reference?.trim() || null, a.by, now.toISOString()])
    await plusFeePaid(t, { membershipId: row!.id, customerId: row!.customer_id, amount: row!.price, method: a.paidVia, reference: a.reference, actor: a.by })
    await emit(t, "plus.activated", { customerId: row!.customer_id }, { membershipId: row!.id, endsAt: end.toISOString() })
    await writeAudit(t, { actor: a.by, action: "activated Mjazo Plus", target: row!.customer_id, detail: `${row!.id} until ${end.toISOString().slice(0, 10)} (${a.paidVia})` })
    return toPlus((await t.one<PlusRow>("select * from plus_memberships where id = $1", [row!.id]))!)
  })
}

/** A request that won't go ahead (or a membership ended early; refunds go through Money). */
export async function cancelPlus(db: Db, membershipId: string, by: string, note?: string) {
  const r = await db.one<PlusRow>("update plus_memberships set status = 'cancelled', note = coalesce($2, note) where id = $1 and status <> 'cancelled' returning *", [membershipId, note?.trim() || null])
  if (!r) throw new InputError("Already cancelled")
  await writeAudit(db, { actor: by, action: "cancelled Mjazo Plus", target: r.customer_id, detail: `${membershipId}${note ? `: ${note}` : ""}` })
  return toPlus(r)
}

export async function listPlus(db: Db) {
  const rows = await db.query<PlusRow & { name: string; phone: string | null }>(
    `select m.*, c.name, c.phone from plus_memberships m join customers c on c.id = m.customer_id
     where m.status = 'requested' or (m.status = 'active' and m.ends_at > now() - interval '30 days')
     order by case m.status when 'requested' then 0 else 1 end, m.requested_at desc limit 300`,
  )
  return rows.map((r) => ({ ...toPlus(r), name: r.name, phone: r.phone }))
}

// ---------------------------------------------------------------------------
// Gift cards
// ---------------------------------------------------------------------------

export type GiftCard = { code: string; amount: number; status: "active" | "redeemed" | "cancelled"; buyerName: string | null; buyerPhone: string | null; recipientName: string | null; recipientPhone: string | null; message: string | null; paidVia: string | null; createdBy: string; createdAt: string; redeemedBy: string | null; redeemedAt: string | null }
type GiftRow = { code: string; amount: number; status: GiftCard["status"]; buyer_name: string | null; buyer_phone: string | null; recipient_name: string | null; recipient_phone: string | null; message: string | null; paid_via: string | null; created_by: string; created_at: string; redeemed_by: string | null; redeemed_at: string | null }
const toGift = (r: GiftRow): GiftCard => ({ code: r.code, amount: r.amount, status: r.status, buyerName: r.buyer_name, buyerPhone: r.buyer_phone, recipientName: r.recipient_name, recipientPhone: r.recipient_phone, message: r.message, paidVia: r.paid_via, createdBy: r.created_by, createdAt: iso(r.created_at)!, redeemedBy: r.redeemed_by, redeemedAt: iso(r.redeemed_at) })

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O or 1/I
const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")
export const normaliseGiftCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^MJG/, "")

/** A paid-for gift card: a new code, and the money held in the ledger until it's used. */
export async function issueGiftCard(db: Db, g: { amount: number; buyerName?: string; buyerPhone?: string; recipientName?: string; recipientPhone?: string; message?: string; paidVia: string; reference?: string; by: string }) {
  if (!Number.isInteger(g.amount) || g.amount < 500 || g.amount > 200_000) throw new InputError("A gift card is PKR 500 to 200,000")
  const phone = (p?: string) => (p?.trim() ? normalisePhone(p) : null)
  for (const p of [g.buyerPhone, g.recipientPhone]) if (p?.trim() && !PHONE.test(normalisePhone(p))) throw new InputError("Enter mobile numbers as 03xx xxxxxxx")
  return db.tx(async (t) => {
    let code = ""
    for (let i = 0; i < 10 && !code; i++) {
      const c = `MJG-${part()}-${part()}`
      if (!(await t.one("select 1 from gift_cards where code = $1", [c]))) code = c
    }
    await t.query(
      `insert into gift_cards (code, amount, buyer_name, buyer_phone, recipient_name, recipient_phone, message, paid_via, reference, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [code, g.amount, g.buyerName?.trim() || null, phone(g.buyerPhone), g.recipientName?.trim() || null, phone(g.recipientPhone), g.message?.trim().slice(0, 300) || null, g.paidVia, g.reference?.trim() || null, g.by],
    )
    await giftCardSold(t, { code, amount: g.amount, method: g.paidVia, reference: g.reference, actor: g.by })
    await writeAudit(t, { actor: g.by, action: "issued a gift card", target: code, detail: `PKR ${g.amount} (${g.paidVia})` })
    return toGift((await t.one<GiftRow>("select * from gift_cards where code = $1", [code]))!)
  })
}

/** Turns a gift card into the customer's credit (once). */
export async function redeemGiftCard(db: Db, customerId: string, code: string) {
  const key = normaliseGiftCode(code)
  if (key.length !== 8) throw new InputError("Enter the gift card code, like MJG-ABCD-EFGH")
  const full = `MJG-${key.slice(0, 4)}-${key.slice(4)}`
  return db.tx(async (t) => {
    const g = await t.one<GiftRow>("select * from gift_cards where code = $1 for update", [full])
    if (!g || g.status === "cancelled") throw new InputError("That gift card code isn't valid")
    if (g.status === "redeemed") throw new InputError(g.redeemed_by === customerId ? "You've already added this gift card" : "This gift card has already been used")
    await t.query("update gift_cards set status = 'redeemed', redeemed_by = $2, redeemed_at = now() where code = $1", [full, customerId])
    await giftCardRedeemed(t, { code: full, amount: g.amount, customerId, actor: `customer:${customerId}` })
    await emit(t, "giftcard.redeemed", { customerId }, { code: full, amount: g.amount })
    await writeAudit(t, { actor: `customer:${customerId}`, action: "used a gift card", target: full, detail: `PKR ${g.amount}` })
    return { code: full, amount: g.amount }
  })
}

/** An unused card cancelled; its money goes back to the buyer (outside the app). */
export async function cancelGiftCard(db: Db, code: string, by: string, reason?: string) {
  return db.tx(async (t) => {
    const g = await t.one<GiftRow>("select * from gift_cards where code = $1 for update", [code])
    if (!g) throw new InputError("Gift card not found")
    if (g.status !== "active") throw new InputError(g.status === "redeemed" ? "It's been used: it can't be cancelled" : "Already cancelled")
    await t.query("update gift_cards set status = 'cancelled', cancelled_by = $2, cancelled_at = now() where code = $1", [code, by])
    await giftCardRefunded(t, { code, amount: g.amount, actor: by, reason })
    await writeAudit(t, { actor: by, action: "cancelled a gift card", target: code, detail: reason?.trim() || undefined })
    return toGift((await t.one<GiftRow>("select * from gift_cards where code = $1", [code]))!)
  })
}

export async function listGiftCards(db: Db) {
  return (await db.query<GiftRow>("select * from gift_cards order by created_at desc limit 300")).map(toGift)
}

export async function listReferralRewards(db: Db) {
  return db.query<{ friend: string; friend_phone: string | null; referrer: string; referrer_phone: string | null; code: string | null; booking_id: string; amount: number; at: string }>(
    `select f.name as friend, f.phone as friend_phone, r.name as referrer, r.phone as referrer_phone, r.referral_code as code, w.booking_id, w.amount, w.at
     from referral_rewards w join customers f on f.id = w.friend_customer_id join customers r on r.id = w.referrer_customer_id
     order by w.at desc limit 200`,
  )
}
