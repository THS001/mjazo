import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import type { Job } from "@/lib/ops/types"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { createBooking, mutateJob, savePro } from "./jobs"
import { pilotSettings, savePilotMonth, savePilotSettings, visitMargins } from "./pilot"
import { savePromo } from "./promos"
import { STATUS_FOR } from "./status"

// The pilot gates' inputs on a real (in-memory) core database: the founder's settings and monthly
// spend in core_meta (checked, and in the audit log), and Mjazo's net per visit from the ledger.

const cat = buildCatalog(DEFAULT_CATALOG)
let db: Db & { close(): Promise<void> }

beforeAll(async () => {
  db = await testCore()
  await savePro(db, { id: "P-A", name: "Sana", phone: "03111111111", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
}, 60_000)
afterAll(() => db?.close())

describe("the pilot's inputs", () => {
  it("keeps the start date, the sales tax assumptions and each month's spend, with every change audited", async () => {
    expect(await pilotSettings(db)).toMatchObject({ startDate: null, taxRate: 0, taxInclusive: true, taxBase: "total", months: {} })
    await savePilotSettings(db, { startDate: "2026-11-01", taxRate: 0.08 }, "finance@mjazo.test")
    await savePilotMonth(db, "2026-11", { marketing: 50_000, transport: 18_000, note: " Instagram test " }, "finance@mjazo.test")
    await savePilotMonth(db, "2026-12", { marketing: 1, transport: 2 }, "owner@mjazo.test")
    await savePilotMonth(db, "2026-12", null, "owner@mjazo.test")
    const s = await pilotSettings(db)
    expect(s).toMatchObject({ startDate: "2026-11-01", taxRate: 0.08, taxInclusive: true, months: { "2026-11": { marketing: 50_000, transport: 18_000, note: "Instagram test", by: "finance@mjazo.test" } } })
    expect(s.months["2026-12"]).toBeUndefined()
    const log = await db.query<{ actor: string; action: string }>("select actor, action from audit_log where target = 'pilot' order by id")
    expect(log.map((r) => r.action)).toEqual(["changed the pilot settings", "entered the pilot spend", "entered the pilot spend", "removed the pilot spend"])
  })

  it("refuses a bad month, date, rate or amount", async () => {
    await expect(savePilotMonth(db, "2026-13", { marketing: 1, transport: 1 }, "x")).rejects.toThrow("Pick a month")
    await expect(savePilotMonth(db, "2026-11", { marketing: -5, transport: 1 }, "x")).rejects.toThrow("whole rupees")
    await expect(savePilotMonth(db, "2026-11", { marketing: 1.5, transport: 1 }, "x")).rejects.toThrow("whole rupees")
    await expect(savePilotSettings(db, { startDate: "1 Nov" }, "x")).rejects.toThrow("start date")
    await expect(savePilotSettings(db, { taxRate: 0.3 }, "x")).rejects.toThrow("between 0% and 25%")
  })
})

describe("Mjazo's net per visit", () => {
  it("is the commission less the discount Mjazo funded, from the visit's ledger entry", async () => {
    await savePromo(db, { code: "PILOT10", kind: "percent", value: 10 }, "finance@mjazo.test", true)
    const wax = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1 }
    const b = await createBooking(db, { id: "MJ-PILOT1", name: "Hira", phone: "03004445556", area: "dha", address: "House 3", date: "2026-10-23", window: "5–7 pm", payment: "cash", items: [wax], promo: "PILOT10" }, cat)
    expect(b.total).toBe(4050) // 4,500 less 10%
    const step = (type: Job["events"][number]["type"]) =>
      mutateJob(db, b.id, (j) => {
        j.events.push({ type, at: new Date().toISOString(), by: "pro" })
        j.status = STATUS_FOR[type] ?? j.status
      })
    await mutateJob(db, b.id, (j) => {
      j.proId = "P-A"
      j.status = "assigned"
    })
    for (const t of ["en_route", "checked_in", "checked_out", "completed"] as const) await step(t)
    // 25% of the full PKR 4,500 is 1,125; Mjazo funds the PKR 450 discount: 675.
    expect((await visitMargins(db, [b.id, "MJ-NONE"])).get(b.id)).toBe(675)
    expect((await visitMargins(db, ["MJ-NONE"])).size).toBe(0)
  })
})
