import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import { packOffers } from "@/lib/packs"
import type { Job } from "@/lib/ops/types"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { activatePlus } from "./growth"
import { createBooking, getJob, mutateJob, savePro, type NewBooking } from "./jobs"
import { ACC, balance, customerBalances, proBalances, trialBalance } from "./ledger"
import { activatePack, cancelPack, listPacks, packsFor, requestPack } from "./packs"
import { visitMargins } from "./pilot"
import { STATUS_FOR } from "./status"

// Visit packs on a real (in-memory) core database: asked for, paid and activated, used on
// bookings (the pack pays its price a visit, Mjazo funds the saving, the pro earns her share of the
// full price), cancelled bookings giving the visit back, the refusals, and cancelling a pack.

const cat = buildCatalog(DEFAULT_CATALOG)
const offers = packOffers(cat)
const refresh = offers.find((o) => o.slug === "monthly-refresh")!
const ac = offers.find((o) => o.slug === "ac-year")!
let db: Db & { close(): Promise<void> }
let customerId = ""
let n = 0

const book = (o: Partial<NewBooking> & Pick<NewBooking, "items">) =>
  createBooking(db, { id: `MJ-PACK${++n}`, name: "Ayesha Khan", phone: "03005556667", area: "dha", address: "House 9", date: "2026-11-02", window: "11 am–1 pm", payment: "cash", customerId, ...o }, cat)
const refreshLine = { ...refresh.item }
const done = async (id: string) => {
  await mutateJob(db, id, (j) => {
    j.proId = "P-PK"
    j.status = "assigned"
  })
  for (const type of ["en_route", "checked_in", "checked_out", "completed"] as Job["events"][number]["type"][])
    await mutateJob(db, id, (j) => {
      j.events.push({ type, at: new Date().toISOString(), by: "pro" })
      j.status = STATUS_FOR[type] ?? j.status
    })
}

beforeAll(async () => {
  db = await testCore()
  await savePro(db, { id: "P-PK", name: "Hina", phone: "03117778889", area: "dha", skills: ["womens-salon", "ac-services"], women: true, status: "active", createdAt: new Date().toISOString(), commissionRate: 0.25 })
  customerId = (await db.one<{ id: string }>("insert into customers (id, phone, name) values ('C-PACK', '03005556667', 'Ayesha Khan') returning id"))!.id
}, 60_000)
afterAll(() => db?.close())

