import { describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import type { Job, Pro } from "@/lib/ops/types"
import { WINDOW_LABELS } from "@/lib/time"
import { slots, windowOpen, windowsForDay } from "./capacity"

const cat = buildCatalog(DEFAULT_CATALOG)
const DAY = "2030-03-12" // far enough ahead that the lead time never matters
const wax = (qty = 1) => [{ name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty, unitPrice: 4500 }]
const need = { area: "dha", items: wax() }
const pro = (id: string, over: Partial<Pro> = {}): Pro => ({ id, name: id, phone: "0300", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: "", ...over })
let n = 0
const job = (window: string, over: Partial<Job> = {}): Job => ({ id: `J${++n}`, createdAt: "", date: DAY, window, area: "dha", address: "x", customer: { name: "c", phone: `03${n}` }, items: wax(), total: 4500, payment: "cash", status: "new", events: [], ...over })
const openLabels = (w: { label: string; open: boolean }[]) => w.filter((x) => x.open).map((x) => x.label)

describe("slot capacity", () => {
  it("leaves every window open, for the team to confirm, when nobody can do the job yet", () => {
    const r = slots([DAY], [], [pro("P1", { skills: ["ac-services"] })], need, cat, 2)
    expect(r.mode).toBe("open")
    expect(openLabels(r.days[0].windows)).toEqual(WINDOW_LABELS)
  })

  it("opens every window on an empty day", () => {
    const r = slots([DAY], [], [pro("P1")], need, cat, 2)
    expect(r.mode).toBe("capacity")
    expect(openLabels(r.days[0].windows)).toEqual(WINDOW_LABELS)
  })

  it("closes the day once every pro is at her daily limit", () => {
    const jobs = WINDOW_LABELS.slice(0, 5).map((w) => job(w))
    expect(openLabels(windowsForDay(DAY, jobs, [pro("P1")], need, cat))).toEqual([])
    // A second pro opens it again.
    expect(openLabels(windowsForDay(DAY, jobs, [pro("P1"), pro("P2")], need, cat))).toEqual(WINDOW_LABELS)
  })

  it("closes windows a long visit runs through, and reopens once she can get there", () => {
    // Two full body waxes from 9 am: four hours, so she's busy until 1 pm.
    const jobs = [job("9–11 am", { items: wax(2) })]
    expect(openLabels(windowsForDay(DAY, jobs, [pro("P1")], need, cat))).toEqual(["1–3 pm", "3–5 pm", "5–7 pm", "7–9 pm"])
  })

  it("never counts cancelled or no-show visits, or other days", () => {
    const jobs = [job("9–11 am", { items: wax(2), status: "cancelled" }), job("9–11 am", { items: wax(2), status: "no_show" }), job("9–11 am", { items: wax(2), date: "2030-03-13" })]
    expect(openLabels(windowsForDay(DAY, jobs, [pro("P1")], need, cat))).toEqual(WINDOW_LABELS)
  })

  it("respects women-only categories and paused pros", () => {
    expect(slots([DAY], [], [pro("P1", { women: false }), pro("P2", { status: "paused" })], need, cat, 2).mode).toBe("open")
  })

  it("checks a single window when the booking is placed", () => {
    const jobs = [job("9–11 am", { items: wax(2) })]
    expect(windowOpen(DAY, "11 am–1 pm", jobs, [pro("P1")], need, cat)).toBe(false)
    expect(windowOpen(DAY, "3–5 pm", jobs, [pro("P1")], need, cat)).toBe(true)
  })
})
