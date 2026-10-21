import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import type { Job } from "@/lib/ops/types"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { createBooking, mutateJob, savePro, type NewBooking } from "./jobs"
import { bookingPaid, customerBalances, proBalances, trialBalance } from "./ledger"
import { approvePayoutRun, cancelPayoutRun, decideMoney, draftPayoutRun, listMoneyRequests, payPayout, recordCashIn, requestMoney, settlement } from "./money"
import { canApply, STATUS_FOR } from "./status"

// Mission control's money flows on a real (in-memory) Postgres: a visit from assignment to cash
// held, payout runs from draft to paid, refunds and credits through approval. After every flow
// the books balance and each entry sums to zero.

const cat = buildCatalog(DEFAULT_CATALOG)
let db: Db & { close(): Promise<void> }
const FIN = { email: "fin@mjazo.test", role: "finance" as const }
const FIN2 = { email: "fin2@mjazo.test", role: "finance" as const }
const OWNER = { email: "owner@mjazo.test", role: "owner" as const }

const wax = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: ["Rica (peel-off)"], addOns: ["Face wax"], qty: 1, unitPrice: 1 }
let n = 0
const book = (over: Partial<NewBooking> = {}) => createBooking(db, { id: `MJ-T${++n}`, name: "Ayesha", phone: `0300${String(1000000 + n)}`, area: "dha", address: "House 1", date: "2026-10-20", window: "5–7 pm", payment: "cash", items: [wax], ...over }, cat)

const step = (id: string, type: Job["events"][number]["type"], extra: Partial<Job> = {}) =>
  mutateJob(db, id, (j) => {
    if (!canApply(j.status, type)) throw new Error(`Can't ${type} while ${j.status}`)
    j.events.push({ type, at: new Date().toISOString(), by: type === "assigned" ? "ops" : "pro", actor: "test" })
    const next = STATUS_FOR[type]
    if (next) j.status = next
    Object.assign(j, extra)
  })

/** The whole visit: assign → on the way → check in → check out → done, with the payment the pro recorded. */
async function visit(proId: string, pay: Job["paymentRecord"] | "cash" = "cash", over: Partial<NewBooking> = {}) {
  const b = await book(over)
  await mutateJob(db, b.id, (j) => {
    j.proId = proId
    j.status = "assigned"
    j.events.push({ type: "assigned", at: new Date().toISOString(), by: "ops", actor: "dispatch@mjazo.test", note: proId })
  })
  await step(b.id, "en_route")
  await step(b.id, "checked_in")
  await step(b.id, "checked_out")
  const record = pay === "cash" ? { amount: b.total, method: "cash" as const, at: new Date().toISOString(), status: "cash" as const } : pay
  await step(b.id, "completed", { paymentRecord: record })
  return b
}

/** Every journal entry sums to zero, and the whole ledger balances. */
async function booksBalance() {
  const off = await db.query("select entry_id from postings group by entry_id having sum(amount) <> 0")
  expect(off).toEqual([])
  expect((await trialBalance(db)).balanced).toBe(true)
}

