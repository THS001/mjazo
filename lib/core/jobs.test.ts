import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import type { Job } from "@/lib/ops/types"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { createBooking, getJob, importJobs, importLegacy, listJobs, listPros, mutateJob, savePro, type NewBooking } from "./jobs"
import { customerBalances, proBalances, trialBalance } from "./ledger"
import { PricingError, priceItems } from "./pricing"
import { ALLOWED, STATUS_FOR, canApply } from "./status"

const cat = buildCatalog(DEFAULT_CATALOG)
let db: Db & { close(): Promise<void> }

const wax = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: ["Rica (peel-off)"], addOns: ["Face wax"], qty: 1, unitPrice: 100 }
const booking = (id: string, over: Partial<NewBooking> = {}): NewBooking => ({
  id,
  name: "Ayesha",
  phone: "+92 300 1234567",
  area: "dha",
  subArea: "Phase 6",
  address: "House 12, Street 4",
  date: "2026-10-23",
  window: "5–7 pm",
  payment: "cash",
  items: [wax],
  total: 100,
  ...over,
})

/** What addJobEvent in lib/server/ops.ts does, on the core. */
const event = (id: string, type: Job["events"][number]["type"], by: "ops" | "pro" = "ops") =>
  mutateJob(db, id, (j) => {
    if (!canApply(j.status, type)) throw new Error(`Can't ${type} while ${j.status}`)
    j.events.push({ type, at: new Date().toISOString(), by })
    const next = STATUS_FOR[type]
    if (next) j.status = next
  })

