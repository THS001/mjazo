import { isVerified, type Pro } from "./types"

// Pros' weekly minimum: a pro who kept herself available and took her offers earns at least the
// weekly minimum; Monday's payout run tops up the rest. Finance sets it in mission control → Money →
// Policies (lib/core/policy.ts). Pure, so the rules are easy to test and to show the pro.

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY = 86400_000
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)

export type MinimumPolicy = {
  on: boolean
  /** Whole rupees a week. */
  amount: number
  /** Only in a pro's first weeks with Mjazo (0: always). */
  weeks: number
  /** Arrival windows she's open for in the week (her weekly hours less days off). */
  minWindows: number
  /** Share of the offers made to her that week she accepted (declined and expired count against). */
  minAcceptance: number
}
export const DEFAULT_MINIMUM: MinimumPolicy = { on: false, amount: 10_000, weeks: 12, minWindows: 10, minAcceptance: 0.8 }

export function minimumProblems(p: Partial<MinimumPolicy>): string[] {
  const out: string[] = []
  if (p.amount !== undefined && !(Number.isInteger(p.amount) && p.amount >= 0 && p.amount <= 100_000)) out.push("The weekly minimum is from PKR 0 to 100,000")
  if (p.weeks !== undefined && !(Number.isInteger(p.weeks) && p.weeks >= 0 && p.weeks <= 104)) out.push("Her first 0 to 104 weeks")
  if (p.minWindows !== undefined && !(Number.isInteger(p.minWindows) && p.minWindows >= 0 && p.minWindows <= 42)) out.push("From 0 to 42 open windows a week")
  if (p.minAcceptance !== undefined && !(p.minAcceptance >= 0 && p.minAcceptance <= 1)) out.push("Offers accepted is from 0% to 100%")
  return out
}

/** The Monday a day falls in (weeks run Monday to Sunday). */
export function weekStartOf(day: string) {
  const dow = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7
  return addDays(day, -dow)
}

/** Whether a payout period is one whole week, Monday to Sunday (only those get a top-up). */
export const isWholeWeek = (start: string, end: string) => DATE.test(start) && weekStartOf(start) === start && addDays(start, 6) === end

/** Her weekly hours: weekday ("0" = Sunday) → arrival windows. */
type Hours = Record<string, string[]>
/** A change to her weekly hours (lib/core/pros.ts logs each one): before and after (null: every window, every day). */
export type HoursChange = { at: string; before: Hours | null; after: Hours | null }

/**
 * Her open arrival windows in the week from `weekStart`: her weekly hours on each day, nothing on
 * her days off. A pro with no weekly hours set works every window. Each day counts the fewest she
 * had open at any time that day (`changes`: her changes from the week's start on), so closing for
 * the week and opening again before the run counts as closed.
 */
export function openWindows(pro: Pick<Pro, "availability">, weekStart: string, daysOff: string[], windowsADay: number, changes: HoursChange[] = []) {
  const sorted = [...changes].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const count = (h: Hours | null | undefined, weekday: string) => (h ? (h[weekday]?.length ?? 0) : windowsADay)
  let n = 0
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i)
    if (daysOff.includes(day)) continue
    const from = Date.parse(`${day}T00:00:00+05:00`)
    const to = Date.parse(`${addDays(day, 1)}T00:00:00+05:00`)
    const weekday = String(new Date(`${day}T12:00:00Z`).getUTCDay())
    // Her hours as the day began (what the first later change replaced, or else what she has now),
    // then every change made during the day (Karachi time).
    const next = sorted.find((c) => Date.parse(c.at) >= from)
    const during = sorted.filter((c) => Date.parse(c.at) >= from && Date.parse(c.at) < to).map((c) => c.after)
    n += Math.min(...[next ? next.before : pro.availability, ...during].map((h) => count(h, weekday)))
  }
  return n
}

export type MinimumWeek = {
  weekStart: string
  amount: number
  earned: number
  windows: number
  offers: { made: number; accepted: number }
  /** Each condition she meets (true) or not yet (false). */
  checks: { verified: boolean; fullWeek: boolean; firstWeeks: boolean; windows: boolean; offers: boolean }
  eligible: boolean
  topUp: number
}

/** Her week against the minimum: the conditions, and what Mjazo tops up (0 when she isn't eligible or earned enough). */
export function minimumWeek(p: MinimumPolicy, w: { pro: Pick<Pro, "status" | "createdAt" | "verification">; weekStart: string; earned: number; windows: number; offersMade: number; offersAccepted: number }): MinimumWeek {
  const joined = w.pro.createdAt.slice(0, 10)
  const checks = {
    verified: w.pro.status === "active" && isVerified(w.pro),
    // With Mjazo from the week's Monday (the week she joins in doesn't count)...
    fullWeek: joined <= w.weekStart,
    // ...and still in her first weeks.
    firstWeeks: p.weeks === 0 || w.weekStart < addDays(joined, p.weeks * 7),
    windows: w.windows >= p.minWindows,
    offers: w.offersMade === 0 || w.offersAccepted / w.offersMade >= p.minAcceptance - 1e-9,
  }
  const eligible = p.on && p.amount > 0 && Object.values(checks).every(Boolean)
  return { weekStart: w.weekStart, amount: p.amount, earned: w.earned, windows: w.windows, offers: { made: w.offersMade, accepted: w.offersAccepted }, checks, eligible, topUp: eligible ? Math.max(0, p.amount - w.earned) : 0 }
}
