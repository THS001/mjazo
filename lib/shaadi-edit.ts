// Shaadi Orchestrator: validated edits to a plan. The AI proposes a patch; this code applies it,
// so the plan's shape, services and dates are always checked by the same rules.

import { z } from "zod"
import { LOOKS, PREP, uid, type Person, type Role, type ShaadiPlan } from "./shaadi"

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const planSchema = z.object({
  id: z.string().max(40),
  title: z.string().max(80),
  prepWindow: z.string().max(20),
  contact: z.object({ name: z.string().max(80), phone: z.string().max(20), area: z.string().max(40), address: z.string().max(200) }),
  events: z.array(z.object({ id: z.string().max(40), name: z.string().min(1).max(40), date: z.string().regex(DATE), readyBy: z.string().regex(TIME), earliestStart: z.string().regex(TIME).optional() })).max(10),
  people: z
    .array(
      z.object({
        id: z.string().max(40),
        name: z.string().min(1).max(60),
        role: z.enum(["bride", "mother", "family", "guest"]),
        branch: z.string().max(40),
        phone: z.string().max(20).optional(),
        looks: z.record(z.string(), z.array(z.string()).max(8)),
        prep: z.array(z.string()).max(12),
      }),
    )
    .max(60),
})

export type PlanPatch = {
  title?: string
  events?: { action: "add" | "update" | "remove"; id?: string; name?: string; date?: string; ready_by?: string; earliest_start?: string }[]
  people?: { action: "add" | "update" | "remove"; id?: string; name?: string; role?: Role; branch?: string; phone?: string; count?: number }[]
  looks?: { person: string; event: string; add?: string[]; remove?: string[]; set?: string[] }[]
  prep?: { person: string; add?: string[]; remove?: string[]; set?: string[] }[]
}

const norm = (s: string) => s.trim().toLowerCase()

function pickPeople(plan: ShaadiPlan, sel: string): Person[] {
  const s = norm(sel)
  if (["everyone", "all", "all people", "everybody"].includes(s)) return plan.people
  const role = ({ bride: "bride", mother: "mother", mothers: "mother", ammi: "mother", family: "family", guests: "guest", guest: "guest", "all guests": "guest" } as Record<string, Role>)[s]
  if (role) return plan.people.filter((p) => p.role === role)
  const byId = plan.people.filter((p) => p.id === sel)
  if (byId.length) return byId
  return plan.people.filter((p) => norm(p.name) === s || norm(p.branch) === s)
}
function pickEvents(plan: ShaadiPlan, sel: string) {
  const s = norm(sel)
  if (["all", "all events", "every event"].includes(s)) return plan.events
  return plan.events.filter((e) => e.id === sel || norm(e.name) === s)
}

