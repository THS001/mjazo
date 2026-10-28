import "server-only"
import type { Db } from "./db"

// The money ledger (double-entry). Every amount is whole PKR. A posting is positive for a debit
// and negative for a credit, and every entry sums to zero; the database refuses anything else
// (supabase/migrations/0005_core.sql) and never lets an entry change afterwards.
//
// Accounts:
//   cust:<id>:ar        asset      what a customer owes for a completed visit
//   cust:<id>:credit    liability  wallet credit Mjazo owes a customer
//   pro:<id>:cash       asset      cash a pro is holding for Mjazo
//   pro:<id>:payable    liability  what Mjazo owes a pro
//   mjazo:bank          asset      Mjazo's bank / JazzCash / Easypaisa / Raast
//   mjazo:commission    revenue    Mjazo's share of each visit
//   mjazo:discounts     expense    promo and referral discounts (Mjazo funds them, not the pro)
//   mjazo:goodwill      expense    credits given to customers
//   mjazo:refunds       expense    money paid back to customers
//   mjazo:plus          revenue    Mjazo Plus membership fees
//   mjazo:giftcards     liability  gift cards sold and not yet turned into credit
//   mjazo:referrals     expense    credit given to customers for a friend's first visit
//   mjazo:packs         liability  packs paid for and not yet used
//   mjazo:salestax      liability  Sindh sales tax charged and owed to the SRB
//
// Pros earn on the full price: a discount, or sales tax inside the price, comes out of Mjazo's
// share, never hers.

export const ACC = {
  custAr: (id: string) => `cust:${id}:ar`,
  custCredit: (id: string) => `cust:${id}:credit`,
  proCash: (id: string) => `pro:${id}:cash`,
  proPayable: (id: string) => `pro:${id}:payable`,
  bank: "mjazo:bank",
  commission: "mjazo:commission",
  discounts: "mjazo:discounts",
  goodwill: "mjazo:goodwill",
  refunds: "mjazo:refunds",
  plus: "mjazo:plus",
  giftCards: "mjazo:giftcards",
  referrals: "mjazo:referrals",
  packs: "mjazo:packs",
  salesTax: "mjazo:salestax",
} as const

type Kind = "asset" | "liability" | "revenue" | "expense"

/** The account's kind and owner, from its id. */
export function accountInfo(id: string): { kind: Kind; ownerType: "pro" | "customer" | "mjazo"; ownerId: string | null; name: string } {
  const [scope, owner, what] = id.split(":")
  if (scope === "cust" && what === "ar") return { kind: "asset", ownerType: "customer", ownerId: owner, name: `Owed by customer ${owner}` }
  if (scope === "cust" && what === "credit") return { kind: "liability", ownerType: "customer", ownerId: owner, name: `Credit for customer ${owner}` }
  if (scope === "pro" && what === "cash") return { kind: "asset", ownerType: "pro", ownerId: owner, name: `Cash held by pro ${owner}` }
  if (scope === "pro" && what === "payable") return { kind: "liability", ownerType: "pro", ownerId: owner, name: `Owed to pro ${owner}` }
  const mjazo: Record<string, [Kind, string]> = {
    bank: ["asset", "Mjazo bank and wallets"],
    commission: ["revenue", "Commission"],
    discounts: ["expense", "Discounts"],
    goodwill: ["expense", "Goodwill credits"],
    refunds: ["expense", "Refunds"],
    plus: ["revenue", "Mjazo Plus fees"],
    giftcards: ["liability", "Gift cards not yet used"],
    referrals: ["expense", "Referral rewards"],
    packs: ["liability", "Packs not yet used"],
    salestax: ["liability", "Sales tax owed (SRB)"],
  }
  if (scope === "mjazo" && mjazo[owner]) return { kind: mjazo[owner][0], ownerType: "mjazo", ownerId: null, name: mjazo[owner][1] }
  throw new LedgerError(`Unknown ledger account ${id}`)
}

export class LedgerError extends Error {}

