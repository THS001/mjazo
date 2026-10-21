import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { createBooking, getJob, mutateJob, savePro } from "./jobs"
import { creditFor, deleteAddress, linkAccount, listAddresses, saveAddress } from "./customers"
import { customerBalances, issueCredit, trialBalance } from "./ledger"
import { checkPromo, savePromo } from "./promos"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import { zoneFor } from "@/lib/geo"

// The client account in the core: joining an account to a phone number (with proof when the
// number already has bookings), saved addresses and the area of a map pin, promo codes at booking
// (one discount per booking, uses and limits), wallet credit (set aside, then taken from the
// ledger when the visit is done) and "book her again".

let db: Db & { close(): Promise<void> }
const cat = buildCatalog(DEFAULT_CATALOG)
const AREAS = cat.areas.map((a) => a.slug)
const U1 = "11111111-1111-4111-8111-111111111111"
const U2 = "22222222-2222-4222-8222-222222222222"
const U3 = "33333333-3333-4333-8333-333333333333"
let n = 0
const item = { name: "x", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1 }
const book = (phone: string, extra: Partial<Parameters<typeof createBooking>[1]> = {}, rules = { referralOff: 500 }) =>
  createBooking(db, { id: `MJ-CU${++n}`, name: "Ayesha", phone, area: "dha", address: "House 1, Street 2", date: "2099-02-01", window: "3–5 pm", payment: "cash", items: [item], ...extra }, cat, rules)

