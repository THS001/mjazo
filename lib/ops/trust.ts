// Trust Desk, Phase 3: quality drift per pro, leakage watch (regular customer–pro pairs that
// went quiet), and the morning digest. Pure functions over jobs/pros/complaints so they're easy
// to test and to reuse in the ops "Ask AI" tools.

import { arrivalEnd, jobMinutes, paymentNeedsCheck, type OpsCatalog } from "./logic"
import type { Complaint, Job, Pro } from "./types"

const DAY = 86400000
const dayNum = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY)
const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a)
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const first = (n: string) => n.split(" ")[0]
const evAt = (j: Job, t: string) => j.events.filter((e) => e.type === t).map((e) => e.at).sort().slice(-1)[0]

export const BAD_TAGS = ["Late", "Rushed", "Messy", "Price changed", "Not what I asked for"]

// ---------------------------------------------------------------------------------------------
// Quality drift
// ---------------------------------------------------------------------------------------------

type Window = { visits: number; rated: number; avg: number | null; low: number; complaints: number; timed: number; late: number; rushed: number; payIssues: number; badTags: Record<string, number> }

function measure(jobs: Job[], complaintsByJob: Map<string, number>, cat: OpsCatalog): Window {
  const done = jobs.filter((j) => j.status === "completed")
  const rated = done.filter((j) => j.rating)
  const w: Window = { visits: done.length, rated: rated.length, avg: rated.length ? rated.reduce((s, j) => s + j.rating!.stars, 0) / rated.length : null, low: rated.filter((j) => j.rating!.stars <= 2).length, complaints: 0, timed: 0, late: 0, rushed: 0, payIssues: 0, badTags: {} }
  for (const j of done) {
    w.complaints += complaintsByJob.get(j.id) ?? 0
    if (paymentNeedsCheck(j)) w.payIssues++
    for (const t of j.rating?.tags ?? []) if (BAD_TAGS.includes(t)) w.badTags[t] = (w.badTags[t] ?? 0) + 1
    const inAt = evAt(j, "checked_in")
    const outAt = evAt(j, "checked_out")
    if (!inAt) continue
    // Late: checked in more than 15 minutes after the arrival window closed (Karachi time).
    const windowEnd = Date.parse(`${j.date}T00:00:00+05:00`) + (arrivalEnd(j) + 15) * 60000
    if (Date.parse(inAt) > windowEnd) w.late++
    if (outAt) {
      w.timed++
      if ((Date.parse(outAt) - Date.parse(inAt)) / 60000 < jobMinutes(j, cat) * 0.6) w.rushed++
    }
  }
  return w
}

export type QualitySignal = { key: string; label: string; detail: string; severity: "watch" | "act" }
export type ProQuality = { proId: string; name: string; area: string; recent: Window; baseline: Window; signals: QualitySignal[]; level: "ok" | "watch" | "act"; coaching: string }

const COACH: Record<string, string> = {
  rating: "Book a shadow visit with a senior pro and go through recent feedback together.",
  low: "Call the customers who rated low, then do a short coaching session on what went wrong.",
  complaints: "Review the complaints with the pro before their next visit.",
  late: "Check the route and travel: Route Brain may be giving this pro too many far-apart visits.",
  rushed: "Visits are much shorter than the service time: refresh the service protocol and check the daily load.",
  price: "A customer said the price changed at the door: confirm the pro only charges catalogue prices and logs extras first.",
  pay: "Several payments didn't match: walk through how to record cash and screenshots.",
}

