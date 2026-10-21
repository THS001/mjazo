import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import type { Job } from "@/lib/ops/types"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { creditFor } from "./customers"
import { activatePlus, cancelGiftCard, cancelPlus, issueGiftCard, plusFor, redeemGiftCard, referralCode, referralCodeForPhone, referralSummary, requestPlus, rewardReferral } from "./growth"
import { createBooking, mutateJob, savePro, type NewBooking } from "./jobs"
import { balance, trialBalance } from "./ledger"
import { savePromo } from "./promos"
import { canApply, STATUS_FOR } from "./status"

// Mjazo Plus, gift cards and referral rewards on a real (in-memory) Postgres: the member's discount
// on bookings (one discount per booking), gift cards from sale to credit (once), referral codes and
// the referrer's credit when a friend's first visit is done (once). The books balance throughout.

const cat = buildCatalog(DEFAULT_CATALOG)
let db: Db & { close(): Promise<void> }
const OPS = "fin@mjazo.test"
const TERMS = { price: 2500, discountPct: 10 }
const wax = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: ["Rica (peel-off)"], addOns: ["Face wax"], qty: 1, unitPrice: 0 } // PKR 6,100
let n = 0
const book = (phone: string, over: Partial<NewBooking> = {}) => createBooking(db, { id: `MJ-G${++n}`, name: "Ayesha Khan", phone, area: "dha", address: "House 1, Street 2", date: "2099-03-01", window: "3–5 pm", payment: "cash", items: [wax], ...over }, cat, { referralOff: 500 })
const customerOf = async (bookingId: string) => (await db.one<{ customer_id: string }>("select customer_id from bookings where id = $1", [bookingId]))!.customer_id

async function booksBalance() {
  expect(await db.query("select entry_id from postings group by entry_id having sum(amount) <> 0")).toEqual([])
  expect((await trialBalance(db)).balanced).toBe(true)
}

/** The whole visit, through to done with the cash collected. */
async function complete(id: string) {
  await mutateJob(db, id, (j) => {
    j.proId = "P-ONE"
    j.status = "assigned"
    j.events.push({ type: "assigned", at: new Date().toISOString(), by: "ops", actor: OPS, note: "P-ONE" })
  })
  for (const type of ["en_route", "checked_in", "checked_out", "completed"] as Job["events"][number]["type"][])
    await mutateJob(db, id, (j) => {
      if (!canApply(j.status, type)) throw new Error(`Can't ${type} while ${j.status}`)
      j.events.push({ type, at: new Date().toISOString(), by: "pro", actor: "test" })
      j.status = STATUS_FOR[type]!
      if (type === "completed") j.paymentRecord = { amount: j.total - (j.credit ?? 0), method: "cash", at: new Date().toISOString(), status: "cash" }
    })
}

