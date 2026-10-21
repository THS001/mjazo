import type { Job } from "./types"

// The KPI dashboard's numbers, from the jobs alone (pure, so it's easy to test). Money figures
// that live in the ledger (cash held, unreconciled payments) are added by the server.

export type Kpis = {
  from: string
  to: string
  bookings: number // made for days in the range, cancelled ones included
  completed: number
  cancelled: number
  noShow: number
  /** Of the visits that are over (done, cancelled or no-show), the share done. null when none are over yet. */
  completionRate: number | null
  gmv: number // value of completed visits
  avgOrder: number
  customers: number // with a completed visit in the range
  repeatCustomers: number // …who had a completed visit before it
  repeatRate: number | null
  proDays: number // pro × day pairs with at least one completed visit
  visitsPerProDay: number | null
  byDay: { date: string; bookings: number; completed: number; gmv: number }[]
}

const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 1000 : null)

export function computeKpis(jobs: Job[], from: string, to: string): Kpis {
  const inRange = jobs.filter((j) => j.date >= from && j.date <= to)
  const done = inRange.filter((j) => j.status === "completed")
  const cancelled = inRange.filter((j) => j.status === "cancelled").length
  const noShow = inRange.filter((j) => j.status === "no_show").length
  const gmv = done.reduce((s, j) => s + j.total, 0)

  // A customer seen in the range is a repeat customer once she has two or more completed visits
  // (up to the end of the range, earlier ones included).
  const visits = new Map<string, number>()
  for (const j of jobs) if (j.status === "completed" && j.date <= to) visits.set(j.customer.phone, (visits.get(j.customer.phone) ?? 0) + 1)
  const customers = new Set(done.map((j) => j.customer.phone))
  const repeat = [...customers].filter((phone) => (visits.get(phone) ?? 0) >= 2).length

  const proDays = new Set(done.filter((j) => j.proId).map((j) => `${j.proId}|${j.date}`)).size
  const days: Kpis["byDay"] = []
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10)
    const day = inRange.filter((j) => j.date === date)
    const dayDone = day.filter((j) => j.status === "completed")
    days.push({ date, bookings: day.length, completed: dayDone.length, gmv: dayDone.reduce((s, j) => s + j.total, 0) })
  }
  return {
    from,
    to,
    bookings: inRange.length,
    completed: done.length,
    cancelled,
    noShow,
    completionRate: ratio(done.length, done.length + cancelled + noShow),
    gmv,
    avgOrder: done.length ? Math.round(gmv / done.length) : 0,
    customers: customers.size,
    repeatCustomers: repeat,
    repeatRate: ratio(repeat, customers.size),
    proDays,
    visitsPerProDay: proDays ? Math.round((done.filter((j) => j.proId).length / proDays) * 100) / 100 : null,
    byDay: days,
  }
}