export type Posting = { account: string; amount: number }
export type EntryInput = {
  kind: string
  postings: Posting[]
  bookingId?: string
  proId?: string
  customerId?: string
  memo?: string
  actor?: string
  /** Posting the same key twice does nothing the second time. */
  key?: string
}

/** Posts one balanced entry. Returns its id, or null when an entry with the same key already exists. */
export async function post(db: Db, e: EntryInput): Promise<number | null> {
  const lines = e.postings.filter((p) => p.amount !== 0)
  for (const p of lines) if (!Number.isInteger(p.amount)) throw new LedgerError(`Amounts are whole rupees (got ${p.amount})`)
  const sum = lines.reduce((s, p) => s + p.amount, 0)
  if (lines.length < 2 || sum !== 0) throw new LedgerError(`Entry "${e.kind}" doesn't balance (sum ${sum})`)
  return db.tx(async (t) => {
    for (const p of lines) {
      const a = accountInfo(p.account)
      await t.query("insert into ledger_accounts (id, kind, owner_type, owner_id, name) values ($1, $2, $3, $4, $5) on conflict (id) do nothing", [p.account, a.kind, a.ownerType, a.ownerId, a.name])
    }
    const row = await t.one<{ id: number }>(
      `insert into journal_entries (kind, booking_id, pro_id, customer_id, memo, actor, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7) on conflict (idempotency_key) do nothing returning id`,
      [e.kind, e.bookingId ?? null, e.proId ?? null, e.customerId ?? null, e.memo ?? null, e.actor ?? null, e.key ?? null],
    )
    if (!row) return null
    for (const p of lines) await t.query("insert into postings (entry_id, account_id, amount) values ($1, $2, $3)", [row.id, p.account, p.amount])
    return row.id
  })
}

/** Flips a balance's sign (liabilities and revenue are credit balances) without producing -0. */
const neg = (n: number) => (n === 0 ? 0 : -n)

export const balance = async (db: Db, account: string) =>
  (await db.one<{ b: number }>("select coalesce(sum(amount), 0)::int as b from postings where account_id = $1", [account]))!.b

// ---------------------------------------------------------------------------
// Business flows
// ---------------------------------------------------------------------------

/** The pro's share of a price, at her commission rate (Mjazo's share is the rest). */
export const proShare = (gross: number, commissionRate: number) => Math.round(gross * (1 - commissionRate))

/**
 * A visit is done: the customer owes the total; the pro has earned her share of the full price.
 * Sales tax (`tax`) is owed to the SRB: inside the price it comes out of Mjazo's share, on top the
 * customer's total carries it.
 */
export function visitCompleted(db: Db, v: { bookingId: string; customerId: string; proId: string; subtotal: number; discount: number; total: number; commissionRate: number; tax?: { amount: number; inclusive: boolean }; memo?: string; actor?: string }) {
  const tax = v.tax?.amount ?? 0
  const onTop = v.tax && !v.tax.inclusive ? tax : 0
  if (v.total !== v.subtotal - v.discount + onTop) throw new LedgerError(onTop ? "Total must be the subtotal less the discount, plus the sales tax" : "Total must be the subtotal less the discount")
  const share = proShare(v.subtotal, v.commissionRate)
  return post(db, {
    kind: "visit_completed",
    key: `visit:${v.bookingId}`,
    bookingId: v.bookingId,
    customerId: v.customerId,
    proId: v.proId,
    actor: v.actor,
    memo: v.memo,
    postings: [
      { account: ACC.custAr(v.customerId), amount: v.total },
      { account: ACC.discounts, amount: v.discount },
      { account: ACC.proPayable(v.proId), amount: -share },
      { account: ACC.commission, amount: -(v.subtotal - share - (tax - onTop)) },
      { account: ACC.salesTax, amount: -tax },
    ],
  })
}

export type PayMethod = "cash" | "jazzcash" | "easypaisa" | "raast"
const moneyAccount = (method: PayMethod, proId: string) => (method === "cash" ? ACC.proCash(proId) : ACC.bank)

