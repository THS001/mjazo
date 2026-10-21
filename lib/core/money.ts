import "server-only"
import type { Db } from "./db"
import { writeAudit } from "./audit"
import { InputError } from "./errors"
import { allProBalancesAt, bookingPaid, cashHandedIn, issueCredit, payoutSettled, proBalances, refundPaid } from "./ledger"
import { coreId } from "./phone"
import { secondPersonProblem } from "@/lib/ops/access"
import type { Role } from "@/lib/cms/roles"

// Money actions in mission control. Nothing here writes a posting itself: every money move goes
// through lib/core/ledger.ts, inside the same transaction as its approval record and audit entry.
// A person approves every one:
// - refunds and credits: someone asks (Support), someone with the money permission approves;
// - payout runs: drafted from the ledger, approved by a second person, then each payout is marked
//   paid with its transfer reference, which settles it in the ledger (payoutSettled);
// - cash a pro hands in is recorded by the person who received it.

export type Actor = { email: string; role: Role }

// ---------------------------------------------------------------------------
// Refunds and credits
// ---------------------------------------------------------------------------

export type MoneyRequest = {
  id: string
  kind: "refund" | "credit"
  bookingId: string | null
  customerId: string
  amount: number
  reason: string
  status: "pending" | "approved" | "rejected"
  requestedBy: string
  requestedAt: string
  decidedBy: string | null
  decidedAt: string | null
  decisionNote: string | null
  reference: string | null
  entryId: number | null
}

type RequestRow = { id: string; kind: MoneyRequest["kind"]; booking_id: string | null; customer_id: string; amount: number; reason: string; status: MoneyRequest["status"]; requested_by: string; requested_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; reference: string | null; entry_id: number | null }
const toRequest = (r: RequestRow): MoneyRequest => ({ id: r.id, kind: r.kind, bookingId: r.booking_id, customerId: r.customer_id, amount: r.amount, reason: r.reason, status: r.status, requestedBy: r.requested_by, requestedAt: r.requested_at, decidedBy: r.decided_by, decidedAt: r.decided_at, decisionNote: r.decision_note, reference: r.reference, entryId: r.entry_id })

/** How much of a booking can still be refunded: what was paid, less refunds approved or waiting. */
async function refundable(db: Db, bookingId: string) {
  const { paid, refunded } = await bookingPaid(db, bookingId)
  const pending = (await db.one<{ n: number }>("select coalesce(sum(amount), 0)::int as n from money_requests where booking_id = $1 and kind = 'refund' and status = 'pending'", [bookingId]))!.n
  return Math.max(0, paid - refunded - pending)
}

/** Asks for a refund or a credit on a booking. Nothing moves until someone approves it. */
export async function requestMoney(db: Db, r: { kind: MoneyRequest["kind"]; bookingId: string; amount: number; reason: string; by: string }): Promise<MoneyRequest> {
  if (!Number.isInteger(r.amount) || r.amount <= 0) throw new InputError("Enter an amount in whole rupees")
  const reason = r.reason.trim()
  if (reason.length < 3) throw new InputError("Say why (the customer and the approver will see it)")
  return db.tx(async (t) => {
    const b = await t.one<{ customer_id: string | null; total: number }>("select customer_id, total from bookings where id = $1 for update", [r.bookingId])
    if (!b) throw new InputError("Booking not found")
    if (!b.customer_id) throw new InputError("This booking has no customer record yet")
    if (r.kind === "refund") {
      const left = await refundable(t, r.bookingId)
      if (!left) throw new InputError("Nothing paid for this booking is left to refund. Give a credit instead.")
      if (r.amount > left) throw new InputError(`At most PKR ${left.toLocaleString("en-PK")} can be refunded`)
    } else if (r.amount > Math.max(b.total, 1000)) throw new InputError(`A credit for this booking is at most PKR ${Math.max(b.total, 1000).toLocaleString("en-PK")}`)
    const id = coreId("MR")
    const row = await t.one<RequestRow>(
      "insert into money_requests (id, kind, booking_id, customer_id, amount, reason, requested_by) values ($1, $2, $3, $4, $5, $6, $7) returning *",
      [id, r.kind, r.bookingId, b.customer_id, r.amount, reason.slice(0, 500), r.by],
    )
    await writeAudit(t, { actor: r.by, action: `asked for a ${r.kind}`, target: r.bookingId, detail: `PKR ${r.amount}: ${reason}` })
    return toRequest(row!)
  })
}

/**
 * Approves or rejects a refund or credit. Approving posts it to the ledger (once: the request id
 * is the entry's key). The person who asked can't approve it, unless they're an Owner.
 */
