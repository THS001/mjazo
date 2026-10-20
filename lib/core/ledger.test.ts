import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { ACC, LedgerError, applyCredit, balance, cashHandedIn, customerBalances, issueCredit, payoutSettled, post, proBalances, proStatement, refundPaid, settlePayment, trialBalance, visitCompleted } from "./ledger"

let db: Db & { close(): Promise<void> }

async function seed(id: string, subtotal: number, discount = 0) {
  await db.query("insert into customers (id, phone, name) values ($1, $2, 'Test') on conflict do nothing", [`C-${id}`, `0300${id.padStart(7, "0")}`])
  await db.query("insert into pros (id, name, phone, home_zone) values ($1, 'Pro', $2, 'dha') on conflict do nothing", [`P-${id}`, `0311${id.padStart(7, "0")}`])
  await db.query(
    `insert into bookings (id, customer_id, name, phone, zone, address, day, arrival_window, subtotal, discount, total, payment_method)
     values ($1, $2, 'Test', '03000000000', 'dha', 'House 1', '2026-10-22', '9 – 11 am', $3, $4, $5, 'cash')`,
    [`B-${id}`, `C-${id}`, subtotal, discount, subtotal - discount],
  )
  return { bookingId: `B-${id}`, customerId: `C-${id}`, proId: `P-${id}` }
}

beforeAll(async () => {
  db = await testCore()
}, 60_000)
afterAll(() => db?.close())

describe("posting", () => {
  it("refuses entries that don't balance or use fractions of a rupee", async () => {
    await expect(post(db, { kind: "x", postings: [{ account: ACC.bank, amount: 10 }, { account: ACC.commission, amount: -9 }] })).rejects.toThrow(LedgerError)
    await expect(post(db, { kind: "x", postings: [{ account: ACC.bank, amount: 10.5 }, { account: ACC.commission, amount: -10.5 }] })).rejects.toThrow(/whole rupees/)
    await expect(post(db, { kind: "x", postings: [{ account: "nope:1", amount: 10 }, { account: ACC.commission, amount: -10 }] })).rejects.toThrow(/Unknown ledger account/)
  })
})

describe("a visit from booking to payout", () => {
  it("splits a completed visit: the pro earns on the full price, Mjazo funds the discount", async () => {
    const b = await seed("1", 4000, 500)
    const id = await visitCompleted(db, { ...b, subtotal: 4000, discount: 500, total: 3500, commissionRate: 0.25 })
    expect(id).toBeTypeOf("number")
    expect(await customerBalances(db, b.customerId)).toEqual({ owes: 3500, credit: 0 })
    expect(await proBalances(db, b.proId)).toEqual({ cashHeld: 0, payable: 3000 })
    expect(-(await balance(db, ACC.commission))).toBe(1000)
    expect(await balance(db, ACC.discounts)).toBe(500)
    // Posting the same visit again does nothing.
    expect(await visitCompleted(db, { ...b, subtotal: 4000, discount: 500, total: 3500, commissionRate: 0.25 })).toBeNull()
    expect(await proBalances(db, b.proId)).toEqual({ cashHeld: 0, payable: 3000 })
  })

  it("records cash with the pro who collected it, and only posts corrections as differences", async () => {
    const b = { bookingId: "B-1", customerId: "C-1", proId: "P-1" }
    await settlePayment(db, { ...b, amount: 3500, method: "cash" })
    expect(await proBalances(db, b.proId)).toEqual({ cashHeld: 3500, payable: 3000 })
    expect((await customerBalances(db, b.customerId)).owes).toBe(0)
    expect(await settlePayment(db, { ...b, amount: 3500, method: "cash" })).toBeNull()
    // It turns out the customer paid by JazzCash into Mjazo's account instead.
    await settlePayment(db, { ...b, amount: 3500, method: "jazzcash" })
    expect((await proBalances(db, b.proId)).cashHeld).toBe(0)
    expect(await balance(db, ACC.bank)).toBe(3500)
    expect((await customerBalances(db, b.customerId)).owes).toBe(0)
    // Back to cash, and short by 100.
    await settlePayment(db, { ...b, amount: 3400, method: "cash" })
    expect((await proBalances(db, b.proId)).cashHeld).toBe(3400)
    expect(await balance(db, ACC.bank)).toBe(0)
    expect((await customerBalances(db, b.customerId)).owes).toBe(100)
  })

  it("nets the cash she holds against what she's owed at payout", async () => {
    // P-1 holds 3400 and is owed 3000: she hands in the extra 400.
    await payoutSettled(db, { payoutId: "PO-1", proId: "P-1", netted: 3000, amount: -400 })
    expect(await proBalances(db, "P-1")).toEqual({ cashHeld: 0, payable: 0 })
    expect(await balance(db, ACC.bank)).toBe(400)
    expect(await payoutSettled(db, { payoutId: "PO-1", proId: "P-1", netted: 3000, amount: -400 })).toBeNull()
  })

  it("pays out what's left when she holds less than she's owed", async () => {
    const b = await seed("2", 6000)
    await visitCompleted(db, { ...b, subtotal: 6000, discount: 0, total: 6000, commissionRate: 0.2 })
    await settlePayment(db, { ...b, amount: 6000, method: "easypaisa" })
    expect(await proBalances(db, b.proId)).toEqual({ cashHeld: 0, payable: 4800 })
    await payoutSettled(db, { payoutId: "PO-2", proId: b.proId, netted: 0, amount: 4800 })
    expect(await proBalances(db, b.proId)).toEqual({ cashHeld: 0, payable: 0 })
  })

  it("lets a pro hand cash in between payouts", async () => {
    const b = await seed("3", 2500)
    await visitCompleted(db, { ...b, subtotal: 2500, discount: 0, total: 2500, commissionRate: 0.25 })
    await settlePayment(db, { ...b, amount: 2500, method: "cash" })
    await cashHandedIn(db, { proId: b.proId, amount: 2000, reference: "deposit slip 44" })
    expect(await proBalances(db, b.proId)).toEqual({ cashHeld: 500, payable: 1875 })
    const lines = await proStatement(db, b.proId)
    expect(lines.map((l) => l.kind)).toEqual(["cash_handed_in", "payment", "visit_completed"])
    expect(lines.find((l) => l.kind === "visit_completed")?.earned).toBe(1875)
  })
})