/**
 * Brings the ledger in line with what was paid for a booking: cash goes to the pro who collected
 * it, digital payments to Mjazo's accounts. Re-recording (a corrected amount or method) posts only
 * the difference, so calling it again with the same figures does nothing.
 */
export async function settlePayment(db: Db, p: { bookingId: string; customerId: string; proId: string; amount: number; method: PayMethod; actor?: string }) {
  return db.tx(async (t) => {
    const rows = await t.query<{ account_id: string; amount: number }>(
      `select p.account_id, sum(p.amount)::int as amount from postings p join journal_entries e on e.id = p.entry_id
       where e.booking_id = $1 and e.kind = 'payment' and p.account_id <> $2 group by p.account_id`,
      [p.bookingId, ACC.custAr(p.customerId)],
    )
    const have = new Map(rows.map((r) => [r.account_id, r.amount]))
    const target = new Map([[moneyAccount(p.method, p.proId), p.amount]])
    const lines: Posting[] = []
    for (const acc of new Set([...have.keys(), ...target.keys()])) {
      const diff = (target.get(acc) ?? 0) - (have.get(acc) ?? 0)
      if (diff) lines.push({ account: acc, amount: diff })
    }
    if (!lines.length) return null
    lines.push({ account: ACC.custAr(p.customerId), amount: -lines.reduce((s, l) => s + l.amount, 0) })
    return post(t, { kind: "payment", bookingId: p.bookingId, customerId: p.customerId, proId: p.proId, actor: p.actor, memo: `${p.method} ${p.amount}`, postings: lines })
  })
}

/** A pro hands cash in to Mjazo. */
export function cashHandedIn(db: Db, c: { proId: string; amount: number; reference?: string; actor?: string; key?: string }) {
  if (c.amount <= 0) throw new LedgerError("The amount handed in must be more than zero")
  return post(db, {
    kind: "cash_handed_in",
    key: c.key,
    proId: c.proId,
    actor: c.actor,
    memo: c.reference,
    postings: [
      { account: ACC.bank, amount: c.amount },
      { account: ACC.proCash(c.proId), amount: -c.amount },
    ],
  })
}

/**
 * Settles a payout run: the cash she holds is netted against what she's owed, then Mjazo pays the
 * rest (amount > 0) or she hands the extra cash in (amount < 0).
 */
export function payoutSettled(db: Db, s: { payoutId: string; proId: string; netted: number; amount: number; reference?: string; actor?: string }) {
  const postings: Posting[] = [
    { account: ACC.proPayable(s.proId), amount: s.netted },
    { account: ACC.proCash(s.proId), amount: -s.netted },
  ]
  if (s.amount > 0) postings.push({ account: ACC.proPayable(s.proId), amount: s.amount }, { account: ACC.bank, amount: -s.amount })
  if (s.amount < 0) postings.push({ account: ACC.bank, amount: -s.amount }, { account: ACC.proCash(s.proId), amount: s.amount })
  return post(db, { kind: "payout", key: `payout:${s.payoutId}`, proId: s.proId, actor: s.actor, memo: s.reference, postings })
}

/** Goodwill credit for a customer (a person approves it first). */
export function issueCredit(db: Db, c: { customerId: string; amount: number; reason: string; bookingId?: string; actor?: string; key?: string }) {
  if (c.amount <= 0) throw new LedgerError("A credit must be more than zero")
  return post(db, {
    kind: "credit_issued",
    key: c.key,
    customerId: c.customerId,
    bookingId: c.bookingId,
    actor: c.actor,
    memo: c.reason,
    postings: [
      { account: ACC.goodwill, amount: c.amount },
      { account: ACC.custCredit(c.customerId), amount: -c.amount },
    ],
  })
}