export async function decideMoney(db: Db, id: string, d: { approve: boolean; by: Actor; note?: string; reference?: string }): Promise<MoneyRequest> {
  return db.tx(async (t) => {
    const row = await t.one<RequestRow>("select * from money_requests where id = $1 for update", [id])
    if (!row) throw new InputError("Request not found")
    if (row.status !== "pending") throw new InputError(`This was already ${row.status}`)
    const problem = secondPersonProblem(d.by, row.requested_by)
    if (problem && d.approve) throw new InputError(problem)
    let entryId: number | null = null
    if (d.approve) {
      if (row.kind === "refund") {
        if (!d.reference?.trim()) throw new InputError("Enter the refund's transfer reference")
        const bp = await bookingPaid(t, row.booking_id!)
        const left = bp.paid - bp.refunded
        if (row.amount > left) throw new InputError(`Only PKR ${Math.max(0, left).toLocaleString("en-PK")} of this booking is left to refund`)
        entryId = await refundPaid(t, { customerId: row.customer_id, bookingId: row.booking_id!, amount: row.amount, reference: d.reference.trim(), actor: d.by.email, key: `refund:${id}` })
      } else entryId = await issueCredit(t, { customerId: row.customer_id, bookingId: row.booking_id ?? undefined, amount: row.amount, reason: row.reason, actor: d.by.email, key: `credit:${id}` })
    }
    const next = await t.one<RequestRow>(
      "update money_requests set status = $2, decided_by = $3, decided_at = now(), decision_note = $4, reference = $5, entry_id = $6 where id = $1 returning *",
      [id, d.approve ? "approved" : "rejected", d.by.email, d.note?.trim().slice(0, 500) || null, d.reference?.trim().slice(0, 120) || null, entryId],
    )
    await writeAudit(t, { actor: d.by.email, action: `${d.approve ? "approved" : "rejected"} a ${row.kind}`, target: row.booking_id ?? row.customer_id, detail: `${id}: PKR ${row.amount}${d.reference ? ` (ref ${d.reference.trim()})` : ""}${d.note ? `. ${d.note.trim()}` : ""}` })
    return toRequest(next!)
  })
}

export async function listMoneyRequests(db: Db, f: { status?: MoneyRequest["status"]; bookingId?: string; limit?: number } = {}): Promise<MoneyRequest[]> {
  const where: string[] = []
  const vals: unknown[] = []
  if (f.status) {
    vals.push(f.status)
    where.push(`status = $${vals.length}`)
  }
  if (f.bookingId) {
    vals.push(f.bookingId)
    where.push(`booking_id = $${vals.length}`)
  }
  vals.push(f.limit ?? 100)
  const rows = await db.query<RequestRow>(`select * from money_requests ${where.length ? `where ${where.join(" and ")}` : ""} order by requested_at desc limit $${vals.length}`, vals)
  return rows.map(toRequest)
}

// ---------------------------------------------------------------------------
// Cash handed in
// ---------------------------------------------------------------------------

/** A pro hands cash in: recorded by the person who received it, at most what she's holding. */
export async function recordCashIn(db: Db, c: { proId: string; amount: number; reference?: string; by: string }) {
  if (!Number.isInteger(c.amount) || c.amount <= 0) throw new InputError("Enter an amount in whole rupees")
  return db.tx(async (t) => {
    if (!(await t.one("select 1 from pros where id = $1 for update", [c.proId]))) throw new InputError("Pro not found")
    const { cashHeld } = await proBalances(t, c.proId)
    if (c.amount > cashHeld) throw new InputError(`She's holding PKR ${Math.max(0, cashHeld).toLocaleString("en-PK")}`)
    const entryId = await cashHandedIn(t, { proId: c.proId, amount: c.amount, reference: c.reference?.trim().slice(0, 120) || undefined, actor: c.by, key: `cash-in:${coreId("CI")}` })
    await writeAudit(t, { actor: c.by, action: "recorded cash handed in", target: c.proId, detail: `PKR ${c.amount}${c.reference ? ` (${c.reference.trim()})` : ""}` })
    return entryId
  })
}

// ---------------------------------------------------------------------------
// Payout runs
// ---------------------------------------------------------------------------

export type Payout = { id: string; runId: string; proId: string; proName: string; earned: number; cashHeld: number; netted: number; amount: number; status: "draft" | "approved" | "paid" | "cancelled"; reference: string | null; paidAt: string | null; paidBy: string | null }
export type PayoutRun = { id: string; periodStart: string; periodEnd: string; cutOff: string; status: "draft" | "approved" | "paid" | "cancelled"; createdBy: string; createdAt: string; approvedBy: string | null; approvedAt: string | null; payouts: Payout[]; totals: { pay: number; collect: number; netted: number } }