/** Last 14 days vs the 6 weeks before; flags only with enough visits to mean something. */
export function qualityReport(jobs: Job[], pros: Pro[], complaints: Complaint[], today: string, cat: OpsCatalog): ProQuality[] {
  const recentFrom = shift(today, -13)
  const baseFrom = shift(today, -55)
  const complaintsByJob = new Map<string, number>()
  for (const c of complaints) complaintsByJob.set(c.bookingId, (complaintsByJob.get(c.bookingId) ?? 0) + 1)
  return pros
    .map((p) => {
      const mine = jobs.filter((j) => j.proId === p.id && j.date <= today)
      const recent = measure(mine.filter((j) => j.date >= recentFrom), complaintsByJob, cat)
      const baseline = measure(mine.filter((j) => j.date >= baseFrom && j.date < recentFrom), complaintsByJob, cat)
      const s: QualitySignal[] = []
      if (recent.avg !== null && baseline.avg !== null && recent.rated >= 3 && baseline.rated >= 3 && baseline.avg - recent.avg >= 0.5)
        s.push({ key: "rating", label: "Ratings dropping", detail: `${recent.avg.toFixed(1)}★ over ${recent.rated} ratings, down from ${baseline.avg.toFixed(1)}★`, severity: baseline.avg - recent.avg >= 0.8 ? "act" : "watch" })
      if (recent.low >= 2) s.push({ key: "low", label: "Low ratings", detail: `${recent.low} visits rated 2★ or less in 14 days`, severity: "act" })
      if (recent.complaints >= 1) s.push({ key: "complaints", label: "Complaints", detail: `${recent.complaints} complaint${recent.complaints > 1 ? "s" : ""} in 14 days`, severity: recent.complaints >= 2 ? "act" : "watch" })
      if (recent.visits >= 4 && recent.late / recent.visits >= 0.3) s.push({ key: "late", label: "Arriving late", detail: `${recent.late} of ${recent.visits} visits checked in after the window`, severity: recent.late / recent.visits >= 0.5 ? "act" : "watch" })
      if (recent.timed >= 4 && recent.rushed / recent.timed >= 0.3) s.push({ key: "rushed", label: "Visits too short", detail: `${recent.rushed} of ${recent.timed} visits took under 60% of the service time`, severity: "watch" })
      if ((recent.badTags["Price changed"] ?? 0) >= 1) s.push({ key: "price", label: "Price changed at the door", detail: `${recent.badTags["Price changed"]} customer${recent.badTags["Price changed"] > 1 ? "s" : ""} said so`, severity: "act" })
      if (recent.payIssues >= 2) s.push({ key: "pay", label: "Payments not adding up", detail: `${recent.payIssues} visits need a payment check`, severity: "watch" })
      const level = s.some((x) => x.severity === "act") ? "act" : s.length ? "watch" : "ok"
      return { proId: p.id, name: p.name, area: cat.areas.find((a) => a.slug === p.area)?.name ?? p.area, recent, baseline, signals: s, level, coaching: s.map((x) => COACH[x.key]).filter(Boolean).join(" ") } as ProQuality
    })
    .sort((a, b) => ({ act: 0, watch: 1, ok: 2 })[a.level] - ({ act: 0, watch: 1, ok: 2 })[b.level] || b.recent.visits - a.recent.visits)
}

// ---------------------------------------------------------------------------------------------
// Leakage watch
// ---------------------------------------------------------------------------------------------