describe("visit packs", () => {
  it("come from the catalogue with their own price, the pack's price and the saving", () => {
    expect(refresh).toMatchObject({ visits: 3, visitPrice: 2250, listPrice: 2600, total: 6750, saving: 1050, item: { service: "bundle-quick-refresh" } })
    expect(ac).toMatchObject({ listPrice: 2500, item: { category: "ac-services", service: "ac-service", options: ["Split", "1 unit"] } })
  })

  it("is asked for, activated once paid, and pays a visit from the ledger", async () => {
    const { pack: asked, isNew } = await requestPack(db, customerId, refresh, `customer:${customerId}`)
    expect(isNew).toBe(true)
    expect((await requestPack(db, customerId, refresh, "again")).pack.id).toBe(asked.id) // one request at a time
    await expect(book({ items: [refreshLine], packId: asked.id })).rejects.toThrow("once we have the payment")

    const pack = await activatePack(db, { packId: asked.id, paidVia: "jazzcash", reference: "TX-1", by: "finance@mjazo.test" })
    expect(pack).toMatchObject({ status: "active", left: 3, used: 0, booked: 0, paidVia: "jazzcash" })
    expect(Date.parse(pack.endsAt!) - Date.parse(pack.startsAt!)).toBe(120 * 86400_000)
    expect(await balance(db, ACC.packs)).toBe(-6750) // held until the visits are done
    await expect(activatePack(db, { packId: asked.id, paidVia: "cash", by: "x" })).rejects.toThrow("isn't waiting")

    // A visit with the pack, plus a threading line they pay as usual.
    const threading = { name: "Threading", category: "womens-salon", service: "brows-upper-lip", options: [], addOns: [], qty: 1 }
    const b = await book({ items: [refreshLine, threading], packId: pack.id })
    expect(b.pack).toEqual({ id: pack.id, name: "Monthly Quick Refresh", paid: 2250 })
    expect(b.total).toBe(2600 + 400 - 350) // the pack's saving is the discount
    expect((await packsFor(db, customerId))[0]).toMatchObject({ left: 2, booked: 1, nextDue: null })

    await done(b.id)
    // The pack paid 2,250: the customer owes the threading only. Hina earns 75% of the full 3,000.
    expect((await customerBalances(db, customerId)).owes).toBe(400)
    expect((await proBalances(db, "P-PK")).payable).toBe(2250)
    expect(await balance(db, ACC.packs)).toBe(-4500)
    // Mjazo's net: 750 commission less the 350 saving it funds.
    expect((await visitMargins(db, [b.id])).get(b.id)).toBe(400)
    const after = (await packsFor(db, customerId))[0]
    expect(after).toMatchObject({ used: 1, booked: 0, left: 2, lastVisit: "2026-11-02", nextDue: "2026-11-30" })
    expect((await trialBalance(db)).balanced).toBe(true)
  })

  it("gives a cancelled booking's visit back, and refuses what it can't pay for", async () => {
    const [pack] = await packsFor(db, customerId)
    const b1 = await book({ items: [refreshLine], packId: pack.id })
    const b2 = await book({ items: [refreshLine], packId: pack.id })
    expect(b1.total - b1.pack!.paid).toBe(0)
    await expect(book({ items: [refreshLine], packId: pack.id })).rejects.toThrow("used or booked")
    await mutateJob(db, b2.id, (j) => {
      j.status = "cancelled"
    })
    expect((await packsFor(db, customerId))[0]).toMatchObject({ left: 1, booked: 1 })
    // Not the pack's service; someone else's pack.
    await expect(book({ items: [{ ...refreshLine, service: "bundle-weekend-reset" }], packId: pack.id })).rejects.toThrow("Add The Quick Refresh")
    await expect(book({ items: [refreshLine], packId: pack.id, customerId: "C-NOBODY", phone: "03009990001" })).rejects.toThrow("isn't on your account")
    // A cancelled booking never posts the pack's money; a done one does.
    await done(b1.id)
    expect((await getJob(db, b2.id))!.pack?.paid).toBe(2250)
    expect(await balance(db, ACC.packs)).toBe(-2250)
  })

  it("counts Plus only on the rest of a pack booking", async () => {
    await activatePlus(db, { phone: "03005556667", terms: { price: 2500, discountPct: 10 }, paidVia: "cash", by: "finance@mjazo.test" })
    const [pack] = await packsFor(db, customerId)
    const wax = { name: "Underarm wax", category: "womens-salon", service: "underarm-wax", options: [], addOns: [], qty: 2 }
    const b = await book({ items: [refreshLine, wax], packId: pack.id })
    // 350 saving on the pack line, and 10% of the PKR 1,000 of wax.
    expect(b.total).toBe(2600 + 1000 - 350 - 100)
    await mutateJob(db, b.id, (j) => {
      j.status = "cancelled"
    })
  })

  it("is added by phone, can't be cancelled with visits booked, and gives back its unused visits", async () => {
    const pack = await activatePack(db, { phone: "0300 1112223", name: "Sara", offer: ac, paidVia: "cash", by: "owner@mjazo.test", now: new Date("2026-10-24T10:00:00Z") })
    expect(pack).toMatchObject({ status: "active", visits: 3, visitPrice: 2150, item: { service: "ac-service" } })
    expect((await listPacks(db, new Date("2026-10-25T10:00:00Z"))).find((p) => p.id === pack.id)).toMatchObject({ customerName: "Sara", phone: "03001112223" })
    const sara = pack.customerId
    const acLine = { ...ac.item }
    const b = await createBooking(db, { id: `MJ-PACK${++n}`, name: "Sara", phone: "03001112223", area: "dha", address: "Flat 2", date: "2026-11-03", window: "11 am–1 pm", payment: "cash", customerId: sara, items: [acLine], packId: pack.id }, cat)
    expect(b.total).toBe(2150)
    await expect(cancelPack(db, pack.id, "owner@mjazo.test")).rejects.toThrow("visits booked")
    await done(b.id)
    const cancelled = await cancelPack(db, pack.id, "owner@mjazo.test", "Moving to Lahore")
    expect(cancelled).toMatchObject({ status: "cancelled", refunded: 2 * 2150 })
    expect(await balance(db, ACC.packs)).toBe(-2250) // only Ayesha's last visit is still held
    expect((await trialBalance(db)).balanced).toBe(true)
  })

  it("stops at the end of its time", async () => {
    const { pack } = await requestPack(db, customerId, ac, "x")
    await activatePack(db, { packId: pack.id, paidVia: "bank", by: "finance@mjazo.test", now: new Date("2025-01-01T00:00:00Z") })
    expect((await packsFor(db, customerId)).find((p) => p.id === pack.id)).toMatchObject({ expired: true, nextDue: null })
    await expect(book({ items: [{ ...ac.item }], packId: pack.id })).rejects.toThrow("time to use it is over")
  })
})