/** A Plus membership fee received (bank, wallet or cash handed to the office). */
export function plusFeePaid(db: Db, p: { membershipId: string; customerId: string; amount: number; method: string; reference?: string; actor?: string }) {
  if (p.amount <= 0) return Promise.resolve(null)
  return post(db, {
    kind: "plus_paid",
    key: `plus:${p.membershipId}`,
    customerId: p.customerId,
    actor: p.actor,
    memo: [`Plus ${p.membershipId} (${p.method})`, p.reference].filter(Boolean).join(" · "),
    postings: [
      { account: ACC.bank, amount: p.amount },
      { account: ACC.plus, amount: -p.amount },
    ],
  })
}

/** A gift card paid for: the money is held until the card is turned into credit. */
export function giftCardSold(db: Db, g: { code: string; amount: number; method: string; reference?: string; actor?: string }) {
  return post(db, {
    kind: "giftcard_sold",
    key: `giftcard:${g.code}:sold`,
    actor: g.actor,
    memo: [`Gift card ${g.code} (${g.method})`, g.reference].filter(Boolean).join(" · "),
    postings: [
      { account: ACC.bank, amount: g.amount },
      { account: ACC.giftCards, amount: -g.amount },
    ],
  })
}

/** A gift card turned into the customer's credit. */
export function giftCardRedeemed(db: Db, g: { code: string; amount: number; customerId: string; actor?: string }) {
  return post(db, {
    kind: "giftcard_redeemed",
    key: `giftcard:${g.code}:redeemed`,
    customerId: g.customerId,
    actor: g.actor,
    memo: `Gift card ${g.code}`,
    postings: [
      { account: ACC.giftCards, amount: g.amount },
      { account: ACC.custCredit(g.customerId), amount: -g.amount },
    ],
  })
}

/** An unused gift card cancelled and its money given back to the buyer. */
export function giftCardRefunded(db: Db, g: { code: string; amount: number; actor?: string; reason?: string }) {
  return post(db, {
    kind: "giftcard_refunded",
    key: `giftcard:${g.code}:refunded`,
    actor: g.actor,
    memo: [`Gift card ${g.code} cancelled`, g.reason].filter(Boolean).join(" · "),
    postings: [
      { account: ACC.giftCards, amount: g.amount },
      { account: ACC.bank, amount: -g.amount },
    ],
  })
}

/** A pack paid for: the money is held until each visit is done. */
export function packSold(db: Db, p: { packId: string; customerId: string; amount: number; method: string; reference?: string; actor?: string }) {
  return post(db, {
    kind: "pack_sold",
    key: `pack:${p.packId}:sold`,
    customerId: p.customerId,
    actor: p.actor,
    memo: [`Pack ${p.packId} (${p.method})`, p.reference].filter(Boolean).join(" · "),
    postings: [
      { account: ACC.bank, amount: p.amount },
      { account: ACC.packs, amount: -p.amount },
    ],
  })
}

/** A visit made with a pack is done: the pack pays its price a visit towards what the customer owes. */
export function packVisitUsed(db: Db, p: { packId: string; bookingId: string; customerId: string; amount: number }) {
  return post(db, {
    kind: "pack_used",
    key: `pack-used:${p.bookingId}`,
    customerId: p.customerId,
    bookingId: p.bookingId,
    memo: `Pack ${p.packId}`,
    postings: [
      { account: ACC.packs, amount: p.amount },
      { account: ACC.custAr(p.customerId), amount: -p.amount },
    ],
  })
}

/** A pack cancelled: its unused visits' money given back to the customer (outside the app). */
export function packRefunded(db: Db, p: { packId: string; customerId: string; amount: number; reason?: string; actor?: string }) {
  return post(db, {
    kind: "pack_refunded",
    key: `pack:${p.packId}:refunded`,
    customerId: p.customerId,
    actor: p.actor,
    memo: [`Pack ${p.packId} cancelled`, p.reason].filter(Boolean).join(" · "),
    postings: [
      { account: ACC.packs, amount: p.amount },
      { account: ACC.bank, amount: -p.amount },
    ],
  })
}