describe("credits and refunds", () => {
  it("issues credit, applies it to a booking, and never more than is available", async () => {
    const b = await seed("4", 3000)
    await visitCompleted(db, { ...b, subtotal: 3000, discount: 0, total: 3000, commissionRate: 0.25 })
    await issueCredit(db, { customerId: b.customerId, amount: 500, reason: "Late arrival" })
    expect(await customerBalances(db, b.customerId)).toEqual({ owes: 3000, credit: 500 })
    await expect(applyCredit(db, { customerId: b.customerId, bookingId: b.bookingId, amount: 600 })).rejects.toThrow(/Only PKR 500/)
    await applyCredit(db, { customerId: b.customerId, bookingId: b.bookingId, amount: 500 })
    expect(await customerBalances(db, b.customerId)).toEqual({ owes: 2500, credit: 0 })
  })

  it("records a refund as money out of Mjazo's accounts", async () => {
    const before = await balance(db, ACC.bank)
    await refundPaid(db, { customerId: "C-4", bookingId: "B-4", amount: 200, reference: "JC 99812" })
    expect(await balance(db, ACC.bank)).toBe(before - 200)
    expect(await balance(db, ACC.refunds)).toBe(200)
  })
})

describe("the books always balance", () => {
  it("after every flow above, and after a random run of many more", async () => {
    expect((await trialBalance(db)).balanced).toBe(true)
    let seedN = 7
    const rand = (n: number) => (seedN = (seedN * 48271) % 2147483647) % n
    for (let i = 0; i < 25; i++) {
      const b = await seed(String(100 + i), 1000 + rand(20) * 250, rand(3) * 100)
      const row = await db.one<{ subtotal: number; discount: number; total: number }>("select subtotal, discount, total from bookings where id = $1", [b.bookingId])
      await visitCompleted(db, { ...b, ...row!, commissionRate: [0.2, 0.25][rand(2)] })
      const method = (["cash", "jazzcash", "easypaisa", "raast"] as const)[rand(4)]
      await settlePayment(db, { ...b, amount: row!.total - rand(2) * 50, method })
      const { cashHeld, payable } = await proBalances(db, b.proId)
      if (rand(2)) await payoutSettled(db, { payoutId: `PO-R${i}`, proId: b.proId, netted: Math.min(cashHeld, payable), amount: payable - cashHeld })
      if (rand(2)) await issueCredit(db, { customerId: b.customerId, amount: 100 + rand(5) * 50, reason: "test" })
    }
    expect((await trialBalance(db)).balanced).toBe(true)
  }, 60_000)
})
