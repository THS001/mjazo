import { describe, expect, it } from "vitest"
import { DEFAULT_MINIMUM, isWholeWeek, minimumProblems, minimumWeek, openWindows, weekStartOf } from "./minimum"
import type { Pro } from "./types"

// Pros' weekly minimum, the pure rules: whole weeks, her open windows, the conditions and the top-up.

const verified = Object.fromEntries(["cnic", "references", "address", "practical", "training", "conduct"].map((k) => [k, { by: "ops@mjazo.test", at: "2026-09-01T00:00:00Z" }])) as Pro["verification"]
const pro = { status: "active" as const, createdAt: "2026-10-01T08:00:00Z", verification: verified }
const on = { ...DEFAULT_MINIMUM, on: true }
const week = (o: Partial<Parameters<typeof minimumWeek>[1]> = {}) => minimumWeek(on, { pro, weekStart: "2026-10-19", earned: 6500, windows: 24, offersMade: 5, offersAccepted: 4, ...o })

describe("pros' weekly minimum", () => {
  it("runs Monday to Sunday", () => {
    expect(weekStartOf("2026-10-25")).toBe("2026-10-19") // a Sunday
    expect(weekStartOf("2026-10-19")).toBe("2026-10-19")
    expect(isWholeWeek("2026-10-19", "2026-10-25")).toBe(true)
    expect(isWholeWeek("2026-10-20", "2026-10-26")).toBe(false)
    expect(isWholeWeek("2026-10-19", "2026-10-31")).toBe(false)
  })

  it("counts her open windows from her weekly hours, less her days off", () => {
    const hours = { availability: { "1": ["9–11 am", "11 am–1 pm"], "3": ["9–11 am", "11 am–1 pm", "1–3 pm"], "6": ["3–5 pm"] } }
    expect(openWindows(hours, "2026-10-19", [], 6)).toBe(6)
    expect(openWindows(hours, "2026-10-19", ["2026-10-21"], 6)).toBe(3) // Wednesday off
    expect(openWindows({}, "2026-10-19", ["2026-10-19", "2026-10-20"], 6)).toBe(30) // no hours set: every window
  })

  it("counts the fewest windows she had open each day: closing for the week and opening again before the run counts as closed", () => {
    const closed = { "0": [] as string[] } // no windows on any day
    const flip = [
      { at: "2026-10-19T10:00:00+05:00", before: null, after: closed },
      { at: "2026-10-25T22:00:00+05:00", before: closed, after: null },
    ]
    expect(openWindows({}, "2026-10-19", [], 6, flip)).toBe(0)
    // More windows from Wednesday noon: Monday and Tuesday had what she had then, Wednesday counts
    // the fewer, Thursday on has every window.
    const more = [{ at: "2026-10-21T12:00:00+05:00", before: { "1": ["9–11 am", "11 am–1 pm"] }, after: null }]
    expect(openWindows({}, "2026-10-19", [], 6, more)).toBe(2 + 0 + 0 + 4 * 6)
  })

  it("tops up what she earned to the minimum when she meets every condition", () => {
    expect(week()).toMatchObject({ eligible: true, topUp: 3500, checks: { verified: true, fullWeek: true, firstWeeks: true, windows: true, offers: true } })
    expect(week({ earned: 12000 }).topUp).toBe(0)
    expect(week({ offersMade: 0, offersAccepted: 0 }).eligible).toBe(true) // nothing offered: nothing turned down
  })

  it("not when a condition fails, or it's switched off", () => {
    expect(week({ windows: 9 })).toMatchObject({ eligible: false, topUp: 0, checks: { windows: false } })
    expect(week({ offersAccepted: 3 }).checks.offers).toBe(false) // 60%
    expect(week({ pro: { ...pro, verification: {} } }).checks.verified).toBe(false)
    expect(week({ pro: { ...pro, status: "paused" } }).checks.verified).toBe(false)
    expect(week({ pro: { ...pro, createdAt: "2026-10-21T08:00:00Z" } })).toMatchObject({ eligible: false, checks: { fullWeek: false, firstWeeks: true } }) // joined mid-week
    expect(week({ weekStart: "2026-12-28" }).checks.firstWeeks).toBe(false) // past her first 12 weeks
    expect(minimumWeek({ ...on, weeks: 0 }, { pro, weekStart: "2027-06-07", earned: 0, windows: 20, offersMade: 0, offersAccepted: 0 }).topUp).toBe(10000)
    expect(minimumWeek(DEFAULT_MINIMUM, { pro, weekStart: "2026-10-19", earned: 0, windows: 20, offersMade: 0, offersAccepted: 0 })).toMatchObject({ eligible: false, topUp: 0 })
  })

  it("checks what Finance types", () => {
    expect(minimumProblems({ amount: 10000, weeks: 12, minWindows: 10, minAcceptance: 0.8 })).toEqual([])
    expect(minimumProblems({ amount: -1 })).toHaveLength(1)
    expect(minimumProblems({ amount: 999.5 })).toHaveLength(1)
    expect(minimumProblems({ minWindows: 43 })).toHaveLength(1)
    expect(minimumProblems({ minAcceptance: 1.2 })).toHaveLength(1)
  })
})