/** Credit for the customer whose friend's first visit is done. */
export function referralRewarded(db: Db, r: { referrerId: string; friendId: string; bookingId: string; amount: number }) {
  return post(db, {
    kind: "referral_reward",
    key: `referral:${r.friendId}`,
    customerId: r.referrerId,
    bookingId: r.bookingId,
    actor: "automation",
    memo: `A friend's first visit (${r.bookingId})`,
    postings: [
      { account: ACC.referrals, amount: r.amount },
      { account: ACC.custCredit(r.referrerId), amount: -r.amount },
    ],
  })
}

/** Uses a customer's credit towards what they owe for a booking. */
export async function applyCredit(db: Db, c: { customerId: string; bookingId: string; amount: number; actor?: string }) {
  const available = neg(await balance(db, ACC.custCredit(c.customerId)))
  if (c.amount <= 0 || c.amount > available) throw new LedgerError(`Only PKR ${available} of credit is available`)
  return post(db, {
    kind: "credit_applied",
    key: `credit-applied:${c.bookingId}`,
    customerId: c.customerId,
    bookingId: c.bookingId,
    actor: c.actor,
    postings: [
      { account: ACC.custCredit(c.customerId), amount: c.amount },
      { account: ACC.custAr(c.customerId), amount: -c.amount },
    ],
  })
}

/** Money paid back to a customer (a person approves it first). */
export function refundPaid(db: Db, r: { customerId: string; bookingId: string; amount: number; reference?: string; actor?: string; key?: string }) {
  if (r.amount <= 0) throw new LedgerError("A refund must be more than zero")
  return post(db, {
    kind: "refund",
    key: r.key,
    customerId: r.customerId,
    bookingId: r.bookingId,
    actor: r.actor,
    memo: r.reference,
    postings: [
      { account: ACC.refunds, amount: r.amount },
      { account: ACC.bank, amount: -r.amount },
    ],
  })
}

// ---------------------------------------------------------------------------
// Reading balances
// ---------------------------------------------------------------------------

/** Cash she's holding for Mjazo, and what Mjazo owes her. */
export async function proBalances(db: Db, proId: string) {
  return { cashHeld: await balance(db, ACC.proCash(proId)), payable: neg(await balance(db, ACC.proPayable(proId))) }
}

/** What a customer still owes, and their wallet credit. */
export async function customerBalances(db: Db, customerId: string) {
  return { owes: await balance(db, ACC.custAr(customerId)), credit: neg(await balance(db, ACC.custCredit(customerId))) }
}

/** Cash held and payable for every pro with any ledger activity. */
export async function allProBalances(db: Db) {
  const rows = await db.query<{ owner_id: string; cash: number; payable: number }>(
    `select a.owner_id,
       coalesce(sum(p.amount) filter (where a.id like '%:cash'), 0)::int as cash,
       (-coalesce(sum(p.amount) filter (where a.id like '%:payable'), 0))::int as payable
     from ledger_accounts a left join postings p on p.account_id = a.id
     where a.owner_type = 'pro' group by a.owner_id`,
  )
  return new Map(rows.map((r) => [r.owner_id, { cashHeld: r.cash, payable: r.payable }]))
}

/**
 * Cash held and payable for every pro as they stood at `cutOff` (an ISO time), for a payout run.
 * Payout settlements always count, whenever they were posted, so a payout already made is never
 * paid again by a run with an earlier cut-off.
 */
export async function allProBalancesAt(db: Db, cutOff: string) {
  const rows = await db.query<{ owner_id: string; cash: number; payable: number }>(
    `select a.owner_id,
       coalesce(sum(p.amount) filter (where a.id like '%:cash'), 0)::int as cash,
       (-coalesce(sum(p.amount) filter (where a.id like '%:payable'), 0))::int as payable
     from ledger_accounts a join postings p on p.account_id = a.id join journal_entries e on e.id = p.entry_id
     where a.owner_type = 'pro' and (e.at <= $1 or e.kind = 'payout') group by a.owner_id`,
    [cutOff],
  )
  return new Map(rows.map((r) => [r.owner_id, { cashHeld: r.cash, payable: r.payable }]))
}

