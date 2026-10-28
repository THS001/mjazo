import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import type { Job } from "@/lib/ops/types"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { createBooking, getJob, importJobs, mutateJob, savePro, taxImported, type NewBooking } from "./jobs"
import { ACC, balance, proBalances, trialBalance } from "./ledger"
import { visitMargins } from "./pilot"
import { policy, savePolicy } from "./policy"
import { ensureReceipt, receiptByNo, receiptForBooking, receiptsInMonth, taxMonths } from "./receipts"
import { STATUS_FOR } from "./status"

// Receipts and sales tax on a real (in-memory) core database: the tax frozen on bookings made from
// its start day, inside the price or on top, on the whole booking or Mjazo's share; the ledger
// owing it to the SRB without touching the pro's share; and one gapless receipt per visit.

const cat = buildCatalog(DEFAULT_CATALOG)
const wax = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1 }
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 29 * 3600_000).toISOString().slice(0, 10)
let db: Db & { close(): Promise<void> }
let n = 0
let price = 0

const book = (o: Partial<NewBooking> = {}) => createBooking(db, { id: `MJ-TAX${++n}`, name: "Sara Ahmed", phone: "03005551111", area: "dha", address: "House 1", date: tomorrow, window: "11 am–1 pm", payment: "cash", items: [wax], ...o }, cat)
const finish = async (id: string, proId = "P-TX") => {
  await mutateJob(db, id, (j) => {
    j.proId = proId
    j.status = "assigned"
  })
  for (const type of ["en_route", "checked_in", "checked_out", "completed"] as Job["events"][number]["type"][])
    await mutateJob(db, id, (j) => {
      j.events.push({ type, at: new Date().toISOString(), by: "pro" })
      j.status = STATUS_FOR[type] ?? j.status
    })
  return (await getJob(db, id))!
}
const posted = async (bookingId: string) => {
  const rows = await db.query<{ account_id: string; amount: number }>("select p.account_id, p.amount from postings p join journal_entries e on e.id = p.entry_id where e.booking_id = $1 and e.kind = 'visit_completed'", [bookingId])
  return Object.fromEntries(rows.map((r) => [r.account_id, r.amount]))
}