beforeAll(async () => {
  db = await testCore()
  await savePro(db, { id: "P-1", name: "Sana Bibi", phone: "03111111111", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
}, 60_000)
afterAll(() => db?.close())

describe("joining an account to a phone number", () => {
  it("starts a new customer for a number nobody has used", async () => {
    const c = await linkAccount(db, { userId: U1, email: "Ayesha@Example.com", name: "Ayesha", phone: "0300 1110001" })
    expect(c).toMatchObject({ phone: "03001110001", email: "ayesha@example.com", name: "Ayesha" })
    expect((await linkAccount(db, { userId: U1, email: "ayesha@example.com", name: "Ayesha", phone: "03001110001" })).id).toBe(c.id)
  })

  it("refuses a number that's on another account, and a second number for the same account", async () => {
    await expect(linkAccount(db, { userId: U2, email: "b@example.com", name: "B", phone: "03001110001" })).rejects.toMatchObject({ code: "taken" })
    await expect(linkAccount(db, { userId: U1, email: "ayesha@example.com", name: "Ayesha", phone: "03001110009" })).rejects.toMatchObject({ code: "hasPhone" })
    await expect(linkAccount(db, { userId: U2, email: "b@example.com", name: "B", phone: "12345" })).rejects.toMatchObject({ code: "phone" })
  })

  it("asks for proof when the number already has bookings, and accepts a booking number from it", async () => {
    const b = await book("03001110002")
    await expect(linkAccount(db, { userId: U2, email: "b@example.com", name: "B", phone: "03001110002" })).rejects.toMatchObject({ code: "proof" })
    await expect(linkAccount(db, { userId: U2, email: "b@example.com", name: "B", phone: "03001110002", proof: ["MJ-NOT-HERS"] })).rejects.toMatchObject({ code: "proof" })
    const c = await linkAccount(db, { userId: U2, email: "b@example.com", name: "B", phone: "03001110002", proof: [b.id.toLowerCase()] })
    const row = await db.one<{ auth_user_id: string; customer_id: string }>("select c.auth_user_id, b.customer_id from customers c join bookings b on b.customer_id = c.id where b.id = $1", [b.id])
    expect(row).toEqual({ auth_user_id: U2, customer_id: c.id })
  })
})

describe("saved addresses", () => {
  it("finds the area from the map pin, and refuses a pin outside the areas we cover", () => {
    expect(zoneFor(24.8, 67.065)).toBe("dha")
    expect(zoneFor(24.82, 67.03)).toBe("clifton")
    expect(zoneFor(25.4, 68.3)).toBeNull()
  })

  it("saves addresses (the first is the default), changes and deletes them", async () => {
    const c = (await db.one<{ id: string }>("select id from customers where auth_user_id = $1", [U1]))!.id
    const home = await saveAddress(db, c, { label: "Home", line: "House 12, Street 9, Phase 6", lat: 24.796, lng: 67.06 }, AREAS)
    expect(home).toMatchObject({ area: "dha", isDefault: true, lat: 24.796 })
    const work = await saveAddress(db, c, { label: "Office", area: "clifton", line: "Office 3, Block 5" }, AREAS)
    expect(work).toMatchObject({ area: "clifton", isDefault: false, lat: null })
    await expect(saveAddress(db, c, { line: "Somewhere far", lat: 25.4, lng: 68.3 }, AREAS)).rejects.toThrow(/Karachi|cover/)
    await expect(saveAddress(db, c, { line: "No area here" }, AREAS)).rejects.toThrow(/area/)
    await saveAddress(db, c, { ...work, id: work.id, isDefault: true }, AREAS)
    expect((await listAddresses(db, c)).map((a) => [a.label, a.isDefault])).toEqual([["Office", true], ["Home", false]])
    await deleteAddress(db, c, work.id)
    expect((await listAddresses(db, c)).map((a) => [a.label, a.isDefault])).toEqual([["Home", true]])
    // Someone else's address can't be touched.
    const other = (await db.one<{ id: string }>("select id from customers where auth_user_id = $1", [U2]))!.id
    await expect(deleteAddress(db, other, home.id)).rejects.toThrow(/not found/)
  })
})

describe("promo codes at booking", () => {
  beforeAll(async () => {
    await savePromo(db, { code: "WELCOME20", kind: "percent", value: 20, perCustomer: 1 }, "finance@mjazo.test", true)
    await savePromo(db, { code: "BIG1000", kind: "fixed", value: 1000, minOrder: 99999 }, "finance@mjazo.test", true)
    await savePromo(db, { code: "ONCE", kind: "fixed", value: 300, maxUses: 1, perCustomer: 5 }, "finance@mjazo.test", true)
    await savePromo(db, { code: "OLD", kind: "fixed", value: 300, endsAt: "2001-01-01T00:00:00Z", startsAt: "2000-01-01T00:00:00Z" }, "finance@mjazo.test", true)
  })

  it("says why a code can't be used", async () => {
    expect(await checkPromo(db, "nope", { subtotal: 5000 })).toMatchObject({ ok: false, problem: "invalid" })
    expect(await checkPromo(db, "big1000", { subtotal: 5000 })).toMatchObject({ ok: false, problem: "minOrder", minOrder: 99999 })
    expect(await checkPromo(db, "OLD", { subtotal: 5000 })).toMatchObject({ ok: false, problem: "expired" })
    expect(await checkPromo(db, " welcome20 ", { subtotal: 5000 })).toEqual({ ok: true, code: "WELCOME20", discount: 1000 })
  })

  it("takes it off the booking and records the use; a customer can't use it twice", async () => {
    const j = await book("03001110003", { promo: "welcome20" })
    const row = (await db.one<{ subtotal: number; discount: number; total: number; promo_code: string }>("select subtotal, discount, total, promo_code from bookings where id = $1", [j.id]))!
    expect(row).toMatchObject({ discount: Math.round(row.subtotal * 0.2), promo_code: "WELCOME20" })
    expect(row.total).toBe(row.subtotal - row.discount)
    expect((await db.one<{ amount: number }>("select amount from promo_redemptions where booking_id = $1", [j.id]))!.amount).toBe(row.discount)
    await expect(book("03001110003", { promo: "WELCOME20" })).rejects.toMatchObject({ problem: "used" })
    // Cancelling the booking frees the use.
    await mutateJob(db, j.id, (x) => void (x.status = "cancelled"))
    expect((await book("03001110003", { promo: "WELCOME20" })).total).toBe(row.total)
  })

  it("stops a code at its total uses", async () => {
    await book("03001110004", { promo: "ONCE" })
    await expect(book("03001110005", { promo: "ONCE" })).rejects.toMatchObject({ problem: "usedUp" })
  })

  it("gives one discount per booking: the larger of the friend's referral and the code", async () => {
    // A new number with a referral: PKR 500 off, larger than ONCE's 300 (which is used up anyway) → referral wins over a smaller code.
    await savePromo(db, { code: "SMALL100", kind: "fixed", value: 100 }, "f", true)
    const a = await book("03001110006", { referral: "FRIEND", promo: "SMALL100" })
    expect((await db.one<{ discount: number; promo_code: string }>("select discount, promo_code from bookings where id = $1", [a.id]))).toEqual({ discount: 500, promo_code: "REF:FRIEND" })
    expect(await db.one("select 1 from promo_redemptions where booking_id = $1", [a.id])).toBeNull()
    const b = await book("03001110007", { referral: "FRIEND", promo: "WELCOME20" })
    const r = (await db.one<{ subtotal: number; discount: number; promo_code: string }>("select subtotal, discount, promo_code from bookings where id = $1", [b.id]))!
    expect(r.promo_code).toBe(Math.round(r.subtotal * 0.2) >= 500 ? "WELCOME20" : "REF:FRIEND")
  })
})

describe("wallet credit", () => {
  it("is set aside at booking, taken from the ledger when the visit is done, and the pro collects the rest", async () => {
    const c = await linkAccount(db, { userId: U3, email: "c@example.com", name: "Cee", phone: "03001110008" })
    await issueCredit(db, { customerId: c.id, amount: 700, reason: "Late pro" })
    expect(await creditFor(db, c.id)).toEqual({ balance: 700, available: 700 })
    // Without signing in (no customerId), credit can't be used.
    const guest = await book("03001110008", { useCredit: true })
    expect(guest.credit).toBeUndefined()
    await mutateJob(db, guest.id, (x) => void (x.status = "cancelled"))
    const j = await book("03001110008", { useCredit: true, customerId: c.id, preferredProId: "P-1", lat: 24.796, lng: 67.06 })
    expect(j).toMatchObject({ credit: 700, preferredProId: "P-1", lat: 24.796, lng: 67.06 })
    expect(await creditFor(db, c.id)).toEqual({ balance: 700, available: 0 })
    // The visit: assigned, done, and the pro collects total − credit in cash.
    const due = j.total - 700
    await mutateJob(db, j.id, (x) => Object.assign(x, { proId: "P-1", status: "completed", paymentRecord: { amount: due, method: "cash", at: new Date().toISOString(), status: "cash" } }))
    expect(await customerBalances(db, c.id)).toEqual({ owes: 0, credit: 0 })
    expect(await creditFor(db, c.id)).toEqual({ balance: 0, available: 0 })
    expect((await trialBalance(db)).balanced).toBe(true)
    expect((await getJob(db, j.id))!.credit).toBe(700)
  })

  it("never sets aside more than the booking's total, and a cancelled booking gives it back", async () => {
    const c = (await db.one<{ id: string }>("select id from customers where auth_user_id = $1", [U3]))!.id
    await issueCredit(db, { customerId: c, amount: 99999, reason: "Big goodwill" })
    const j = await book("03001110008", { useCredit: true, customerId: c })
    expect(j.credit).toBe(j.total)
    expect((await creditFor(db, c)).available).toBe(99999 - j.total)
    await mutateJob(db, j.id, (x) => void (x.status = "cancelled"))
    expect((await creditFor(db, c)).available).toBe(99999)
  })

  it("ignores a requested pro who doesn't exist", async () => {
    const j = await book("03001110010", { preferredProId: "P-NOBODY" })
    expect(j.preferredProId).toBeUndefined()
  })
})
