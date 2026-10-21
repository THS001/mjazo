import { describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import { windowsForDay } from "@/lib/core/capacity"
import { computeKpis } from "./kpi"
import { planRoutes, unavailableReason } from "./logic"
import type { Job, Pro } from "./types"

// Route Brain (and so checkout capacity) respects what mission control sets: days off, weekly
// windows, the areas a pro covers, her daily cap and zone caps. Plus the KPI dashboard's numbers.

const cat = buildCatalog(DEFAULT_CATALOG)
const DAY = "2026-10-26" // a Monday
const pro = (over: Partial<Pro> = {}): Pro => ({ id: "P-1", name: "Sana", phone: "03111111111", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: "2026-10-01T00:00:00Z", ...over })
let n = 0
const job = (over: Partial<Job> = {}): Job => ({
  id: `J-${++n}`,
  createdAt: "2026-10-20T00:00:00Z",
  date: DAY,
  window: "9–11 am",
  area: "dha",
  address: "x",
  customer: { name: "A", phone: `0300${1000000 + n}` },
  items: [{ name: "Threading", category: "womens-salon", service: "full-face-threading", options: [], addOns: [], qty: 1, unitPrice: 500 }],
  total: 500,
  payment: "cash",
  status: "new",
  events: [],
  ...over,
})

describe("a pro's limits", () => {
  it("says why she can't take a visit", () => {
    expect(unavailableReason(pro(), job())).toBeNull()
    expect(unavailableReason(pro({ timeOff: [DAY] }), job())).toBe("day off")
    expect(unavailableReason(pro({ availability: { "1": ["5–7 pm"] } }), job())).toBe("not working then")
    expect(unavailableReason(pro({ availability: { "2": ["9–11 am"] } }), job())).toBe("not working then")
    expect(unavailableReason(pro({ availability: { "1": ["9–11 am"] } }), job())).toBeNull()
    expect(unavailableReason(pro({ zones: ["clifton"] }), job({ area: "gulshan" }))).toBe("doesn't cover this area")
    expect(unavailableReason(pro({ zones: ["clifton"] }), job({ area: "clifton" }))).toBeNull()
    expect(unavailableReason(pro({ zones: ["clifton"] }), job({ area: "dha" }))).toBeNull() // her home area
  })

  it("keeps Route Brain from planning around them", () => {
    const jobs = [job(), job({ window: "11 am–1 pm" }), job({ window: "1–3 pm" })]
    expect(planRoutes(jobs, [pro()], [], cat).unassigned).toEqual([])
    expect(planRoutes(jobs, [pro({ timeOff: [DAY] })], [], cat).unassigned).toHaveLength(3)
    const capped = planRoutes(jobs, [pro({ dailyCap: 2 })], [], cat)
    expect(capped.byPro["P-1"]).toHaveLength(2)
    expect(capped.unassigned[0].reason).toMatch(/fully booked/)
    const zoneCapped = planRoutes(jobs, [pro()], [], cat, { zoneCaps: { dha: 1 } })
    expect(zoneCapped.unassigned.map((u) => u.reason)).toEqual(["The area is fully booked for the day", "The area is fully booked for the day"])
  })

  it("closes checkout windows she doesn't work", () => {
    const open = windowsForDay(DAY, [], [pro({ availability: { "1": ["9–11 am"] } })], { area: "dha", items: job().items }, cat)
    expect(open.filter((w) => w.open).map((w) => w.label)).toEqual(["9–11 am"])
    const full = windowsForDay(DAY, [job()], [pro()], { area: "dha", items: job().items }, cat, { zoneCaps: { dha: 1 } })
    expect(full.every((w) => !w.open)).toBe(true)
  })
})

describe("KPIs", () => {
  it("counts bookings, completion, GMV, repeat customers and visits per pro-day", () => {
    const a = "03001111111"
    const b = "03002222222"
    const jobs = [
      job({ date: "2026-09-01", status: "completed", customer: { name: "A", phone: a }, proId: "P-1", total: 1000 }), // before the range
      job({ date: "2026-10-01", status: "completed", customer: { name: "A", phone: a }, proId: "P-1", total: 2000 }),
      job({ date: "2026-10-01", status: "completed", customer: { name: "B", phone: b }, proId: "P-1", total: 3000 }),
      job({ date: "2026-10-02", status: "completed", customer: { name: "B", phone: b }, proId: "P-2", total: 1000 }),
      job({ date: "2026-10-02", status: "cancelled" }),
      job({ date: "2026-10-03", status: "no_show" }),
      job({ date: "2026-10-03", status: "assigned" }),
      job({ date: "2026-11-01", status: "completed", total: 9999 }), // after the range
    ]
    const k = computeKpis(jobs, "2026-10-01", "2026-10-03")
    expect(k).toMatchObject({ bookings: 6, completed: 3, cancelled: 1, noShow: 1, completionRate: 0.6, gmv: 6000, avgOrder: 2000, customers: 2, repeatCustomers: 2, repeatRate: 1, proDays: 2, visitsPerProDay: 1.5 })
    expect(k.byDay).toEqual([
      { date: "2026-10-01", bookings: 2, completed: 2, gmv: 5000 },
      { date: "2026-10-02", bookings: 2, completed: 1, gmv: 1000 },
      { date: "2026-10-03", bookings: 2, completed: 0, gmv: 0 },
    ])
    expect(computeKpis([], "2026-10-01", "2026-10-01")).toMatchObject({ completionRate: null, repeatRate: null, visitsPerProDay: null, gmv: 0 })
  })
})
