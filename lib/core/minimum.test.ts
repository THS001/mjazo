import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import { weekStartOf } from "@/lib/ops/minimum"
import type { Job } from "@/lib/ops/types"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { createBooking, mutateJob, savePro } from "./jobs"
import { ACC, allProBalancesAt, balance, proBalances, trialBalance } from "./ledger"
import { minimumWeeks } from "./minimum"
import { approvePayoutRun, cancelPayoutRun, draftPayoutRun, payPayout } from "./money"
import { policy, savePolicy } from "./policy"
import { setProProfile } from "./pros"
import { STATUS_FOR } from "./status"

// Pros' weekly minimum on a real (in-memory) core database: the week from the ledger, the payout
// run topping it up once the week is over (a pro owed nothing else included), a cancelled run
// posting nothing, a paid top-up posted once per week, the books staying balanced, and her open
// windows counted from what she had open during the week.

const cat = buildCatalog(DEFAULT_CATALOG)
const day = (n: number) => new Date(Date.now() + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10)
const week = weekStartOf(day(0))
const sunday = new Date(Date.parse(`${week}T00:00:00Z`) + 6 * 86400_000).toISOString().slice(0, 10)
const nextMonday = new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10)
/** Monday's run, drafted once this week is over. */
const weekOver = new Date(`${nextMonday}T09:00:00+05:00`)
const verified = Object.fromEntries(["cnic", "references", "address", "practical", "training", "conduct"].map((k) => [k, { by: "ops@mjazo.test", at: "2026-09-01T00:00:00Z" }]))
const owner = { email: "owner@mjazo.test", role: "owner" as const }
let db: Db & { close(): Promise<void> }
let earned = 0

const pro = (id: string, name: string, phone: string) => savePro(db, { id, name, phone, area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: `${day(-20)}T08:00:00Z` })

beforeAll(async () => {
  db = await testCore()
  await pro("P-MIN", "Hina Baloch", "03117780001")
  await pro("P-IDLE", "Rabia Khan", "03117780002")
  await pro("P-NEW", "Sadia Noor", "03117780003") // not verified yet
  await db.query("update pros set verification = $1::jsonb where id in ('P-MIN', 'P-IDLE')", [JSON.stringify(verified)])
  // Hina did one visit this week.
  const b = await createBooking(db, { id: "MJ-MIN1", name: "Sara Ahmed", phone: "03005552222", area: "dha", address: "House 1", date: day(0), window: "7–9 pm", payment: "cash", items: [{ name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1 }] }, cat)
  await mutateJob(db, b.id, (j) => Object.assign(j, { proId: "P-MIN", status: "assigned" }))
  for (const type of ["en_route", "checked_in", "checked_out", "completed"] as Job["events"][number]["type"][])
    await mutateJob(db, b.id, (j) => {
      j.events.push({ type, at: new Date().toISOString(), by: "pro" })
      j.status = STATUS_FOR[type] ?? j.status
    })
  earned = (await proBalances(db, "P-MIN")).payable
}, 60_000)
afterAll(() => db?.close())

