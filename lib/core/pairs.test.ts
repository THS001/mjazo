import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import type { Job, Pro } from "@/lib/ops/types"
import { visitEarning } from "@/lib/server/pro-api"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { createBooking, getJob, mutateJob, savePro, type NewBooking } from "./jobs"
import { ACC, proBalances, trialBalance } from "./ledger"
import { pairRates, priorPairVisits } from "./pairs"
import { savePolicy } from "./policy"
import { STATUS_FOR } from "./status"

// The regular customer rate on a real (in-memory) core database: from a customer's 2nd visit with
// the same pro, Mjazo's share in the ledger is the policy's rate; what the pro app shows her before
// the visit matches what she's paid.

const cat = buildCatalog(DEFAULT_CATALOG)
const wax = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1 }
const tomorrow = new Date(Date.now() + 29 * 3600_000).toISOString().slice(0, 10)
let db: Db & { close(): Promise<void> }
let n = 0
let price = 0
const pro = (id: string, commissionRate: number): Pro => ({ id, name: `Pro ${id}`, phone: `0311777${String(++n).padStart(4, "0")}`, area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString(), commissionRate })

const book = (phone: string, o: Partial<NewBooking> = {}) => createBooking(db, { id: `MJ-PAIR${++n}`, name: "Sara Ahmed", phone, area: "dha", address: "House 1", date: tomorrow, window: "11 am–1 pm", payment: "cash", items: [wax], ...o }, cat)
const finish = async (id: string, proId: string) => {
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
const entry = async (bookingId: string) => {
  const rows = await db.query<{ account_id: string; amount: number; memo: string | null }>("select p.account_id, p.amount, e.memo from postings p join journal_entries e on e.id = p.entry_id where e.booking_id = $1 and e.kind = 'visit_completed'", [bookingId])
  return { memo: rows[0]?.memo ?? null, ...Object.fromEntries(rows.map((r) => [r.account_id, r.amount])) } as Record<string, number> & { memo: string | null }
}
const rateOf = async (b: Job, proId: string, proRate: number) => (await pairRates(db, [{ bookingId: b.id, proId, proRate }])).get(b.id)!

beforeAll(async () => {
  db = await testCore()
  await savePro(db, pro("P-PA", 0.25))
  await savePro(db, pro("P-PB", 0.1))
  await db.query("update pros set commission_rate = 0.1 where id = 'P-PB'") // savePro leaves the rate to mission control
  price = (await book("03001110000")).total
}, 60_000)
afterAll(() => db?.close())

describe("the regular customer rate", () => {
  it("is her usual share on the first visit, and the lower one from the second, in the ledger too", async () => {
    const first = await book("03001110001")
    expect(await rateOf(first, "P-PA", 0.25)).toEqual({ rate: 0.25, regular: false })
    await finish(first.id, "P-PA")
    expect(await entry(first.id)).toMatchObject({ memo: null, [ACC.commission]: -(price - Math.round(price * 0.75)) })

    const second = await book("03001110001")
    const rate = await rateOf(second, "P-PA", 0.25)
    expect(rate).toEqual({ rate: 0.15, regular: true })
    // What the pro app and the offer message show her matches what the ledger pays her.
    const promised = visitEarning(second, pro("P-PA", 0.25), rate)
    const before = (await proBalances(db, "P-PA")).payable
    await finish(second.id, "P-PA")
    expect((await proBalances(db, "P-PA")).payable - before).toBe(promised)
    expect(promised).toBe(Math.round(price * 0.85))
    expect(await entry(second.id)).toMatchObject({ memo: "Regular customer: Mjazo's share 15%", [ACC.commission]: -(price - Math.round(price * 0.85)) })
    expect((await trialBalance(db)).balanced).toBe(true)
  })

  it("counts only the same customer with the same pro, within the policy's days", async () => {
    // Another pro for the same customer: her first visit.
    expect((await rateOf(await book("03001110001"), "P-PB", 0.25)).regular).toBe(false)
    // Another customer with the same pro: first visit.
    expect((await rateOf(await book("03001110002"), "P-PA", 0.25)).regular).toBe(false)
    // Their earlier visits are older than 180 days: not regulars any more.
    await db.query("update bookings set day = day - 200 where status = 'completed' and pro_id = 'P-PA'")
    expect((await rateOf(await book("03001110001"), "P-PA", 0.25)).regular).toBe(false)
    await savePolicy(db, "pair_rate", { days: 365 }, "finance@mjazo.test")
    expect((await rateOf(await book("03001110001"), "P-PA", 0.25)).regular).toBe(true)
  })

  it("counts each earlier visit once when a booking is asked about twice (offered to her again)", async () => {
    const again = await book("03001110001")
    const once = (await priorPairVisits(db, [{ bookingId: again.id, proId: "P-PA" }], 365)).get(again.id)
    expect((await priorPairVisits(db, [{ bookingId: again.id, proId: "P-PA" }, { bookingId: again.id, proId: "P-PA" }], 365)).get(again.id)).toBe(once)
  })

  it("never raises a pro's lower rate, and is off when switched off", async () => {
    const a = await book("03001110003")
    await finish(a.id, "P-PB")
    const b = await finish((await book("03001110003")).id, "P-PB")
    expect(await entry(b.id)).toMatchObject({ memo: null, [ACC.commission]: -(price - Math.round(price * 0.9)) })
    await savePolicy(db, "pair_rate", { on: false }, "finance@mjazo.test")
    expect((await rateOf(await book("03001110001"), "P-PA", 0.25)).regular).toBe(false)
    const audit = await db.one<{ action: string }>("select action from audit_log where target = 'pair_rate' order by id desc limit 1")
    expect(audit?.action).toBe("changed the regular customer rate policy")
  })
})