beforeAll(async () => {
  db = await testCore()
  await savePro(db, { id: "P-A", name: "Sana", phone: "03111111111", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
}, 60_000)
afterAll(() => db?.close())

describe("server-side pricing", () => {
  it("prices every line from the catalogue, whatever the browser said", () => {
    const r = priceItems([wax], cat)
    expect(r.items[0]).toMatchObject({ unitPrice: 4500 + 800 + 800, options: ["Rica (peel-off)"], addOns: ["Face wax"], duration: 120 })
    expect(r.subtotal).toBe(6100)
    expect(r.changed).toBe(true)
  })

  it("prices bundles at the bundle price and add-ons given by id", () => {
    const r = priceItems([{ name: "x", category: "womens-salon", service: "bundle-full-glow", options: [], addOns: [], qty: 2 }, { ...wax, options: [], addOns: ["bikini"] }], cat)
    expect(r.items.map((i) => i.unitPrice)).toEqual([7800, 4500 + 1200])
    expect(r.subtotal).toBe(2 * 7800 + 5700)
  })

  it("refuses lines that can't be booked or options that don't exist", () => {
    expect(() => priceItems([{ ...wax, options: ["Gold leaf"] }], cat)).toThrow(PricingError)
    expect(() => priceItems([{ ...wax, addOns: ["massage"] }], cat)).toThrow(PricingError)
    expect(() => priceItems([{ ...wax, service: "no-such-service" }], cat)).toThrow(PricingError)
    expect(() => priceItems([{ ...wax, service: "bundle-nope" }], cat)).toThrow(PricingError)
  })

  it("keeps price-on-request lines at zero for the team to quote", () => {
    const r = priceItems([{ name: "Bridal consult", category: "makeup-mehndi", service: "bridal-consult", options: [], addOns: [], qty: 1 }], cat)
    expect(r.items[0].unitPrice).toBe(0)
  })
})

describe("the status machine", () => {
  it("allows only real progressions", () => {
    expect(canApply("new", "checked_in")).toBe(false)
    expect(canApply("assigned", "en_route")).toBe(true)
    expect(canApply("completed", "assigned")).toBe(false)
    expect(canApply("assigned", "no_show")).toBe(true)
    for (const s of Object.keys(ALLOWED) as Job["status"][]) expect(ALLOWED[s]).toContain("note")
  })
})

describe("bookings", () => {
  it("creates a booking and its customer, priced on the server", async () => {
    const job = await createBooking(db, booking("MJ-1"), cat)
    expect(job).toMatchObject({ id: "MJ-1", status: "new", total: 6100, area: "dha", window: "5–7 pm", customer: { name: "Ayesha", phone: "03001234567" }, events: [] })
    expect(job.items[0].unitPrice).toBe(6100)
    const c = await db.one<{ id: string; name: string }>("select c.id, c.name from customers c join bookings b on b.customer_id = c.id where b.id = 'MJ-1'")
    expect(c?.name).toBe("Ayesha")
    const ev = await db.query<{ type: string }>("select type from events where booking_id = 'MJ-1'")
    expect(ev.map((e) => e.type)).toEqual(["booking.created"])
  })

  it("gives the same customer every booking from one phone number, and ignores repeats of the same id", async () => {
    await createBooking(db, booking("MJ-2", { phone: "0300-1234567", name: "Ayesha K" }), cat)
    await createBooking(db, booking("MJ-2", { name: "Someone else" }), cat)
    const rows = await db.query<{ customer_id: string; name: string }>("select customer_id, name from bookings where id in ('MJ-1', 'MJ-2') order by id")
    expect(rows[0].customer_id).toBe(rows[1].customer_id)
    expect(rows[1].name).toBe("Ayesha K")
    expect(await db.query("select * from customers")).toHaveLength(1)
  })

  it("gives the referral discount on a new customer's first booking only", async () => {
    const first = await createBooking(db, booking("MJ-R1", { phone: "03339999999", referral: "AYESHA-1234" }), cat, { referralOff: 500 })
    expect(first.total).toBe(5600)
    expect(await db.one("select subtotal, discount, total, promo_code from bookings where id = 'MJ-R1'")).toEqual({ subtotal: 6100, discount: 500, total: 5600, promo_code: "REF:AYESHA-1234" })
    const second = await createBooking(db, booking("MJ-R2", { phone: "03339999999", referral: "AYESHA-1234" }), cat, { referralOff: 500 })
    expect(second.total).toBe(6100)
    await db.query("delete from bookings where id in ('MJ-R1', 'MJ-R2')")
  })

  it("runs a visit from assignment to done, posting the money as it goes", async () => {
    await mutateJob(db, "MJ-1", (j) => {
      j.proId = "P-A"
      j.status = "assigned"
      j.events.push({ type: "assigned", at: new Date().toISOString(), by: "ops", note: "P-A" })
    })
    await event("MJ-1", "en_route", "pro")
    await event("MJ-1", "checked_in", "pro")
    await event("MJ-1", "checked_out", "pro")
    await mutateJob(db, "MJ-1", (j) => {
      j.paymentRecord = { amount: 6100, method: "cash", at: new Date().toISOString(), status: "cash" }
      j.visitNotes = ["Prefers Rica"]
    })
    const done = await event("MJ-1", "completed", "pro")
    expect(done?.status).toBe("completed")
    expect(done?.events.map((e) => e.type)).toEqual(["assigned", "en_route", "checked_in", "checked_out", "completed"])
    const again = (await getJob(db, "MJ-1"))!
    expect(again.visitNotes).toEqual(["Prefers Rica"])
    expect(again.paymentRecord).toMatchObject({ amount: 6100, method: "cash", status: "cash" })
    // 25% commission on 6100: she earns 4575 and holds the 6100 cash.
    expect(await proBalances(db, "P-A")).toEqual({ cashHeld: 6100, payable: 4575 })
    const customer = (await db.one<{ customer_id: string }>("select customer_id from bookings where id = 'MJ-1'"))!.customer_id
    expect((await customerBalances(db, customer)).owes).toBe(0)
    const types = (await db.query<{ type: string }>("select type from events where booking_id = 'MJ-1' order by id")).map((e) => e.type)
    expect(types).toEqual(["booking.created", "booking.assigned", "booking.en_route", "booking.checked_in", "booking.checked_out", "payment.recorded", "booking.completed"])
    expect((await trialBalance(db)).balanced).toBe(true)
  })

  it("refuses to rewrite a job's history", async () => {
    await expect(mutateJob(db, "MJ-1", (j) => void j.events.pop())).rejects.toThrow(/only be added to/)
    expect((await getJob(db, "MJ-1"))!.events).toHaveLength(5)
  })

  it("leaves an unmatched digital payment out of the books until a person checks it", async () => {
    await mutateJob(db, "MJ-2", (j) => {
      j.proId = "P-A"
      j.status = "checked_out"
      j.paymentRecord = { amount: 6100, method: "jazzcash", at: new Date().toISOString(), status: "mismatch" }
    })
    const before = await proBalances(db, "P-A")
    const bank = async () => (await db.one<{ b: number }>("select coalesce(sum(amount), 0)::int as b from postings where account_id = 'mjazo:bank'"))!.b
    expect(await bank()).toBe(0)
    await mutateJob(db, "MJ-2", (j) => void (j.paymentRecord!.checked = true))
    expect(await bank()).toBe(6100)
    expect((await proBalances(db, "P-A")).cashHeld).toBe(before.cashHeld)
  })

  it("recomputes the total when ops edits the lines", async () => {
    const j = await mutateJob(db, "MJ-2", (x) => void (x.items = [{ ...x.items[0], qty: 2 }]))
    expect(j?.total).toBe(12200)
    expect((await db.one<{ subtotal: number; total: number }>("select subtotal, total from bookings where id = 'MJ-2'"))).toEqual({ subtotal: 12200, total: 12200 })
  })
})

describe("importing whole jobs", () => {
  const old: Job = {
    id: "MJ-OLD",
    createdAt: "2026-10-10T10:00:00.000Z",
    date: "2026-10-10",
    window: "1–3 pm",
    area: "clifton",
    address: "Flat 3",
    customer: { name: "Hina", phone: "03211234567" },
    items: [{ name: "Manicure", category: "womens-salon", service: "manicure", options: [], addOns: [], qty: 1, unitPrice: 2000 }],
    total: 2000,
    payment: "cash",
    status: "completed",
    proId: "P-A",
    events: [{ type: "assigned", at: "2026-10-10T08:00:00.000Z", by: "ops" }, { type: "completed", at: "2026-10-10T12:00:00.000Z", by: "pro" }],
    paymentRecord: { amount: 2000, method: "cash", at: "2026-10-10T12:00:00.000Z", status: "cash" },
    rating: { stars: 5, tags: ["On time"], at: "2026-10-10T13:00:00.000Z" },
  }

  it("keeps everything about the job and posts its money once", async () => {
    const before = await proBalances(db, "P-A")
    expect(await importJobs(db, [old])).toBe(1)
    expect(await importJobs(db, [old])).toBe(0)
    const back = (await getJob(db, "MJ-OLD"))!
    expect(back).toMatchObject({ status: "completed", proId: "P-A", rating: { stars: 5, tags: ["On time"] }, paymentRecord: { amount: 2000 } })
    expect(back.events).toHaveLength(2)
    const after = await proBalances(db, "P-A")
    expect(after.cashHeld - before.cashHeld).toBe(2000)
    expect(after.payable - before.payable).toBe(1500)
  })

  it("copies the older records across once, keeping pros that already exist", async () => {
    const legacyPro = { id: "P-OLD", name: "Rubina", phone: "03222222222", area: "gulshan", skills: ["womens-salon"], women: true, status: "active" as const, createdAt: "2026-10-01T00:00:00.000Z" }
    const clash = { ...legacyPro, id: "P-A2", phone: "03111111111" } // same phone as P-A: skipped
    const orphan: Job = { ...old, id: "MJ-ORPHAN", status: "assigned", proId: "P-GONE", paymentRecord: undefined, rating: undefined, events: [] }
    const first = await importLegacy(db, async () => ({ pros: [legacyPro, clash], jobs: [{ ...old, id: "MJ-LEG", proId: "P-OLD" }, orphan] }))
    expect(first).toEqual({ pros: 1, jobs: 2 })
    expect(await importLegacy(db, async () => ({ pros: [legacyPro], jobs: [] }))).toBeNull()
    const o = (await getJob(db, "MJ-ORPHAN"))!
    expect(o.status).toBe("new")
    expect(o.proId).toBeUndefined()
    expect(o.events.at(-1)?.note).toMatch(/P-GONE/)
    expect((await getJob(db, "MJ-LEG"))!.proId).toBe("P-OLD")
    await db.query("delete from bookings where id in ('MJ-ORPHAN')")
  })

  it("lists recent and future jobs, and pros", async () => {
    const ids = (await listJobs(db, { sinceDays: 400 })).map((j) => j.id)
    expect(ids).toEqual(expect.arrayContaining(["MJ-1", "MJ-2", "MJ-OLD"]))
    expect((await listPros(db)).map((p) => p.id).sort()).toEqual(["P-A", "P-OLD"])
  })
})
