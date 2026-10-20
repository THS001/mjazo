import type { JobEventType, JobStatus } from "@/lib/ops/types"

// The booking status machine, shared by the ops console, the pro app and the core engine.
// new → assigned → en_route → checked_in → checked_out → completed, or cancelled / no_show.

/** The status an event moves a booking to (other events, like notes, leave it as it is). */
export const STATUS_FOR: Partial<Record<JobEventType, JobStatus>> = {
  assigned: "assigned",
  en_route: "en_route",
  checked_in: "checked_in",
  checked_out: "checked_out",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "no_show",
}

/** Which events each status accepts. */
export const ALLOWED: Record<JobStatus, JobEventType[]> = {
  new: ["assigned", "cancelled", "note"],
  assigned: ["assigned", "en_route", "checked_in", "cancelled", "no_show", "note", "sos", "safe"],
  en_route: ["checked_in", "assigned", "cancelled", "no_show", "note", "sos", "safe"],
  checked_in: ["checked_out", "note", "sos", "safe", "payment"],
  checked_out: ["completed", "payment", "note", "sos", "safe"],
  completed: ["payment", "note"],
  cancelled: ["note", "assigned"],
  no_show: ["note", "assigned"],
}

export const canApply = (status: JobStatus, type: JobEventType) => ALLOWED[status].includes(type)

/** Statuses where the visit is over (no more work, the brief photos can go). */
export const FINAL: JobStatus[] = ["completed", "cancelled", "no_show"]