describe("pros' weekly minimum", () => {
  it("is off until Finance switches it on: a run tops up nobody", async () => {
    expect(await policy(db, "pro_minimum")).toMatchObject({ on: false, amount: 10000, weeks: 12, minWindows: 10, minAcceptance: 0.8 })
    const run = await draftPayoutRun(db, { periodStart: week, periodEnd: sunday, by: "finance@mjazo.test" })
    expect(run.payouts.map((p) => [p.proId, p.topUp])).toEqual([["P-MIN", 0]])
    await cancelPayoutRun(db, run.id, "finance@mjazo.test")
  })

  it("works out each pro's week from the ledger, her windows and the conditions", async () => {
    await savePolicy(db, "pro_minimum", { on: true }, "finance@mjazo.test")
    const w = await minimumWeeks(db, await policy(db, "pro_minimum"), week)
    expect(earned).toBeGreaterThan(0)
    expect(w.get("P-MIN")).toMatchObject({ earned, windows: 42, eligible: true, topUp: 10000 - earned })
    expect(w.get("P-IDLE")).toMatchObject({ earned: 0, eligible: true, topUp: 10000 })
    expect(w.get("P-NEW")).toMatchObject({ eligible: false, topUp: 0, checks: { verified: false } })
  })

  it("tops up in a whole week's run, including a pro owed nothing else; cancelling posts nothing", async () => {
    // Not while the week is still running: it would be topped up on part of its earnings, then closed.
    const early = await draftPayoutRun(db, { periodStart: week, periodEnd: sunday, by: "finance@mjazo.test" })
    expect(early.payouts.map((p) => [p.proId, p.topUp])).toEqual([["P-MIN", 0]])
    await cancelPayoutRun(db, early.id, "finance@mjazo.test")
    const run = await draftPayoutRun(db, { periodStart: week, periodEnd: sunday, by: "finance@mjazo.test", now: weekOver })
    const by = Object.fromEntries(run.payouts.map((p) => [p.proId, p]))
    expect(by["P-MIN"]).toMatchObject({ earned, topUp: 10000 - earned, amount: 10000 })
    expect(by["P-IDLE"]).toMatchObject({ earned: 0, topUp: 10000, amount: 10000 })
    expect(by["P-NEW"]).toBeUndefined()
    await cancelPayoutRun(db, run.id, "finance@mjazo.test")
    expect(await balance(db, ACC.minimums)).toBe(0)
    // Not one whole Monday-to-Sunday week (eight days): no top-ups.
    const sundayBefore = new Date(Date.parse(`${week}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10)
    const odd = await draftPayoutRun(db, { periodStart: sundayBefore, periodEnd: sunday, by: "finance@mjazo.test" })
    expect(odd.payouts.map((p) => [p.proId, p.topUp])).toEqual([["P-MIN", 0]])
    await cancelPayoutRun(db, odd.id, "finance@mjazo.test")
  })

  it("posts the top-up when the payout is paid, once a week, and the books balance", async () => {
    const run = await draftPayoutRun(db, { periodStart: week, periodEnd: sunday, by: "finance@mjazo.test", now: weekOver })
    await approvePayoutRun(db, run.id, owner)
    for (const p of run.payouts) await payPayout(db, p.id, { reference: `T-${p.proId}`, by: "finance@mjazo.test" })
    expect(await balance(db, ACC.minimums)).toBe(10000 - earned + 10000)
    expect(await proBalances(db, "P-IDLE")).toEqual({ cashHeld: 0, payable: 0 }) // paid in full
    expect(await proBalances(db, "P-MIN")).toEqual({ cashHeld: 0, payable: 0 })
    const entries = await db.query<{ idempotency_key: string }>("select idempotency_key from journal_entries where kind = 'minimum_topup' order by id")
    expect(entries.map((e) => e.idempotency_key)).toEqual([`minimum:${run.payouts[0].proId}:${week}`, `minimum:${run.payouts[1].proId}:${week}`])
    expect((await trialBalance(db)).balanced).toBe(true)
    // A later run whose cut-off is before this payment counts the top-up with the payout that paid it.
    expect((await allProBalancesAt(db, new Date(`${week}T00:00:00+05:00`).toISOString())).get("P-IDLE")?.payable ?? 0).toBe(0)
    // The same week again tops up nobody: it's been paid.
    await savePolicy(db, "pro_minimum", { amount: 12000 }, "finance@mjazo.test")
    expect((await draftPayoutRun(db, { periodStart: week, periodEnd: sunday, by: "finance@mjazo.test", now: weekOver }).catch((e: Error) => e.message))).toMatch(/Nobody is owed/)
  })

  it("counts the windows she had open during the week, not only what she has when the run is drafted", async () => {
    const p = await policy(db, "pro_minimum")
    const windows = async (id: string) => (await minimumWeeks(db, p, week, { proIds: [id] })).get(id)!.windows
    await pro("P-FLIP", "Nadia Ali", "03117780004")
    await pro("P-OFF", "Sana Iqbal", "03117780005")
    expect(await windows("P-FLIP")).toBe(42)
    // Closed on every day, then open again: today counts as closed.
    await setProProfile(db, "P-FLIP", { availability: { "0": [] } }, ["dha"])
    await setProProfile(db, "P-FLIP", { availability: null }, ["dha"])
    expect(await windows("P-FLIP")).toBe(42 - 6)
    // A day off taken back on the day still counts as off; one taken back before the day doesn't.
    await setProProfile(db, "P-OFF", { timeOff: { add: [day(0), day(1)] } }, ["dha"])
    await setProProfile(db, "P-OFF", { timeOff: { remove: [day(0), day(1)] } }, ["dha"])
    expect(await windows("P-OFF")).toBe(42 - 6)
    const undone = await db.query<{ kind: string; day: string }>("select kind, day from pro_availability_log where pro_id = 'P-OFF'")
    expect(undone).toEqual([{ kind: "day_off_undone", day: day(0) }])
  })
})
