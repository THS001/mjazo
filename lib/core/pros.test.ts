import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { getProRow, listPros, savePro } from "./jobs"
import { ensureZones, listZones, profileIssues, setProProfile, setVerification, setZoneCap, zoneCaps } from "./pros"
import { listPromos, promoDiscount, promoIssues, savePromo } from "./promos"
import { isVerified, VERIFICATION_ITEMS } from "@/lib/ops/types"

// Pros' profiles (zones, cap, weekly windows, days off), the verification checklist (no CNIC
// online: only who, when and the last 4 digits), zone caps, and promo codes.

let db: Db & { close(): Promise<void> }
const AREAS = ["dha", "clifton", "pechs"]

beforeAll(async () => {
  db = await testCore()
  await savePro(db, { id: "P-1", name: "Sana", phone: "03111111111", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
}, 60_000)
afterAll(() => db?.close())

describe("a pro's schedule", () => {
  it("starts with no limits", async () => {
    const p = (await getProRow(db, "P-1"))!
    expect(p).toMatchObject({ dailyCap: 5, commissionRate: 0.25 })
    expect(p.zones).toBeUndefined()
    expect(p.availability).toBeUndefined()
    expect(p.verification).toBeUndefined()
  })

  it("saves zones, cap, weekly windows and days off, and the older pro form doesn't wipe them", async () => {
    await setProProfile(db, "P-1", { zones: ["clifton", "clifton"], dailyCap: 3, commissionRate: 0.2, availability: { "1": ["5–7 pm", "9–11 am"], "3": ["9–11 am"] }, timeOff: { add: ["2099-01-02", "2099-01-03"] } }, AREAS)
    await setProProfile(db, "P-1", { timeOff: { remove: ["2099-01-03"] } }, AREAS)
    const p = (await listPros(db))[0]
    expect(p).toMatchObject({ zones: ["clifton"], dailyCap: 3, commissionRate: 0.2, availability: { "1": ["9–11 am", "5–7 pm"], "3": ["9–11 am"] }, timeOff: ["2099-01-02"] })
    await savePro(db, { ...p, name: "Sana B" })
    expect((await getProRow(db, "P-1"))!).toMatchObject({ name: "Sana B", zones: ["clifton"], dailyCap: 3 })
    await setProProfile(db, "P-1", { availability: null }, AREAS)
    expect((await getProRow(db, "P-1"))!.availability).toBeUndefined()
  })

  it("refuses values that don't make sense", () => {
    expect(profileIssues({ zones: ["mars"] }, AREAS)).toEqual(["Pick areas from the list"])
    expect(profileIssues({ dailyCap: 0 }, AREAS)).toHaveLength(1)
    expect(profileIssues({ dailyCap: 2.5 }, AREAS)).toHaveLength(1)
    expect(profileIssues({ commissionRate: 0.6 }, AREAS)).toHaveLength(1)
    expect(profileIssues({ availability: { "7": ["5–7 pm"] } }, AREAS)).toHaveLength(1)
    expect(profileIssues({ availability: { "1": ["midnight"] } }, AREAS)).toHaveLength(1)
    expect(profileIssues({ timeOff: { add: ["tomorrow"] } }, AREAS)).toHaveLength(1)
    expect(profileIssues({ zones: ["pechs"], dailyCap: 6, commissionRate: 0.25 }, AREAS)).toEqual([])
  })
})

describe("the verification checklist", () => {
  it("keeps only who checked the CNIC, when, and its last 4 digits", async () => {
    await expect(setVerification(db, "P-1", "cnic", { done: true, last4: "42101-1234567-1" }, "rec@mjazo.test")).rejects.toThrow(/last 4 digits/)
    await expect(setVerification(db, "P-1", "cnic", { done: true }, "rec@mjazo.test")).rejects.toThrow(/last 4 digits/)
    await expect(setVerification(db, "P-1", "cnic", { done: true, last4: "4567", note: "CNIC 42101-1234567-1" }, "rec@mjazo.test")).rejects.toThrow(/Don't type ID/)
    await expect(setVerification(db, "P-1", "references", { done: true, last4: "1234" }, "rec@mjazo.test")).rejects.toThrow(/Only the CNIC/)
    const item = await setVerification(db, "P-1", "cnic", { done: true, last4: "4567", note: "Original card seen" }, "rec@mjazo.test")
    expect(item).toMatchObject({ by: "rec@mjazo.test", last4: "4567", note: "Original card seen" })
    const stored = JSON.stringify((await db.one<{ verification: unknown }>("select verification from pros where id = 'P-1'"))!.verification)
    expect(stored).not.toMatch(/\d{5}/)
  })

  it("is complete once every item is ticked, and can be unticked", async () => {
    for (const i of VERIFICATION_ITEMS.filter((x) => x.key !== "cnic")) await setVerification(db, "P-1", i.key, { done: true }, "rec@mjazo.test")
    expect(isVerified((await getProRow(db, "P-1"))!)).toBe(true)
    await setVerification(db, "P-1", "training", { done: false }, "rec@mjazo.test")
    const p = (await getProRow(db, "P-1"))!
    expect(isVerified(p)).toBe(false)
    expect(p.verification?.training).toBeUndefined()
    expect(p.verification?.cnic?.last4).toBe("4567")
  })
})

describe("zones", () => {
  it("follow the catalogue's areas and carry an optional daily cap", async () => {
    await ensureZones(db, [{ slug: "dha", name: "DHA" }, { slug: "clifton", name: "Clifton" }])
    await ensureZones(db, [{ slug: "dha", name: "DHA Karachi" }])
    await setZoneCap(db, "dha", 12)
    await expect(setZoneCap(db, "dha", 0)).rejects.toThrow(/1 to 500/)
    await expect(setZoneCap(db, "nowhere", 3)).rejects.toThrow(/not found/)
    expect(await listZones(db)).toEqual([
      { slug: "clifton", name: "Clifton", dailyCap: null },
      { slug: "dha", name: "DHA Karachi", dailyCap: 12 },
    ])
    expect(await zoneCaps(db)).toEqual({ dha: 12 })
  })
})

describe("promo codes", () => {
  it("checks what's entered", () => {
    expect(promoIssues({ code: "EID25", kind: "percent", value: 25 })).toEqual([])
    expect(promoIssues({ code: "x", kind: "percent", value: 25 })).toHaveLength(1)
    expect(promoIssues({ code: "BIG", kind: "percent", value: 95 })).toHaveLength(1)
    expect(promoIssues({ code: "BIG", kind: "fixed", value: 60_000 })).toHaveLength(1)
    expect(promoIssues({ code: "LATE", kind: "fixed", value: 100, startsAt: "2026-10-10", endsAt: "2026-10-01" })).toEqual(["It has to end after it starts"])
  })

  it("works out the discount: percent with a cap, minimum order, dates, never more than the subtotal", () => {
    const base = { kind: "percent" as const, value: 10, minOrder: 3000, maxDiscount: 500, startsAt: null, endsAt: null, active: true }
    expect(promoDiscount(base, 2999)).toBe(0)
    expect(promoDiscount(base, 4000)).toBe(400)
    expect(promoDiscount(base, 9000)).toBe(500)
    expect(promoDiscount({ ...base, active: false }, 9000)).toBe(0)
    expect(promoDiscount({ ...base, kind: "fixed", value: 800, maxDiscount: null, minOrder: 0 }, 600)).toBe(600)
    const now = new Date("2026-10-21T10:00:00Z")
    expect(promoDiscount({ ...base, startsAt: "2026-10-22T00:00:00Z" }, 9000, now)).toBe(0)
    expect(promoDiscount({ ...base, endsAt: "2026-10-21T10:00:00Z" }, 9000, now)).toBe(0)
  })

  it("are created, changed and switched off; a used code keeps its discount", async () => {
    await savePromo(db, { code: "eid25", kind: "percent", value: 25, maxDiscount: 1000 }, "fin@mjazo.test", true)
    await expect(savePromo(db, { code: "EID25", kind: "percent", value: 25 }, "fin@mjazo.test", true)).rejects.toThrow(/already exists/)
    await expect(savePromo(db, { code: "NOPE1", kind: "percent", value: 25 }, "fin@mjazo.test", false)).rejects.toThrow(/doesn't exist/)
    await savePromo(db, { code: "EID25", kind: "percent", value: 20, maxDiscount: 1000 }, "fin2@mjazo.test", false)
    let [p] = await listPromos(db)
    expect(p).toMatchObject({ code: "EID25", value: 20, createdBy: "fin@mjazo.test", updatedBy: "fin2@mjazo.test", uses: 0 })

    // Once used, switching it off is fine but its discount can't change.
    await db.query("insert into customers (id, phone, name) values ('C-P', '03000000001', 'X')")
    await db.query("insert into bookings (id, customer_id, name, phone, zone, address, day, arrival_window, subtotal, total, payment_method) values ('MJ-P', 'C-P', 'X', '03000000001', 'dha', 'a', '2026-10-21', '5–7 pm', 1000, 800, 'cash')")
    await db.query("insert into promo_redemptions (code, booking_id, customer_id, amount) values ('EID25', 'MJ-P', 'C-P', 200)")
    await expect(savePromo(db, { code: "EID25", kind: "percent", value: 30 }, "fin@mjazo.test", false)).rejects.toThrow(/has been used/)
    await savePromo(db, { code: "EID25", kind: "percent", value: 20, maxDiscount: 1000, active: false }, "fin@mjazo.test", false)
    ;[p] = await listPromos(db)
    expect(p).toMatchObject({ active: false, uses: 1, given: 200 })
  })
})