beforeAll(async () => {
  db = await testCore()
  await savePro(db, { id: "P-TX", name: "Hina Baloch", phone: "03117770001", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString(), commissionRate: 0.25 })
  await savePro(db, { id: "P-TX2", name: "Rabia", phone: "03117770002", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
  await db.query("update pros set commission_rate = 0.2 where id = 'P-TX2'") // savePro leaves the rate to mission control
  // Every visit here is the same customer with the same pro: keep her usual share (lib/core/pairs.test.ts covers the regular rate).
  await savePolicy(db, "pair_rate", { on: false }, "finance@mjazo.test")
  price = (await book()).total
}, 60_000)
afterAll(() => db?.close())

describe("sales tax", () => {
  it("is off until Finance sets a rate and a start day; bookings before that day carry none", async () => {
    expect(await policy(db, "tax")).toMatchObject({ from: null, rate: 0 })
    expect((await book()).tax).toBeUndefined()
    await savePolicy(db, "tax", { from: tomorrow, rate: 0.08 }, "finance@mjazo.test")
    expect((await book()).tax).toBeUndefined() // made today, before the start day
    await expect(savePolicy(db, "tax", { rate: 0.4 }, "x")).rejects.toThrow("between 0% and 25%")
    const audit = await db.one<{ action: string }>("select action from audit_log where target = 'tax' order by id desc limit 1")
    expect(audit?.action).toBe("changed the sales tax policy")
  })

  it("inside the price: the total stays, Mjazo's share pays it, the pro's share doesn't change", async () => {
    await savePolicy(db, "tax", { from: today, rate: 0.08, inclusive: true, base: "total" }, "finance@mjazo.test")
    const b = await book()
    const tax = Math.round((price * 0.08) / 1.08)
    expect(b.total).toBe(price)
    expect(b.tax).toEqual({ amount: tax, rate: 0.08, inclusive: true, base: "total" })
    const before = (await proBalances(db, "P-TX")).payable
    await finish(b.id)
    expect((await proBalances(db, "P-TX")).payable - before).toBe(Math.round(price * 0.75))
    expect(await posted(b.id)).toMatchObject({ [ACC.salesTax]: -tax, [ACC.commission]: -(price - Math.round(price * 0.75) - tax) })
    expect((await visitMargins(db, [b.id])).get(b.id)).toBe(price - Math.round(price * 0.75) - tax)
    expect((await trialBalance(db)).balanced).toBe(true)
  })

  it("on top: the customer's total carries it and the commission is untouched", async () => {
    await savePolicy(db, "tax", { inclusive: false }, "finance@mjazo.test")
    const b = await book()
    const tax = Math.round(price * 0.08)
    expect(b.total).toBe(price + tax)
    await finish(b.id)
    expect(await posted(b.id)).toMatchObject({ [`cust:${(await db.one<{ customer_id: string }>("select customer_id from bookings where id = $1", [b.id]))!.customer_id}:ar`]: price + tax, [ACC.salesTax]: -tax, [ACC.commission]: -(price - Math.round(price * 0.75)) })
    expect((await trialBalance(db)).balanced).toBe(true)
  })

  it("follows a change to the services, on top as well", async () => {
    const b = await book()
    const after = await mutateJob(db, b.id, (j) => {
      j.items = [{ ...j.items[0], qty: 2 }]
    })
    expect(after!.tax!.amount).toBe(Math.round(price * 2 * 0.08))
    expect(after!.total).toBe(price * 2 + Math.round(price * 2 * 0.08))
    expect((await getJob(db, b.id))!.total).toBe(after!.total)
  })

  it("on Mjazo's share only: worked out again on the real share once a pro does it", async () => {
    await savePolicy(db, "tax", { base: "commission" }, "finance@mjazo.test")
    const b = await book()
    expect(b.tax).toMatchObject({ inclusive: true, base: "commission", amount: Math.round((Math.round(price * 0.25) * 0.08) / 1.08) })
    const done = await finish(b.id, "P-TX2") // Rabia's rate is 20%
    const share = price - Math.round(price * 0.8)
    expect(done.tax!.amount).toBe(Math.round((share * 0.08) / 1.08))
    expect((await posted(b.id))[ACC.salesTax]).toBe(-done.tax!.amount)
    await savePolicy(db, "tax", { from: null }, "finance@mjazo.test")
    expect((await book()).tax).toBeUndefined()
  })
})

describe("receipts", () => {
  it("are issued once per visit, numbered without gaps, with what was charged frozen", async () => {
    const rows = await db.query<{ no: number; booking_id: string }>("select no, booking_id from receipts order by no")
    expect(rows.map((r) => r.no)).toEqual([1, 2, 3])
    const r = (await receiptByNo(db, 1))!
    expect(r.number).toBe("MJR-000001")
    expect(r.data).toMatchObject({ customer: { name: "Sara Ahmed", area: "dha" }, pro: "Hina", lines: [{ name: "Full body waxing", qty: 1 }], subtotal: price, discount: 0, credit: 0, pack: null, registration: "" })
    expect(r.data.tax).toMatchObject({ rate: 0.08, inclusive: true, base: "total", taxable: price - r.tax })
    const onTop = (await receiptByNo(db, 2))!
    expect(onTop.data.tax).toMatchObject({ inclusive: false, taxable: price })
    expect(onTop.total).toBe(price + onTop.tax)
    // Asking again gives the same receipt.
    const job = (await getJob(db, r.bookingId))!
    expect((await ensureReceipt(db, job))!.no).toBe(1)
    expect((await receiptForBooking(db, r.bookingId))!.no).toBe(1)
    // A visit that isn't done has none.
    expect(await ensureReceipt(db, (await book())!)).toBeNull()
  })

  it("prints the registration once it's set, and add up by month for the SRB return", async () => {
    await savePolicy(db, "tax", { registration: "S1234567-8" }, "finance@mjazo.test")
    const b = await finish((await book()).id)
    expect((await receiptForBooking(db, b.id))!.data.registration).toBe("S1234567-8")
    const [month] = await taxMonths(db)
    const all = await receiptsInMonth(db, month.month)
    expect(month).toMatchObject({ receipts: all.length, tax: all.reduce((s, r) => s + r.tax, 0), total: all.reduce((s, r) => s + r.total, 0) })
    expect(month.taxable).toBe(all.reduce((s, r) => s + (r.data.tax?.taxable ?? 0), 0))
    expect(await balance(db, ACC.salesTax)).toBe(-all.reduce((s, r) => s + r.tax, 0))
    expect(await receiptsInMonth(db, "not a month")).toEqual([])
  })

  it("gives a booking imported at the prices its customer saw the tax of its day, so it can still be done", async () => {
    await savePolicy(db, "tax", { from: today, rate: 0.08, inclusive: false, base: "total" }, "finance@mjazo.test")
    // The catch-up's fallback: the browser's total, with a PKR 450 discount and the tax on top in it.
    const shown = price - 450 + Math.round((price - 450) * 0.08)
    const b = (await getJob(db, (await book()).id))!
    await importJobs(db, [{ ...b, id: "MJ-IMPORT1", total: shown, tax: undefined, credit: undefined, events: [], status: "new", proId: undefined }])
    await taxImported(db, "MJ-IMPORT1", new Date())
    expect((await getJob(db, "MJ-IMPORT1"))!.tax).toMatchObject({ inclusive: false, amount: Math.round((price - 450) * 0.08) })
    await finish("MJ-IMPORT1")
    expect(await posted("MJ-IMPORT1")).toMatchObject({ [ACC.discounts]: 450, [ACC.salesTax]: -Math.round((price - 450) * 0.08) })
    expect((await trialBalance(db)).balanced).toBe(true)
    await savePolicy(db, "tax", { from: null }, "finance@mjazo.test")
  })
})