beforeAll(async () => {
  db = await testCore()
  await savePro(db, { id: "P-ONE", name: "Sana", phone: "03111111111", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
}, 60_000)
afterAll(() => db?.close())

describe("Mjazo Plus", () => {
  it("a request waits for the fee; once paid, a year of 10% off every booking, booked to the ledger", async () => {
    const first = await book("03002220001")
    const id = await customerOf(first.id)
    const req = await requestPlus(db, id, TERMS, `customer:${id}`)
    expect(req).toMatchObject({ status: "requested", price: 2500, discountPct: 10 })
    expect((await requestPlus(db, id, TERMS, `customer:${id}`)).id).toBe(req.id) // once at a time
    expect((await book("03002220001")).total).toBe(6100) // not yet
    const now = new Date("2026-10-21T10:00:00Z")
    const active = await activatePlus(db, { membershipId: req.id, terms: TERMS, paidVia: "jazzcash", reference: "TX1", by: OPS, now })
    expect(active).toMatchObject({ status: "active", startsAt: now.toISOString() })
    expect(Date.parse(active.endsAt!) - now.getTime()).toBe(365 * 86400_000)
    expect(await balance(db, "mjazo:plus")).toBe(-2500)
    const member = await book("03002220001")
    expect(member.total).toBe(5490)
    expect(await db.one("select discount, promo_code from bookings where id = $1", [member.id])).toEqual({ discount: 610, promo_code: "PLUS" })
    // A bigger promo code wins instead (never two discounts).
    await savePromo(db, { code: "BIG20", kind: "percent", value: 20 }, OPS, true)
    const promo = await book("03002220001", { promo: "BIG20" })
    expect(await db.one("select discount, promo_code from bookings where id = $1", [promo.id])).toEqual({ discount: 1220, promo_code: "BIG20" })
    // Renewing early adds a year to the end of the current one.
    await requestPlus(db, id, TERMS, OPS).catch(() => null)
    const renewed = await activatePlus(db, { phone: "0300 2220001", terms: TERMS, paidVia: "cash", by: OPS, now })
    expect(renewed.startsAt).toBe(active.endsAt)
    expect((await plusFor(db, id, now))?.endsAt).toBe(renewed.endsAt)
    await booksBalance()
  })

  it("adds a member by phone (even a new number), and a request can be cancelled", async () => {
    const p = await activatePlus(db, { phone: "03002220002", name: "Hina", terms: TERMS, paidVia: "bank", by: OPS })
    expect(p.status).toBe("active")
    expect(await db.one("select name from customers where phone = '03002220002'")).toEqual({ name: "Hina" })
    const b = await book("03002220003")
    const r = await requestPlus(db, await customerOf(b.id), TERMS, OPS)
    await cancelPlus(db, r.id, OPS, "Changed her mind")
    expect(await plusFor(db, await customerOf(b.id))).toBeNull()
    await expect(activatePlus(db, { membershipId: r.id, terms: TERMS, paidVia: "cash", by: OPS })).rejects.toThrow(/isn't waiting/)
  })
})

describe("gift cards", () => {
  it("sold → turned into credit once → spent at a booking; an unused one can be cancelled", async () => {
    const g = await issueGiftCard(db, { amount: 3000, buyerName: "Sara", buyerPhone: "03004440001", recipientName: "Amna", paidVia: "jazzcash", by: OPS })
    expect(g.code).toMatch(/^MJG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    expect(await balance(db, "mjazo:giftcards")).toBe(-3000)
    const b = await book("03004440002")
    const amna = await customerOf(b.id)
    // Typed loosely: lower case, no dashes.
    expect(await redeemGiftCard(db, amna, g.code.toLowerCase().replace(/-/g, " "))).toEqual({ code: g.code, amount: 3000 })
    expect((await creditFor(db, amna)).balance).toBe(3000)
    await expect(redeemGiftCard(db, amna, g.code)).rejects.toThrow(/already added/)
    const other = await customerOf((await book("03004440003")).id)
    await expect(redeemGiftCard(db, other, g.code)).rejects.toThrow(/already been used/)
    await expect(redeemGiftCard(db, other, "MJG-AAAA-BBBB")).rejects.toThrow(/isn't valid/)
    await expect(cancelGiftCard(db, g.code, OPS)).rejects.toThrow(/been used/)
    const spare = await issueGiftCard(db, { amount: 1000, paidVia: "cash", by: OPS })
    expect((await cancelGiftCard(db, spare.code, OPS, "Wrong amount")).status).toBe("cancelled")
    await expect(redeemGiftCard(db, other, spare.code)).rejects.toThrow(/isn't valid/)
    await expect(issueGiftCard(db, { amount: 100, paidVia: "cash", by: OPS })).rejects.toThrow(/500/)
    await booksBalance()
  })
})

describe("referrals", () => {
  it("makes one code per customer (NAME-1234), unique even for the same name and number ending", async () => {
    const a = await referralCodeForPhone(db, "Zainab Ali", "03005551234")
    expect(a).toBe("ZAINAB-1234")
    expect(await referralCodeForPhone(db, "Zainab", "03005551234")).toBe(a)
    const b = await referralCodeForPhone(db, "Zainab", "03115551234")
    expect(b).toMatch(/^ZAINAB-1234\d{1,2}$/)
    await expect(referralCodeForPhone(db, "Zainab", "12345")).rejects.toThrow(/mobile number/)
  })

  it("credits the referrer once when a friend's first visit with the code is done", async () => {
    const code = await referralCodeForPhone(db, "Maryam", "03006660001")
    const referrer = (await db.one<{ id: string }>("select id from customers where phone = '03006660001'"))!.id
    // The code typed in the promo box counts as the referral.
    const first = await book("03006660002", { promo: code.toLowerCase() })
    expect(await db.one("select discount, promo_code from bookings where id = $1", [first.id])).toEqual({ discount: 500, promo_code: `REF:${code}` })
    const friend = await customerOf(first.id)
    expect(await db.one("select referred_by from customers where id = $1", [friend])).toEqual({ referred_by: referrer })
    expect(await rewardReferral(db, first.id, 500)).toBeNull() // not done yet
    await complete(first.id)
    expect(await rewardReferral(db, first.id, 500)).toEqual({ referrerId: referrer, friendId: friend, amount: 500 })
    expect(await rewardReferral(db, first.id, 500)).toBeNull() // once
    expect((await creditFor(db, referrer)).balance).toBe(500)
    expect(await referralSummary(db, referrer)).toEqual({ friends: 1, rewarded: 1, earned: 500 })
    // The friend's next visit earns nothing more.
    const second = await book("03006660002")
    await complete(second.id)
    expect(await rewardReferral(db, second.id, 500)).toBeNull()
    // A signed-in customer without a number has no code yet.
    await db.query("insert into customers (id, name) values ('C-NOPHONE', 'No Phone')")
    expect(await referralCode(db, "C-NOPHONE")).toBeNull()
    await booksBalance()
  })
})
