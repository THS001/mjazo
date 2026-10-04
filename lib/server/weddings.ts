import "server-only"
import { WINDOW_LABELS } from "@/lib/time"
import { LOOKS, PREP, computeSchedule, svcInfo, to12h, type ShaadiCatalog, type ShaadiPlan } from "@/lib/shaadi"
import type { Job, JobItem } from "@/lib/ops/types"
import { newId } from "./store"
import { nowIso } from "./ops"

// Turns an approved Shaadi plan into ordinary jobs: one per prep visit (split across pros when
// it's a long visit) and one per pro track on each event day, with a fixed arrival time. Route
// Brain then assigns pros like any other booking.

const hm = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5)

/** The arrival window that contains a time, or a fixed-arrival label outside 9 am – 9 pm. */
function windowFor(arrive: string) {
  const m = hm(arrive)
  const i = Math.floor((m - 540) / 120)
  return i >= 0 && i < WINDOW_LABELS.length ? WINDOW_LABELS[i] : `Arrive ${to12h(arrive)}`
}

const item = (name: string, def: { category: string; service: string }, price: number | null): JobItem => ({ name, category: def.category, service: def.service, options: [], addOns: [], qty: 1, unitPrice: price ?? 0 })

export function weddingJobs(plan: ShaadiPlan, planId: string, today: string, cat: ShaadiCatalog): Job[] {
  const s = computeSchedule(plan, today, cat)
  const c = plan.contact
  const base = (date: string, window: string, items: JobItem[], notes: string): Job => ({
    id: newId(),
    createdAt: nowIso(),
    date,
    window,
    area: c.area,
    address: c.address,
    customer: { name: c.name, phone: c.phone },
    items,
    total: items.reduce((x, i) => x + i.unitPrice * i.qty, 0),
    payment: "cash",
    notes,
    channel: "shaadi",
    status: "new",
    events: [],
  })
  const jobs: Job[] = []

  for (const v of s.prep) {
    // Balance a long prep visit across the pros it needs.
    const buckets: { items: JobItem[]; minutes: number }[] = Array.from({ length: v.pros }, () => ({ items: [], minutes: 0 }))
    for (const it of [...v.items].sort((a, b) => svcInfo(PREP[b.key], cat).minutes - svcInfo(PREP[a.key], cat).minutes)) {
      const b = buckets.sort((x, y) => x.minutes - y.minutes)[0]
      const info = svcInfo(PREP[it.key], cat)
      b.items.push(item(`${it.label} · ${it.person}`, PREP[it.key], info.price))
      b.minutes += info.minutes
    }
    buckets.filter((b) => b.items.length).forEach((b, i) => jobs.push(base(v.date, v.window, b.items, `${plan.title} (${planId}) · pre-wedding prep${v.pros > 1 ? `, pro ${i + 1} of ${v.pros}` : ""}`)))
  }

  for (const e of s.events) {
    e.tracks.forEach((t, i) => {
      const priced = new Set<string>()
      const items = t.blocks.map((b) => {
        const def = LOOKS[b.key]
        // Bridal is one quoted service even though two pros share it.
        const price = b.key === "bridal" && priced.has(`${b.personId}|bridal`) ? 0 : svcInfo(def, cat).price
        priced.add(`${b.personId}|${b.key}`)
        return item(`${b.label} · ${b.person}`, def, price)
      })
      const people = new Map<string, { name: string; start: string; end: string; services: string[] }>()
      for (const b of t.blocks) {
        const p = people.get(b.personId) ?? { name: b.person, start: b.start, end: b.end, services: [] }
        p.start = p.start < b.start ? p.start : b.start
        p.end = p.end > b.end ? p.end : b.end
        p.services.push(b.label)
        people.set(b.personId, p)
      }
      const job = base(e.date, windowFor(t.arrive), items, `${plan.title} (${planId}) · ${e.name}, ${t.pool} pro ${i + 1}: arrive ${to12h(t.arrive)}`)
      job.eta = t.arrive
      job.event = { planId, name: e.name, readyBy: e.readyBy, track: `${t.pool === "glam" ? "Glam" : "Mehndi"} pro ${i + 1} of ${e.tracks.filter((x) => x.pool === t.pool).length}`, people: [...people.values()] }
      jobs.push(job)
    })
  }
  return jobs
}