/** What was paid for a booking (cash or digital, as counted in the books), and refunded from it. */
export async function bookingPaid(db: Db, bookingId: string) {
  const r = await db.one<{ paid: number; refunded: number }>(
    `select coalesce(sum(p.amount) filter (where e.kind = 'payment' and (p.account_id = $2 or p.account_id like 'pro:%:cash')), 0)::int as paid,
       coalesce(sum(p.amount) filter (where e.kind = 'refund' and p.account_id = $3), 0)::int as refunded
     from journal_entries e join postings p on p.entry_id = e.id where e.booking_id = $1`,
    [bookingId, ACC.bank, ACC.refunds],
  )
  return { paid: r?.paid ?? 0, refunded: r?.refunded ?? 0 }
}

/** Every entry posted for a booking, oldest first, with its postings. */
export async function bookingEntries(db: Db, bookingId: string) {
  const rows = await db.query<{ id: number; at: string; kind: string; memo: string | null; actor: string | null; account_id: string; amount: number }>(
    "select e.id, e.at, e.kind, e.memo, e.actor, p.account_id, p.amount from journal_entries e join postings p on p.entry_id = e.id where e.booking_id = $1 order by e.id, p.id",
    [bookingId],
  )
  const out: { id: number; at: string; kind: string; memo: string | null; actor: string | null; postings: Posting[] }[] = []
  for (const r of rows) {
    let e = out.at(-1)
    if (!e || e.id !== r.id) out.push((e = { id: r.id, at: r.at, kind: r.kind, memo: r.memo, actor: r.actor, postings: [] }))
    e.postings.push({ account: r.account_id, amount: r.amount })
  }
  return out
}

/** What a pro earned from visits completed since an ISO time, and how many visits that was. */
export async function earnedSince(db: Db, proId: string, since: string) {
  const r = await db.one<{ earned: number; visits: number }>(
    `select (-coalesce(sum(p.amount), 0))::int as earned, count(distinct e.id)::int as visits
     from journal_entries e join postings p on p.entry_id = e.id
     where e.kind = 'visit_completed' and p.account_id = $1 and e.at >= $2`,
    [ACC.proPayable(proId), since],
  )
  return { earned: r?.earned ?? 0, visits: r?.visits ?? 0 }
}

export type StatementLine ={ entryId: number; at: string; kind: string; bookingId: string | null; memo: string | null; cash: number; earned: number }

/** A pro's statement: every entry touching her accounts, newest first, with running effects. */
export async function proStatement(db: Db, proId: string, limit = 100): Promise<StatementLine[]> {
  const rows = await db.query<{ id: number; at: string; kind: string; booking_id: string | null; memo: string | null; cash: number; payable: number }>(
    `select e.id, e.at, e.kind, e.booking_id, e.memo,
       coalesce(sum(p.amount) filter (where p.account_id = $1), 0)::int as cash,
       coalesce(sum(p.amount) filter (where p.account_id = $2), 0)::int as payable
     from journal_entries e join postings p on p.entry_id = e.id
     where p.account_id in ($1, $2) group by e.id order by e.at desc, e.id desc limit $3`,
    [ACC.proCash(proId), ACC.proPayable(proId), limit],
  )
  return rows.map((r) => ({ entryId: r.id, at: r.at, kind: r.kind, bookingId: r.booking_id, memo: r.memo, cash: r.cash, earned: neg(r.payable) }))
}

/** Every account's balance by kind; assets + expenses always equal liabilities + revenue. */
export async function trialBalance(db: Db) {
  const rows = await db.query<{ kind: Kind; total: number }>("select a.kind, coalesce(sum(p.amount), 0)::int as total from ledger_accounts a left join postings p on p.account_id = a.id group by a.kind")
  const by = Object.fromEntries(rows.map((r) => [r.kind, r.total])) as Partial<Record<Kind, number>>
  const sum = (by.asset ?? 0) + (by.expense ?? 0) + (by.liability ?? 0) + (by.revenue ?? 0)
  return { ...by, balanced: sum === 0 }
}
