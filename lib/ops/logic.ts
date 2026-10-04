// Pure ops logic: travel times, Route Brain, gap-fill, Safety Guardian, demand forecast.
// No I/O here, so it is easy to test and reuse on the server and in the browser.

import type { Catalog } from "@/lib/catalog"
import { WINDOW_HOURS, WINDOW_LABELS } from "@/lib/time"
import type { Job, Pro, SafetyStatus } from "./types"

/** The catalogue lookups ops logic needs (pass getCatalog() on the server, useCatalog() in the browser). */
export type OpsCatalog = Pick<Catalog, "getService" | "getCategory" | "areas">

export const OPS = {
  maxJobsPerPro: 5,
  proShare: 0.75, // PLACEHOLDER: share of the service price paid to the pro (confirm with founder)
  safetyBufferMin: 30, // grace after the expected finish before checking on the pro
  pingGraceMin: 10, // no reply to the check-in ping within this many minutes → escalate to ops
  lateArrivalMin: 30, // not checked in this long after the window ends → late
}

// Approximate centre of each neighbourhood (for travel estimates only).
const COORDS: Record<string, [number, number]> = {
  dha: [24.795, 67.064],
  clifton: [24.818, 67.03],
  pechs: [24.868, 67.068],
  bahadurabad: [24.881, 67.071],
  gulshan: [24.921, 67.096],
  jauhar: [24.913, 67.132],
  "north-nazimabad": [24.937, 67.041],
  bahria: [25.028, 67.309],
}

