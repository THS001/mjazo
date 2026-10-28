import { describe, expect, it } from "vitest"
import { DEFAULT_PILOT, pilotGates, spendIn, type PilotInput, type PilotSettings } from "./pilot"
import type { Job, Pro } from "./types"

// The pilot gates from the blueprint analysis, worked out from jobs, pros, the founder's monthly
// inputs and the ledger's margins.

const TODAY = "2026-10-23"
const day = (n: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)
let n = 0
const job = (phone: string, date: string, o: Partial<Job> & { price?: number } = {}): Job => {
  const price = o.price ?? 4000
  return {
    id: `MJ-${++n}`,
    createdAt: `${date}T08:00:00Z`,
    date,
    window: "3–5 pm",
    area: "dha",
    address: "House 1",
    customer: { name: `Customer ${phone.slice(-2)}`, phone },
    items: [{ name: "Full body waxing", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1, unitPrice: price }],
    total: price,
    payment: "cash",
    status: "completed",
    proId: "P-1",
    events: [],
    ...o,
  }
}
const pro = (id: string, o: Partial<Pro> = {}): Pro => ({ id, name: `Pro ${id}`, phone: "03110000000", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: `${day(-200)}T00:00:00Z`, commissionRate: 0.25, ...o })
const settings = (o: Partial<PilotSettings> = {}): PilotSettings => ({ ...DEFAULT_PILOT, ...o })
const run = (o: Partial<PilotInput> & Pick<PilotInput, "jobs">) => pilotGates({ pros: [pro("P-1"), pro("P-2"), pro("P-3")], today: TODAY, from: day(-29), to: TODAY, settings: settings(), margins: new Map(), openLeaks: 0, ...o })
const gate = (r: ReturnType<typeof run>, key: string) => r.gates.find((g) => g.key === key)!

describe("spend over a range", () => {
  it("shares each month's spend out by the days of it in the range, and counts months not entered", () => {
    const months = { "2026-09": { marketing: 30_000, transport: 0, by: "f", at: "" }, "2026-10": { marketing: 31_000, transport: 0, by: "f", at: "" } }
    // 24 Sep to 23 Oct: 7 of September's 30 days and 23 of October's 31.
    expect(spendIn(months, "2026-09-24", "2026-10-23", "marketing")).toEqual({ total: 7000 + 23000, missing: 0 })
    expect(spendIn(months, "2026-08-20", "2026-09-10", "marketing").missing).toBe(1)
  })
})