export function applyPatch(input: ShaadiPlan, patch: PlanPatch): { plan: ShaadiPlan; notes: string[] } {
  const plan: ShaadiPlan = structuredClone(input)
  const notes: string[] = []
  if (patch.title?.trim()) plan.title = patch.title.trim().slice(0, 80)

  for (const e of patch.events ?? []) {
    const date = e.date && DATE.test(e.date) ? e.date : undefined
    const ready = e.ready_by && TIME.test(e.ready_by) ? e.ready_by : undefined
    const early = e.earliest_start && TIME.test(e.earliest_start) ? e.earliest_start : undefined
    if (e.date && !date) notes.push(`Ignored date "${e.date}": use YYYY-MM-DD`)
    if (e.ready_by && !ready) notes.push(`Ignored time "${e.ready_by}": use 24-hour HH:MM`)
    if (e.action === "add") {
      if (!e.name || !date) {
        notes.push(`Event "${e.name ?? "?"}" needs a name and a date`)
        continue
      }
      if (plan.events.length >= 10) {
        notes.push("At most 10 events")
        continue
      }
      // Karachi wedding events are usually in the evening: assume 7 pm photos and say so.
      if (!ready && !e.ready_by) notes.push(`${e.name}: no photo time given, assumed 7:00 pm (tell the family)`)
      plan.events.push({ id: uid("ev-"), name: e.name.slice(0, 40), date, readyBy: ready ?? "19:00", earliestStart: early })
      continue
    }
    const targets = pickEvents(plan, e.id ?? e.name ?? "")
    if (!targets.length) {
      notes.push(`No event matches "${e.id ?? e.name}"`)
      continue
    }
    if (e.action === "remove") {
      const ids = new Set(targets.map((t) => t.id))
      plan.events = plan.events.filter((x) => !ids.has(x.id))
      for (const p of plan.people) for (const id of ids) delete p.looks[id]
    } else
      for (const t of targets) {
        if (e.name && e.id) t.name = e.name.slice(0, 40)
        if (date) t.date = date
        if (ready) t.readyBy = ready
        if (early) t.earliestStart = early
      }
  }

  for (const p of patch.people ?? []) {
    if (p.action === "add") {
      const n = Math.min(Math.max(1, p.count ?? 1), 40)
      if (plan.people.length + n > 60) {
        notes.push("At most 60 people")
        continue
      }
      const base = (p.name ?? "Guest").slice(0, 50)
      const start = plan.people.filter((x) => x.name.startsWith(base)).length
      for (let i = 0; i < n; i++)
        plan.people.push({ id: uid("p-"), name: n > 1 || start ? `${base} ${start + i + 1}` : base, role: p.role ?? "guest", branch: (p.branch ?? "Family").slice(0, 40), phone: p.phone, looks: {}, prep: [] })
      continue
    }
    const targets = pickPeople(plan, p.id ?? p.name ?? "")
    if (!targets.length) {
      notes.push(`No person matches "${p.id ?? p.name}"`)
      continue
    }
    if (p.action === "remove") {
      const ids = new Set(targets.map((t) => t.id))
      plan.people = plan.people.filter((x) => !ids.has(x.id))
    } else
      for (const t of targets) {
        if (p.name && p.id) t.name = p.name.slice(0, 60)
        if (p.role) t.role = p.role
        if (p.branch) t.branch = p.branch.slice(0, 40)
        if (p.phone) t.phone = p.phone
      }
  }

  const edit = (cur: string[], allowed: Record<string, unknown>, ch: { add?: string[]; remove?: string[]; set?: string[] }) => {
    const bad = [...(ch.add ?? []), ...(ch.set ?? [])].filter((k) => !(k in allowed))
    if (bad.length) notes.push(`Unknown service keys ignored: ${bad.join(", ")}`)
    let next = ch.set ? ch.set.filter((k) => k in allowed) : [...cur]
    next = [...new Set([...next, ...(ch.add ?? []).filter((k) => k in allowed)])].filter((k) => !(ch.remove ?? []).includes(k))
    // A combined look replaces its parts.
    if (next.includes("combo")) next = next.filter((k) => !["party-makeup", "soft-glam", "hair"].includes(k))
    if (next.includes("bridal")) next = next.filter((k) => !["party-makeup", "soft-glam", "hair", "combo"].includes(k))
    if (next.includes("party-makeup") && next.includes("soft-glam")) next = next.filter((k) => k !== "soft-glam")
    return next
  }
  for (const l of patch.looks ?? []) {
    const people = pickPeople(plan, l.person)
    const events = pickEvents(plan, l.event)
    if (!people.length || !events.length) {
      notes.push(`Looks: no match for "${l.person}" at "${l.event}"`)
      continue
    }
    for (const p of people) for (const e of events) p.looks[e.id] = edit(p.looks[e.id] ?? [], LOOKS, l)
  }
  for (const r of patch.prep ?? []) {
    const people = pickPeople(plan, r.person)
    if (!people.length) {
      notes.push(`Prep: no match for "${r.person}"`)
      continue
    }
    for (const p of people) p.prep = edit(p.prep, PREP, r)
  }
  return { plan, notes }
}