export type LeakState = { id: string; status: "checked_in" | "dismissed"; at: string; note?: string }
export type LeakFlag = {
  key: string
  customer: string
  phone: string
  area: string
  proId: string
  proName: string
  visits: number
  gapDays: number
  lastDate: string
  daysSince: number
  proVisitsSince: number
  proVisitsInAreaSince: number
  signals: string[]
  checkIn: string
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/**
 * A regular pair (3+ visits together, mostly with this pro) where the customer has gone quiet for
 * well past their usual gap, while the pro kept working, often nearby. Never an accusation: the
 * output is a friendly check-in for a person to send.
 */
export function leakageWatch(jobs: Job[], pros: Pro[], today: string, states: LeakState[], cat: OpsCatalog): LeakFlag[] {
  const since = shift(today, -180)
  const byCustomer = new Map<string, Job[]>()
  for (const j of jobs) byCustomer.set(j.customer.phone, [...(byCustomer.get(j.customer.phone) ?? []), j])
  const state = new Map(states.map((s) => [s.id, s]))
  const out: LeakFlag[] = []
  for (const [phone, all] of byCustomer) {
    if (all.some((j) => j.date >= today && j.status !== "cancelled" && j.status !== "completed")) continue // already booked again
    const done = all.filter((j) => j.status === "completed" && j.date >= since && j.date < today).sort((a, b) => a.date.localeCompare(b.date))
    if (done.length < 3) continue
    const counts = new Map<string, number>()
    for (const j of done) if (j.proId) counts.set(j.proId, (counts.get(j.proId) ?? 0) + 1)
    const [proId, together] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
    if (!proId || together < 3 || together / done.length < 0.6) continue
    const gaps = done.slice(1).map((j, i) => daysBetween(done[i].date, j.date)).filter((g) => g > 0)
    const gap = Math.max(7, Math.round(median(gaps.length ? gaps : [30])))
    const last = done[done.length - 1]
    const daysSince = daysBetween(last.date, today)
    if (daysSince <= Math.max(gap * 1.8, gap + 21)) continue
    const proJobsSince = jobs.filter((j) => j.proId === proId && j.status === "completed" && j.date > last.date && j.date <= today)
    if (proJobsSince.length < 3) continue // the pro also went quiet: not a leakage pattern
    const key = `${phone}|${proId}`
    const st = state.get(key)
    if (st && (st.status === "dismissed" ? st.at.slice(0, 10) >= last.date : daysBetween(st.at.slice(0, 10), today) < 30)) continue
    const inArea = proJobsSince.filter((j) => j.area === last.area).length
    const cancelledAfter = all.some((j) => j.status === "cancelled" && j.date > last.date)
    const pro = pros.find((p) => p.id === proId)
    const signals = [
      `${together} visits together, usually every ~${gap} days`,
      `No booking for ${daysSince} days (${Math.round(daysSince / gap)}× their usual gap)`,
      `${first(pro?.name ?? "The pro")} completed ${proJobsSince.length} visits since${inArea ? `, ${inArea} in ${cat.areas.find((a) => a.slug === last.area)?.name ?? last.area}` : ""}`,
      ...(cancelledAfter ? ["Cancelled a booking after the last visit"] : []),
      ...(st?.status === "checked_in" ? ["Checked in before, no reply or rebooking since"] : []),
    ]
    out.push({
      key,
      customer: last.customer.name,
      phone,
      area: cat.areas.find((a) => a.slug === last.area)?.name ?? last.area,
      proId,
      proName: pro?.name ?? proId,
      visits: together,
      gapDays: gap,
      lastDate: last.date,
      daysSince,
      proVisitsSince: proJobsSince.length,
      proVisitsInAreaSince: inArea,
      signals,
      checkIn: `Assalam o Alaikum ${first(last.customer.name)}! This is Mjazo. It's been a while since ${first(pro?.name ?? "your pro")}'s last visit and we wanted to check everything was okay. If anything wasn't right, just tell us and we'll make it right. Whenever you'd like ${first(pro?.name ?? "them")} again, reply here and we'll book the visit for you.`,
    })
  }
  return out.sort((a, b) => b.daysSince / b.gapDays - a.daysSince / a.gapDays)
}

// ---------------------------------------------------------------------------------------------
// Morning digest
// ---------------------------------------------------------------------------------------------

export type Digest = { lines: string[]; counts: { unpaid: number; matched: number; toCheck: number; complaints: number; drafts: number; lowRatings: number; quality: number; leakage: number; weddings: number } }

export function morningDigest(jobs: Job[], complaints: Complaint[], quality: ProQuality[], leakage: LeakFlag[], today: string, nowIso: string, weddingsPending = 0): Digest {
  const recent = jobs.filter((j) => j.status === "completed" && j.date >= shift(today, -13) && j.date <= today)
  const unpaid = recent.filter((j) => !j.paymentRecord).length
  const dayAgo = Date.parse(nowIso) - DAY
  const matched = recent.filter((j) => j.paymentRecord?.status === "matched" && Date.parse(j.paymentRecord.at) >= dayAgo).length
  const toCheck = recent.filter((j) => j.paymentRecord && paymentNeedsCheck(j)).length
  const open = complaints.filter((c) => c.status !== "resolved")
  const drafts = open.filter((c) => c.status === "draft_ready").length
  const lowRatings = jobs.filter((j) => j.rating && j.rating.stars <= 2 && Date.parse(j.rating.at) >= Date.parse(nowIso) - 7 * DAY).length
  const q = quality.filter((x) => x.level === "act").length
  const counts = { unpaid, matched, toCheck, complaints: open.length, drafts, lowRatings, quality: q, leakage: leakage.length, weddings: weddingsPending }
  const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`
  const lines = [
    `${n(unpaid, "visit")} unpaid, ${n(matched, "payment screenshot")} matched, ${n(toCheck, "payment")} to check.`,
    open.length ? `${n(open.length, "open complaint")}${drafts ? `, ${drafts} with a drafted resolution ready to approve` : ""}.` : "No open complaints.",
    lowRatings ? `${n(lowRatings, "low rating")} (2★ or less) this week.` : "",
    q ? `${n(q, "pro")} need a quality conversation.` : "",
    leakage.length ? `${n(leakage.length, "regular pair")} went quiet while the pro stayed busy: a friendly check-in is drafted.` : "",
    weddingsPending ? `${n(weddingsPending, "wedding plan")} waiting for coordinator approval.` : "",
  ].filter(Boolean)
  return { lines, counts }
}