beforeAll(async () => {
  db = await testCore()
  for (const [id, phone] of [
    ["P-CASH", "03111111111"],
    ["P-DIGI", "03122222222"],
    ["P-OTHER", "03133333333"],
  ])
    await savePro(db, { id, name: id, phone, area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
}, 60_000)
afterAll(() => db?.close())

describe("a visit from assignment to cash held", () => {
  it("records the cash with the pro and what she earned, and the books balance", async () => {
    const b = await visit("P-CASH")
    expect(b.total).toBe(6100)
    expect(await proBalances(db, "P-CASH")).toEqual({ cashHeld: 6100, payable: 4575 })
    expect(await bookingPaid(db, b.id)).toEqual({ paid: 6100, refunded: 0 })
    const events = await db.query<{ actor: string | null }>("select actor from booking_events where booking_id = $1 order by id", [b.id])
    expect(events[0].actor).toBe("dispatch@mjazo.test")
    await booksBalance()
  })
})

describe("payout runs", () => {
  it("nets cash held against what she's owed", () => {
    expect(settlement(4575, 6100)).toEqual({ netted: 4575, amount: -1525 })
    expect(settlement(4575, 0)).toEqual({ netted: 0, amount: 4575 })
    expect(settlement(3000, 1000)).toEqual({ netted: 1000, amount: 2000 })
  })

  it("goes draft → approved (by a second person) → paid with a reference, and settles to zero", async () => {
    await visit("P-DIGI", { amount: 6100, method: "jazzcash", at: new Date().toISOString(), status: "matched" })
    const run = await draftPayoutRun(db, { periodStart: "2026-10-01", periodEnd: "2099-12-31", by: FIN.email })
    expect(run.status).toBe("draft")
    const cash = run.payouts.find((p) => p.proId === "P-CASH")!
    const digi = run.payouts.find((p) => p.proId === "P-DIGI")!
    expect(cash).toMatchObject({ earned: 4575, cashHeld: 6100, netted: 4575, amount: -1525, status: "draft" })
    expect(digi).toMatchObject({ earned: 4575, cashHeld: 0, netted: 0, amount: 4575 })
    expect(run.payouts.some((p) => p.proId === "P-OTHER")).toBe(false)

    // Only one open run at a time, so the same balance is never paid twice.
    await expect(draftPayoutRun(db, { periodStart: "2026-10-01", periodEnd: "2099-12-31", by: FIN2.email })).rejects.toThrow(/still open/)
    // Not paid before it's approved, and not approved by whoever drafted it.
    await expect(payPayout(db, digi.id, { reference: "TRX-1", by: FIN2.email })).rejects.toThrow(/approved first/)
    await expect(approvePayoutRun(db, run.id, FIN)).rejects.toThrow(/you drafted it/)
    const approved = await approvePayoutRun(db, run.id, FIN2)
    expect(approved).toMatchObject({ status: "approved", approvedBy: FIN2.email })

    await expect(payPayout(db, digi.id, { reference: " ", by: FIN.email })).rejects.toThrow(/transfer reference/)
    await payPayout(db, digi.id, { reference: "TRX-1", by: FIN.email })
    await expect(payPayout(db, digi.id, { reference: "TRX-1", by: FIN.email })).rejects.toThrow(/paid/)
    const done = await payPayout(db, cash.id, { reference: "RCPT-7", by: FIN.email })
    expect(done.status).toBe("paid")
    expect(await proBalances(db, "P-CASH")).toEqual({ cashHeld: 0, payable: 0 })
    expect(await proBalances(db, "P-DIGI")).toEqual({ cashHeld: 0, payable: 0 })
    const entries = await db.query<{ kind: string; actor: string; memo: string }>("select kind, actor, memo from journal_entries where kind = 'payout' order by id")
    expect(entries).toEqual([
      { kind: "payout", actor: FIN.email, memo: "TRX-1" },
      { kind: "payout", actor: FIN.email, memo: "RCPT-7" },
    ])
    const log = await db.query<{ action: string }>("select action from audit_log order by id")
    expect(log.map((l) => l.action)).toEqual(expect.arrayContaining(["drafted a payout run", "approved a payout run", "paid a payout", "collected cash for a payout"]))
    await booksBalance()
  })

  it("never pays the same balance twice", async () => {
    await expect(draftPayoutRun(db, { periodStart: "2026-10-01", periodEnd: "2099-12-31", by: FIN.email })).rejects.toThrow(/Nobody is owed/)
    // Runs only move forward: an earlier cut-off would see visits before the payouts that settled them.
    await expect(draftPayoutRun(db, { periodStart: "2026-01-01", periodEnd: "2026-01-31", by: FIN.email })).rejects.toThrow(/pick a later period/)
  })

  it("refuses to pay when her balances dropped since the draft, and a cancelled run can be drafted again", async () => {
    await visit("P-OTHER")
    const run = await draftPayoutRun(db, { periodStart: "2099-11-01", periodEnd: "2099-12-31", by: OWNER.email })
    await approvePayoutRun(db, run.id, OWNER) // an Owner may approve their own
    await recordCashIn(db, { proId: "P-OTHER", amount: 6100, reference: "Handed in at the office", by: FIN.email })
    await expect(payPayout(db, run.payouts[0].id, { reference: "RCPT-9", by: FIN.email })).rejects.toThrow(/balances changed/)
    await cancelPayoutRun(db, run.id, FIN.email)
    const again = await draftPayoutRun(db, { periodStart: "2099-11-01", periodEnd: "2099-12-31", by: FIN.email })
    expect(again.payouts[0]).toMatchObject({ proId: "P-OTHER", earned: 4575, cashHeld: 0, amount: 4575 })
    await approvePayoutRun(db, again.id, FIN2)
    await payPayout(db, again.payouts[0].id, { reference: "TRX-2", by: FIN2.email })
    expect(await proBalances(db, "P-OTHER")).toEqual({ cashHeld: 0, payable: 0 })
    await booksBalance()
  })

  it("only records cash handed in up to what she holds", async () => {
    await expect(recordCashIn(db, { proId: "P-OTHER", amount: 1, by: FIN.email })).rejects.toThrow(/holding PKR 0/)
    await expect(recordCashIn(db, { proId: "P-OTHER", amount: 0, by: FIN.email })).rejects.toThrow(/whole rupees/)
  })
})

describe("refunds and credits", () => {
  it("are asked for, approved by a second person, then posted once", async () => {
    const b = await visit("P-CASH")
    await expect(requestMoney(db, { kind: "refund", bookingId: b.id, amount: 7000, reason: "Too much", by: "support@mjazo.test" })).rejects.toThrow(/At most PKR 6,100/)
    await expect(requestMoney(db, { kind: "refund", bookingId: b.id, amount: 500, reason: "x", by: "support@mjazo.test" })).rejects.toThrow(/Say why/)
    const r = await requestMoney(db, { kind: "refund", bookingId: b.id, amount: 1000, reason: "Late by an hour", by: "support@mjazo.test" })
    expect(r.status).toBe("pending")
    // Nothing moves until it's approved.
    expect((await bookingPaid(db, b.id)).refunded).toBe(0)
    // Waiting refunds count against what's left.
    await expect(requestMoney(db, { kind: "refund", bookingId: b.id, amount: 5101, reason: "And the rest", by: "support@mjazo.test" })).rejects.toThrow(/At most PKR 5,100/)

    await expect(decideMoney(db, r.id, { approve: true, by: { email: "support@mjazo.test", role: "support" }, reference: "R1" })).rejects.toThrow(/Someone else/)
    await expect(decideMoney(db, r.id, { approve: true, by: FIN })).rejects.toThrow(/transfer reference/)
    const ok = await decideMoney(db, r.id, { approve: true, by: FIN, reference: "JC-REF-1" })
    expect(ok).toMatchObject({ status: "approved", decidedBy: FIN.email, reference: "JC-REF-1" })
    expect(ok.entryId).toBeGreaterThan(0)
    await expect(decideMoney(db, r.id, { approve: true, by: FIN, reference: "again" })).rejects.toThrow(/already approved/)
    expect(await bookingPaid(db, b.id)).toEqual({ paid: 6100, refunded: 1000 })
    expect((await db.one<{ n: number }>("select count(*)::int as n from journal_entries where idempotency_key = $1", [`refund:${r.id}`]))!.n).toBe(1)

    const c = await requestMoney(db, { kind: "credit", bookingId: b.id, amount: 500, reason: "Sorry for the wait", by: "support@mjazo.test" })
    const rejected = await requestMoney(db, { kind: "credit", bookingId: b.id, amount: 300, reason: "Duplicate", by: "support@mjazo.test" })
    await decideMoney(db, rejected.id, { approve: false, by: FIN, note: "Already credited" })
    await decideMoney(db, c.id, { approve: true, by: FIN })
    const customerId = (await db.one<{ customer_id: string }>("select customer_id from bookings where id = $1", [b.id]))!.customer_id
    expect(await customerBalances(db, customerId)).toEqual({ owes: 0, credit: 500 })
    expect((await listMoneyRequests(db, { bookingId: b.id })).map((x) => x.status).sort()).toEqual(["approved", "approved", "rejected"])
    const log = await db.query<{ actor: string; action: string }>("select actor, action from audit_log where target = $1 order by id", [b.id])
    expect(log).toEqual(expect.arrayContaining([{ actor: "support@mjazo.test", action: "asked for a refund" }, { actor: FIN.email, action: "approved a refund" }, { actor: FIN.email, action: "rejected a credit" }]))
    await booksBalance()
  })

  it("won't refund a booking nothing was paid for", async () => {
    const b = await book()
    await expect(requestMoney(db, { kind: "refund", bookingId: b.id, amount: 100, reason: "Cancelled late", by: "support@mjazo.test" })).rejects.toThrow(/Nothing paid/)
  })
})
