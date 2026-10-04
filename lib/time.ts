// Karachi dates and booking windows, shared by checkout (client) and the AI agents (server).

const TZ = "Asia/Karachi"

export function karachiNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0"
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 + Number(get("minute")) / 60 }
}

export function nextDays(n = 7) {
  const { date } = karachiNow()
  const base = new Date(`${date}T00:00:00Z`)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base.getTime() + i * 86400000)
    const iso = d.toISOString().slice(0, 10)
    return {
      iso,
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      day: d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" }),
      month: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
    }
  })
}

// The six 2-hour visit windows. Fixed by the booking and dispatch system: jobs store the label and
// route planning uses the start hour, so these are not editable content.
export const WINDOWS = [
  { label: "9–11 am", start: 9 },
  { label: "11 am–1 pm", start: 11 },
  { label: "1–3 pm", start: 13 },
  { label: "3–5 pm", start: 15 },
  { label: "5–7 pm", start: 17 },
  { label: "7–9 pm", start: 19 },
] as const
export const WINDOW_LABELS: string[] = WINDOWS.map((w) => w.label)
export const WINDOW_HOURS: number[] = WINDOWS.map((w) => w.start)

/** Whether a window can still be reached today, given the policy lead time (hours). */
export function windowAvailable(dateIso: string, index: number, leadHours: number) {
  const { date, hour } = karachiNow()
  if (dateIso !== date) return true
  return WINDOW_HOURS[index] >= hour + leadHours
}

export function formatBookingDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
}