/** One pro's settlement: cash she holds is netted against what she's owed; the rest is paid (or handed in). */
export function settlement(payable: number, cashHeld: number) {
  const netted = Math.max(0, Math.min(payable, cashHeld))
  return { netted, amount: payable - cashHeld }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Drafts a payout run for a period, from the ledger as it stood at the end of the period (or
 * now, if that's earlier). The same balance is never paid twice: one open run at a time, runs
 * only move forward in time (a cut-off is never before an earlier run's), and every payout already
 * settled counts against the balances, whenever it was paid.
 */
export async function draftPayoutRun(db: Db, p: { periodStart: string; periodEnd: string; by: string; now?: Date }): Promise<PayoutRun> {
  if (!DAY.test(p.periodStart) || !DAY.test(p.periodEnd) || p.periodStart > p.periodEnd) throw new InputError("Pick a period: a start day on or before the end day")
  const now = p.now ?? new Date()
  const endOfPeriod = new Date(new Date(`${p.periodEnd}T00:00:00+05:00`).getTime() + 86400000)
  const cutOff = new Date(Math.min(endOfPeriod.getTime(), now.getTime())).toISOString()
  const runId = await db.tx(async (t) => {
    // Serialise drafting: two people pressing the button at once must not both get a run.
    await t.query("insert into core_meta (key) values ('payout_runs_lock') on conflict (key) do nothing")
    await t.query("select key from core_meta where key = 'payout_runs_lock' for update")
    const open = await t.one<{ id: string }>("select id from payout_runs where status in ('draft', 'approved') limit 1")
    if (open) throw new InputError(`Run ${open.id} is still open: pay or cancel it first`)
    const last = await t.one<{ cut_off: string; period_end: string }>("select cut_off, period_end from payout_runs where status <> 'cancelled' order by cut_off desc limit 1")
    if (last && Date.parse(cutOff) < Date.parse(last.cut_off)) throw new InputError(`A run up to ${last.period_end} was already made: pick a later period`)
    const balances = await allProBalancesAt(t, cutOff)
    const pros = new Map((await t.query<{ id: string }>("select id from pros")).map((r) => [r.id, r]))
    const id = coreId("PR")
    await t.query("insert into payout_runs (id, period_start, period_end, cut_off, created_by) values ($1, $2, $3, $4, $5)", [id, p.periodStart, p.periodEnd, cutOff, p.by])
    let n = 0
    for (const [proId, b] of balances) {
      // Never below zero (that would mean a later settlement already covered it).
      const payable = Math.max(0, b.payable)
      const cashHeld = Math.max(0, b.cashHeld)
      if (!pros.has(proId) || (payable === 0 && cashHeld === 0)) continue
      const s = settlement(payable, cashHeld)
      await t.query(
        "insert into payouts (id, run_id, pro_id, period_start, period_end, earned, cash_held, netted, amount, status) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')",
        [coreId("PO"), id, proId, p.periodStart, p.periodEnd, payable, cashHeld, s.netted, s.amount],
      )
      n++
    }
    if (!n) throw new InputError("Nobody is owed anything or holding cash for this period")
    await writeAudit(t, { actor: p.by, action: "drafted a payout run", target: id, detail: `${p.periodStart} to ${p.periodEnd}, ${n} pros` })
    return id
  })
  return (await getPayoutRun(db, runId))!
}

/** A second person approves the run (Owners may approve their own). */
export async function approvePayoutRun(db: Db, runId: string, by: Actor) {
  await db.tx(async (t) => {
    const run = await t.one<{ status: string; created_by: string }>("select status, created_by from payout_runs where id = $1 for update", [runId])
    if (!run) throw new InputError("Payout run not found")
    if (run.status !== "draft") throw new InputError(`This run is ${run.status}`)
    const problem = secondPersonProblem(by, run.created_by)
    if (problem) throw new InputError(problem.replace("you asked for it", "you drafted it"))
    await t.query("update payout_runs set status = 'approved', approved_by = $2, approved_at = now() where id = $1", [runId, by.email])
    await t.query("update payouts set status = 'approved', approved_by = $2, approved_at = now() where run_id = $1 and status = 'draft'", [runId, by.email])
    await writeAudit(t, { actor: by.email, action: "approved a payout run", target: runId })
  })
  return (await getPayoutRun(db, runId))!
}

/**
 * Marks one payout paid (or the cash collected, when she owed Mjazo) with its reference, and
 * settles it in the ledger. Refused if her balances have dropped below the run's figures since it
 * was drafted (e.g. cash handed in meanwhile): cancel the run and draft it again.
 */
export async function payPayout(db: Db, payoutId: string, p: { reference: string; by: string }) {
  const runId = await db.tx(async (t) => {
    const po = await t.one<{ run_id: string; pro_id: string; netted: number; amount: number; status: string }>("select run_id, pro_id, netted, amount, status from payouts where id = $1 for update", [payoutId])
    if (!po) throw new InputError("Payout not found")
    const run = await t.one<{ status: string }>("select status from payout_runs where id = $1 for update", [po.run_id])
    if (run?.status !== "approved") throw new InputError("The run has to be approved first")
    if (po.status !== "approved") throw new InputError(`This payout is ${po.status}`)
    const reference = p.reference.trim()
    if (po.amount !== 0 && !reference) throw new InputError(po.amount > 0 ? "Enter the transfer reference" : "Enter the receipt number for the cash handed in")
    const now = await proBalances(t, po.pro_id)
    const needPayable = po.netted + Math.max(0, po.amount)
    const needCash = po.netted + Math.max(0, -po.amount)
    if (now.payable < needPayable || now.cashHeld < needCash) throw new InputError("Her balances changed since the run was drafted (cash handed in or a correction). Cancel this run and draft a new one.")
    const entryId = await payoutSettled(t, { payoutId, proId: po.pro_id, netted: po.netted, amount: po.amount, reference: reference || undefined, actor: p.by })
    await t.query("update payouts set status = 'paid', reference = $2, paid_at = now(), paid_by = $3, entry_id = $4 where id = $1", [payoutId, reference.slice(0, 120) || null, p.by, entryId])
    const left = await t.one("select 1 from payouts where run_id = $1 and status = 'approved' limit 1", [po.run_id])
    if (!left) await t.query("update payout_runs set status = 'paid' where id = $1", [po.run_id])
    await writeAudit(t, { actor: p.by, action: po.amount >= 0 ? "paid a payout" : "collected cash for a payout", target: po.pro_id, detail: `${payoutId}: PKR ${Math.abs(po.amount)} (netted ${po.netted})${reference ? `, ref ${reference}` : ""}` })
    return po.run_id
  })
  return (await getPayoutRun(db, runId))!
}

/** Cancels a run nobody has been paid from yet. */
export async function cancelPayoutRun(db: Db, runId: string, by: string) {
  await db.tx(async (t) => {
    const run = await t.one<{ status: string }>("select status from payout_runs where id = $1 for update", [runId])
    if (!run) throw new InputError("Payout run not found")
    if (run.status !== "draft" && run.status !== "approved") throw new InputError(`This run is ${run.status}`)
    if (await t.one("select 1 from payouts where run_id = $1 and status = 'paid' limit 1", [runId])) throw new InputError("Some payouts in this run are already paid: pay the rest instead")
    await t.query("update payout_runs set status = 'cancelled', cancelled_by = $2, cancelled_at = now() where id = $1", [runId, by])
    await t.query("update payouts set status = 'cancelled' where run_id = $1", [runId])
    await writeAudit(t, { actor: by, action: "cancelled a payout run", target: runId })
  })
}

type RunRow = { id: string; period_start: string; period_end: string; cut_off: string; status: PayoutRun["status"]; created_by: string; created_at: string; approved_by: string | null; approved_at: string | null }
type PayoutRow = { id: string; run_id: string; pro_id: string; name: string | null; earned: number; cash_held: number; netted: number; amount: number; status: Payout["status"]; reference: string | null; paid_at: string | null; paid_by: string | null }

async function withPayouts(db: Db, runs: RunRow[]): Promise<PayoutRun[]> {
  if (!runs.length) return []
  const rows = await db.query<PayoutRow>("select po.*, p.name from payouts po left join pros p on p.id = po.pro_id where po.run_id = any($1::text[]) order by p.name, po.id", [runs.map((r) => r.id)])
  return runs.map((r) => {
    const payouts = rows.filter((x) => x.run_id === r.id).map((x): Payout => ({ id: x.id, runId: x.run_id, proId: x.pro_id, proName: x.name ?? x.pro_id, earned: x.earned, cashHeld: x.cash_held, netted: x.netted, amount: x.amount, status: x.status, reference: x.reference, paidAt: x.paid_at, paidBy: x.paid_by }))
    const totals = { pay: payouts.reduce((s, x) => s + Math.max(0, x.amount), 0), collect: payouts.reduce((s, x) => s + Math.max(0, -x.amount), 0), netted: payouts.reduce((s, x) => s + x.netted, 0) }
    return { id: r.id, periodStart: r.period_start, periodEnd: r.period_end, cutOff: r.cut_off, status: r.status, createdBy: r.created_by, createdAt: r.created_at, approvedBy: r.approved_by, approvedAt: r.approved_at, payouts, totals }
  })
}

export async function getPayoutRun(db: Db, id: string) {
  const r = await db.one<RunRow>("select * from payout_runs where id = $1", [id])
  return r ? (await withPayouts(db, [r]))[0] : null
}

export const listPayoutRuns = async (db: Db, limit = 12) => withPayouts(db, await db.query<RunRow>("select * from payout_runs order by created_at desc limit $1", [limit]))