/** Driving minutes between two neighbourhoods: road distance ≈ 1.35× straight line at ~20 km/h, plus parking. */
export function travelMinutes(a: string, b: string) {
  if (a === b) return 15
  const p = COORDS[a]
  const q = COORDS[b]
  if (!p || !q) return 45
  const R = 6371
  const dLat = ((q[0] - p[0]) * Math.PI) / 180
  const dLng = ((q[1] - p[1]) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((p[0] * Math.PI) / 180) * Math.cos((q[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const km = 2 * R * Math.asin(Math.sqrt(h)) * 1.35
  return Math.round((km / 20) * 60 + 10)
}

export const jobMinutes = (job: Job, cat: OpsCatalog) =>
  job.event
    ? job.event.people.reduce((s, p) => s + hm(p.end) - hm(p.start), 0) || 60
    : job.items.reduce((s, i) => s + (cat.getService(i.category, i.service)?.service.duration ?? 60) * i.qty, 0) || 60
export const windowIndex = (w: string) => Math.max(0, WINDOW_LABELS.indexOf(w))
export const windowStartMin = (w: string) => WINDOW_HOURS[windowIndex(w)] * 60
const hm = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5)
/** Start of the arrival window; Shaadi event visits have a fixed arrival time instead. */
export const arrivalStart = (j: Job) => (j.event && j.eta ? hm(j.eta) : windowStartMin(j.window))
/** Latest acceptable arrival: end of the window, or the fixed arrival time for event visits. */
export const arrivalEnd = (j: Job) => (j.event && j.eta ? hm(j.eta) : windowStartMin(j.window) + 120)
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`

export function jobCategories(job: Job) {
  return [...new Set(job.items.map((i) => i.category))]
}
export function needsWoman(job: Job, cat: OpsCatalog) {
  return jobCategories(job).some((c) => cat.getCategory(c)?.proType === "women")
}
export function eligible(pro: Pro, job: Job, cat: OpsCatalog) {
  if (pro.status !== "active") return false
  if (needsWoman(job, cat) && !pro.women) return false
  return jobCategories(job).every((c) => pro.skills.includes(c))
}

const LOCKED = ["en_route", "checked_in", "checked_out"]

export type Stop = { jobId: string; area: string; window: string; eta: string; travelMin: number; durationMin: number }
export type RoutePlan = { byPro: Record<string, Stop[]>; unassigned: { jobId: string; reason: string }[]; travelTotal: number; perProDay: number }

/**
 * Route Brain: assign the day's open jobs to pros. Greedy by window start; for each job pick the
 * eligible pro with the lowest cost (travel + waiting + load), only if they can reach it inside
 * its arrival window. Repeat customers prefer the pro who served them before.
 */
export function planRoutes(jobs: Job[], pros: Pro[], history: Job[], cat: OpsCatalog): RoutePlan {
  const open = jobs.filter((j) => j.status !== "cancelled" && j.status !== "completed").sort((a, b) => arrivalStart(a) - arrivalStart(b))
  const state = new Map<string, { lastArea: string; lastEnd: number; stops: Stop[] }>()
  for (const p of pros) state.set(p.id, { lastArea: p.area, lastEnd: 0, stops: [] })
  const previousPro = new Map<string, string>()
  for (const h of history) if (h.proId && h.status === "completed") previousPro.set(h.customer.phone, h.proId)

  const unassigned: RoutePlan["unassigned"] = []
  let travelTotal = 0
  for (const job of open) {
    const ws = arrivalStart(job)
    const we = arrivalEnd(job)
    const dur = jobMinutes(job, cat)
    // Jobs already under way stay with their pro; everything else is (re)planned.
    const locked = Boolean(job.proId && LOCKED.includes(job.status))
    let best: { pro: Pro; start: number; travel: number; cost: number } | null = null
    let reason = locked ? "Its pro is no longer listed" : "No active pro has the right skills"
    for (const pro of pros) {
      if (locked ? pro.id !== job.proId : !eligible(pro, job, cat)) continue
      const st = state.get(pro.id)!
      if (!locked && st.stops.length >= OPS.maxJobsPerPro) {
        reason = "All suitable pros are fully booked"
        continue
      }
      const travel = st.stops.length ? travelMinutes(st.lastArea, job.area) : travelMinutes(pro.area, job.area)
      const start = Math.max(ws, st.lastEnd + travel)
      if (start > we && !locked) {
        reason = job.event ? "No suitable pro is free at the fixed arrival time" : "No suitable pro can reach it within the window"
        continue
      }
      const cost = travel + (start - ws) * 0.3 + st.stops.length * 12 - (previousPro.get(job.customer.phone) === pro.id ? 40 : 0)
      if (!best || cost < best.cost) best = { pro, start, travel, cost }
    }
    if (!best) {
      unassigned.push({ jobId: job.id, reason })
      continue
    }
    const st = state.get(best.pro.id)!
    st.stops.push({ jobId: job.id, area: job.area, window: job.window, eta: hhmm(best.start), travelMin: best.travel, durationMin: dur })
    st.lastArea = job.area
    st.lastEnd = best.start + dur
    travelTotal += best.travel
  }
  const byPro: Record<string, Stop[]> = {}
  for (const [id, st] of state) if (st.stops.length) byPro[id] = st.stops
  const working = Object.keys(byPro).length
  const assigned = Object.values(byPro).reduce((s, x) => s + x.length, 0)
  return { byPro, unassigned, travelTotal, perProDay: working ? +(assigned / working).toFixed(2) : 0 }
}

/** Gap-fill: past customers near a free slot who are due for the same kind of service. */
export function gapFillCandidates(slotJob: Job, history: Job[], today: string, booked: Set<string>) {
  const due: Record<string, number> = { "womens-salon": 25, hair: 35, "nails-lashes": 21, "spa-women": 30, "makeup-mehndi": 60 }
  const cats = jobCategories(slotJob)
  const last = new Map<string, Job>()
  for (const h of history) {
    if (h.status !== "completed" || booked.has(h.customer.phone)) continue
    if (!jobCategories(h).some((c) => cats.includes(c))) continue
    const prev = last.get(h.customer.phone)
    if (!prev || prev.date < h.date) last.set(h.customer.phone, h)
  }
  const days = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000)
  return [...last.values()]
    .map((h) => ({ job: h, daysSince: days(h.date, today), travel: travelMinutes(h.area, slotJob.area) }))
    .filter((c) => c.travel <= 30 && c.daysSince >= (due[cats[0]] ?? 90))
    .sort((a, b) => a.travel - b.travel || b.daysSince - a.daysSince)
    .slice(0, 5)
}

/** Safety Guardian: classify a job's safety state at `now` (Karachi minutes since midnight on the job date). */
export function safetyStatus(job: Job, nowIso: string, cat: OpsCatalog): SafetyStatus {
  const ev = (t: string) => job.events.filter((e) => e.type === t).map((e) => e.at).sort()
  const lastOf = (t: string) => ev(t).slice(-1)[0]
  const sos = lastOf("sos")
  const safe = lastOf("safe")
  if (sos && (!safe || safe < sos)) return { level: "sos", message: "SOS raised by the pro" }
  const checkedIn = lastOf("checked_in")
  const checkedOut = lastOf("checked_out") ?? lastOf("completed")
  const now = new Date(nowIso).getTime()
  if (checkedIn && !checkedOut) {
    const expected = new Date(checkedIn).getTime() + (jobMinutes(job, cat) + OPS.safetyBufferMin) * 60000
    // "I'm safe" buys one more buffer; if the visit runs on after that, the check starts again.
    const due = safe && safe > checkedIn ? Math.max(expected, new Date(safe).getTime() + OPS.safetyBufferMin * 60000) : expected
    if (now > due) {
      const overdue = Math.round((now - expected) / 60000)
      const ping = lastOf("alert_ping")
      const pingT = ping ? new Date(ping).getTime() : 0
      if (pingT >= due && now - pingT > OPS.pingGraceMin * 60000) return { level: "escalated", message: `No reply ${overdue} min past expected finish`, minutes: overdue }
      return { level: "overdue", message: `Check-out ${overdue} min overdue`, minutes: overdue }
    }
  }
  if (!checkedIn && (job.status === "assigned" || job.status === "en_route")) {
    // Window end in Karachi time (UTC+5) on the job date.
    const end = new Date(`${job.date}T00:00:00+05:00`).getTime() + (arrivalEnd(job) + OPS.lateArrivalMin) * 60000
    if (now > end) return { level: "late", message: "Not checked in after the arrival window", minutes: Math.round((now - end) / 60000) }
  }
  return { level: "ok", message: "" }
}

/** Demand forecast: pros needed per area × category from the last 28 days of bookings. */
export function demandForecast(jobs: Job[], pros: Pro[], today: string, cat: OpsCatalog) {
  const since = new Date(new Date(`${today}T00:00:00Z`).getTime() - 28 * 86400000).toISOString().slice(0, 10)
  const counts = new Map<string, number>()
  for (const j of jobs) {
    if (j.date < since || j.status === "cancelled") continue
    for (const c of jobCategories(j)) counts.set(`${j.area}|${c}`, (counts.get(`${j.area}|${c}`) ?? 0) + 1)
  }
  const rows = [...counts.entries()].map(([k, n]) => {
    const [area, category] = k.split("|")
    const perDay = n / 28
    // Pro-days of demand (one decimal). Neighbouring areas share pros, so only a clear shortfall counts as a gap.
    const needed = +((perDay / 3) * 1.25).toFixed(1)
    const have = pros.filter((p) => p.status === "active" && p.area === area && p.skills.includes(category)).length
    return { area, areaName: cat.areas.find((a) => a.slug === area)?.name ?? area, category, categoryName: cat.getCategory(category)?.name ?? category, bookings28d: n, needed, have, gap: Math.max(0, Math.ceil(needed - have - 0.25)) }
  })
  return rows.sort((a, b) => b.gap - a.gap || b.bookings28d - a.bookings28d)
}

export const SKILL_TO_CATEGORIES: Record<string, string[]> = {
  waxing: ["womens-salon"],
  threading: ["womens-salon"],
  facials: ["womens-salon"],
  "mani-pedi": ["womens-salon"],
  hair: ["hair"],
  makeup: ["makeup-mehndi"],
  mehndi: ["makeup-mehndi"],
  "nails-lashes": ["nails-lashes"],
  massage: ["spa-women"],
}

/** Trust Desk: a finished visit needs a human check until its payment is recorded and adds up. */
export function paymentNeedsCheck(job: Job) {
  const r = job.paymentRecord
  if (!r) return true
  if (r.checked) return false
  return ["mismatch", "unreadable", "pending"].includes(r.status) || r.amount !== job.total
}