describe("the pilot gates", () => {
  it("says too early, or asks for the inputs, before there is enough to judge", () => {
    const r = run({ jobs: [job("03000000001", day(-3))] })
    expect(gate(r, "costPerCustomer").status).toBe("input")
    expect(gate(r, "contribution").status).toBe("input")
    for (const k of ["secondBooking", "visitsPerProDay", "proRetention", "basket", "leakage"]) expect(gate(r, k).status).toBe("early")
    expect(r.measured).toBe(0)
  })

  it("measures cost per paying customer from the ad spend and first paid visits", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => job(`0300000010${i}`, day(-i)))
    // An older customer's visit in the range doesn't make a new paying customer.
    jobs.push(job("03000000200", day(-100)), job("03000000200", day(-2)))
    const months = { "2026-09": { marketing: 12_000, transport: 0, by: "f", at: "" }, "2026-10": { marketing: 12_400, transport: 0, by: "f", at: "" } }
    const r = run({ jobs, settings: settings({ months }) })
    const g = gate(r, "costPerCustomer")
    // 24 Sep–23 Oct: 7/30 × 12,000 + 23/31 × 12,400 = 2,800 + 9,200 = 12,000 over 10 new customers.
    expect(g).toMatchObject({ value: 1200, status: "pass" })
    const dearer = settings({ months: { ...months, "2026-10": { ...months["2026-10"], marketing: 31_000 } } })
    expect(gate(run({ jobs, settings: dearer }), "costPerCustomer").status).toBe("fail")
  })

  it("counts a second booking within 90 days for customers whose first visit is 60+ days old", () => {
    const jobs: Job[] = []
    for (let i = 0; i < 10; i++) jobs.push(job(`0301000000${i}`, day(-70 - i)))
    // 4 of the 10 came back within 90 days; one more only after 90 days (doesn't count); one cancelled.
    for (let i = 0; i < 4; i++) jobs.push(job(`0301000000${i}`, day(-30)))
    jobs.push(job("03010000004", day(-70 - 4 + 95)))
    jobs.push(job("03010000005", day(-40), { status: "cancelled" }))
    // A newer customer (first visit 20 days ago) isn't in the cohort yet.
    jobs.push(job("03019999999", day(-20)))
    const g = gate(run({ jobs }), "secondBooking")
    expect(g).toMatchObject({ value: 0.4, status: "pass" })
    expect(g.detail).toContain("4 of 10")
    jobs.push(job("03010000006", day(-10)))
    expect(gate(run({ jobs }), "secondBooking").status).toBe("stretch")
  })

  it("checks visits per pro-day, the average basket and pros still working at day 90", () => {
    const jobs: Job[] = []
    // P-1 and P-2 started 120 days ago; P-1 still works, P-2 stopped; P-3 started 100 days ago and works.
    jobs.push(job("03020000001", day(-120), { proId: "P-1" }), job("03020000002", day(-120), { proId: "P-2" }), job("03020000003", day(-100), { proId: "P-3" }))
    jobs.push(job("03020000004", day(-60), { proId: "P-2" }))
    // In the last 30 days: P-1 and P-3 do 2 visits a day on 3 days each, at PKR 3,500.
    for (const p of ["P-1", "P-3"]) for (const d of [-1, -5, -9]) jobs.push(job(`0302${p.slice(-1)}00${-d}1`, day(d), { proId: p, price: 3500 }), job(`0302${p.slice(-1)}00${-d}2`, day(d), { proId: p, price: 3500 }))
    const r = run({ jobs })
    expect(gate(r, "visitsPerProDay")).toMatchObject({ value: 2, status: "pass" })
    expect(gate(r, "basket")).toMatchObject({ value: 3500, status: "pass" })
    const ret = gate(r, "proRetention")
    expect(ret.value).toBeCloseTo(2 / 3)
    expect(ret.status).toBe("fail")
    // Paused pros aren't "still active", however recent their last visit.
    expect(gate(run({ jobs, pros: [pro("P-1"), pro("P-2"), pro("P-3", { status: "paused" })] }), "proRetention").value).toBeCloseTo(1 / 3)
  })

  it("weighs the leakage watch's open flags against the regular pairs", () => {
    const jobs: Job[] = []
    for (let c = 0; c < 10; c++) for (const d of [-150, -120, -90]) jobs.push(job(`030300000${String(c).padStart(2, "0")}`, day(d)))
    expect(gate(run({ jobs, openLeaks: 1 }), "leakage")).toMatchObject({ value: 0.1, status: "pass" })
    expect(gate(run({ jobs, openLeaks: 3 }), "leakage").status).toBe("fail")
  })

  it("works out the contribution per visit from the ledger's margin, sales tax inside the price and transport", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => job(`0304000000${i}`, day(-i - 1), { price: 4000 }))
    const margins = new Map(jobs.map((j) => [j.id, 1000])) // the ledger: PKR 1,000 commission each
    const months = { "2026-09": { marketing: 0, transport: 0, by: "f", at: "" }, "2026-10": { marketing: 0, transport: 3100, by: "f", at: "" } }
    // Transport: 23/31 × 3,100 = 2,300 over 10 visits = 230 a visit. No tax yet: 1,000 − 230.
    expect(gate(run({ jobs, margins, settings: settings({ months }) }), "contribution")).toMatchObject({ value: 770, status: "pass" })
    // 8% inside a PKR 4,000 price (Mjazo as principal): 296 a visit.
    expect(gate(run({ jobs, margins, settings: settings({ months, taxRate: 0.08 }) }), "contribution").value).toBe(1000 - 296 - 230)
    // As agent, only on its PKR 1,000: 74.
    expect(gate(run({ jobs, margins, settings: settings({ months, taxRate: 0.08, taxBase: "commission" }) }), "contribution").value).toBe(1000 - 74 - 230)
    // 15% inside the price (PKR 522) wipes out a thinner PKR 700 margin.
    const thin = new Map(jobs.map((j) => [j.id, 700]))
    expect(gate(run({ jobs, margins: thin, settings: settings({ months, taxRate: 0.15 }) }), "contribution")).toMatchObject({ value: 700 - 522 - 230, status: "fail" })
    // Added on top of the price, the customer pays it: no effect on the margin.
    expect(gate(run({ jobs, margins, settings: settings({ months, taxRate: 0.15, taxInclusive: false }) }), "contribution").value).toBe(770)
    // Without a ledger entry, the margin is the total less the pro's share (75% of PKR 4,000).
    expect(gate(run({ jobs, settings: settings({ months }) }), "contribution").value).toBe(4000 - 3000 - 230)
  })

  it("counts the sales tax a visit really carried once, and models only the others", () => {
    const months = { "2026-09": { marketing: 0, transport: 0, by: "f", at: "" }, "2026-10": { marketing: 0, transport: 3100, by: "f", at: "" } }
    // 8% inside the price, charged for real: the ledger's margin is already after the PKR 296.
    const taxed = Array.from({ length: 10 }, (_, i) => job(`0305000000${i}`, day(-i - 1), { tax: { amount: 296, rate: 0.08, inclusive: true, base: "total" } }))
    const margins = new Map(taxed.map((j) => [j.id, 1000 - 296]))
    const r = run({ jobs: taxed, margins, settings: settings({ months, taxRate: 0.15 }) }) // the pilot's 15% is ignored for them
    expect(gate(r, "contribution").value).toBe(1000 - 296 - 230)
    expect(r.perVisit).toMatchObject({ net: 1000, tax: 296 })
    // Added on top, the customer paid it: the total carries it, Mjazo's margin doesn't.
    const onTop = taxed.map((j) => ({ ...j, total: 4320, tax: { amount: 320, rate: 0.08, inclusive: false, base: "total" as const } }))
    expect(gate(run({ jobs: onTop, settings: settings({ months }) }), "contribution").value).toBe(4000 - 3000 - 230)
  })
})
