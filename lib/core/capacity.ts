import type { Job, Pro } from "@/lib/ops/types"
import { eligible, planRoutes, type OpsCatalog } from "@/lib/ops/logic"
import { WINDOW_LABELS, windowAvailable } from "@/lib/time"

// Slot capacity. A window is open for a new booking only if Route Brain (the same planner ops
// uses to dispatch) can still fit it in that day without dropping a job that already fits.
// When no active pro could do the booking at all (a category with no pros onboarded yet),
// capacity is unknown: every window stays open and the team confirms by hand ("open" mode).

export type SlotNeed = { area: string; items: Job["items"] }
export type DaySlots = { date: string; windows: { label: string; open: boolean }[] }
export type SlotMode = "capacity" | "open"

const CANDIDATE = "__candidate"
const busy = (j: Job) => j.status !== "cancelled" && j.status !== "no_show"

function candidate(need: SlotNeed, date: string, window: string): Job {
  return { id: CANDIDATE, createdAt: new Date().toISOString(), date, window, area: need.area, address: "", customer: { name: "", phone: "" }, items: need.items, total: 0, payment: "cash", status: "new", events: [] }
}

/** Whether any active pro could ever take this booking (skills, women-only categories). */
export const anyoneCan = (need: SlotNeed, pros: Pro[], cat: OpsCatalog) => pros.some((p) => eligible(p, candidate(need, "", WINDOW_LABELS[0]), cat))

/** Open windows on one day, given that day's jobs and the pros. */
export function windowsForDay(date: string, dayJobs: Job[], pros: Pro[], need: SlotNeed, cat: OpsCatalog): { label: string; open: boolean }[] {
  const jobs = dayJobs.filter((j) => j.date === date && busy(j))
  const base = new Set(planRoutes(jobs, pros, [], cat).unassigned.map((u) => u.jobId))
  return WINDOW_LABELS.map((label) => {
    const plan = planRoutes([...jobs, candidate(need, date, label)], pros, [], cat)
    const left = plan.unassigned.map((u) => u.jobId)
    return { label, open: !left.includes(CANDIDATE) && left.every((id) => base.has(id)) }
  })
}

/**
 * Slots for the next days. `leadHours` closes windows that start too soon today (the policy
 * value). In "open" mode only the lead time applies.
 */
export function slots(dates: string[], jobs: Job[], pros: Pro[], need: SlotNeed, cat: OpsCatalog, leadHours: number): { mode: SlotMode; days: DaySlots[] } {
  const mode: SlotMode = anyoneCan(need, pros, cat) ? "capacity" : "open"
  const days = dates.map((date) => {
    const fits = mode === "capacity" ? windowsForDay(date, jobs, pros, need, cat) : WINDOW_LABELS.map((label) => ({ label, open: true }))
    return { date, windows: fits.map((w, i) => ({ label: w.label, open: w.open && windowAvailable(date, i, leadHours) })) }
  })
  return { mode, days }
}

/** Whether one window is still open (checked again when the booking is placed). */
export function windowOpen(date: string, window: string, jobs: Job[], pros: Pro[], need: SlotNeed, cat: OpsCatalog) {
  if (!anyoneCan(need, pros, cat)) return true
  return windowsForDay(date, jobs, pros, need, cat).find((w) => w.label === window)?.open ?? false
}
