// Shaadi Orchestrator: the scheduling engine. Pure and deterministic so the browser, the AI tools
// and the ops approval all compute exactly the same plan.
//
// 1. Prep: each person's pre-wedding services (facial, wax, brows, mani-pedi…) go in their ideal
//    window before their first event, grouped into as few household visits as possible.
// 2. Event days: work backwards from photo time. The bride finishes last (freshest) with two pros
//    side by side; everyone else is fitted in before her. We find the fewest pros that still get
//    everyone ready, separately for glam (makeup and hair) and mehndi.
// 3. Costs come only from the Mjazo catalogue, split by family branch.

import type { Catalog } from "@/lib/catalog"

/** Catalogue lookups the scheduler needs (getCatalog() on the server, useCatalog() in the browser). */
export type ShaadiCatalog = Pick<Catalog, "getService" | "MIN_ORDER">

export type Role = "bride" | "mother" | "family" | "guest"
export type ShaadiEvent = { id: string; name: string; date: string; readyBy: string; earliestStart?: string }
export type Person = { id: string; name: string; role: Role; branch: string; phone?: string; looks: Record<string, string[]>; prep: string[] }
export type ShaadiPlan = { id: string; title: string; events: ShaadiEvent[]; people: Person[]; prepWindow: string; contact: { name: string; phone: string; area: string; address: string } }

type Svc = { label: string; category: string; service: string; minutes?: number; price?: number | null; pool?: "glam" | "mehndi" }

/** Event-day looks, mapped to catalogue services. */
export const LOOKS: Record<string, Svc> = {
  "party-makeup": { label: "Party makeup", category: "makeup-mehndi", service: "party-makeup", pool: "glam" },
  "soft-glam": { label: "Soft glam", category: "makeup-mehndi", service: "soft-glam", pool: "glam" },
  hair: { label: "Hairstyling", category: "makeup-mehndi", service: "event-hairstyling", pool: "glam" },
  combo: { label: "Makeup + hair", category: "makeup-mehndi", service: "makeup-hair-combo", pool: "glam" },
  draping: { label: "Dupatta draping", category: "makeup-mehndi", service: "dupatta-draping", pool: "glam" },
  "mehndi-hands": { label: "Mehndi (hands)", category: "makeup-mehndi", service: "mehndi-hands", pool: "mehndi" },
  "mehndi-full": { label: "Mehndi (full)", category: "makeup-mehndi", service: "mehndi-full", pool: "mehndi" },
  bridal: { label: "Bridal makeup + hair", category: "makeup-mehndi", service: "bridal-consult", minutes: 150, price: null, pool: "glam" },
}

/** Pre-wedding prep, with the ideal window in days before the person's first event. */
export const PREP: Record<string, Svc & { window: [number, number] }> = {
  facial: { label: "Facial", category: "womens-salon", service: "hydrating-facial", window: [7, 14] },
  cleanup: { label: "Clean-up", category: "womens-salon", service: "express-cleanup", window: [3, 5] },
  "wax-full": { label: "Full body wax", category: "womens-salon", service: "full-body-wax", window: [4, 10] },
  "wax-arms-legs": { label: "Arms + legs wax", category: "womens-salon", service: "arms-legs-wax", window: [3, 10] },
  brows: { label: "Brows + upper lip", category: "womens-salon", service: "brows-upper-lip", window: [2, 4] },
  threading: { label: "Full face threading", category: "womens-salon", service: "full-face-threading", window: [2, 4] },
  "mani-pedi": { label: "Mani-pedi", category: "womens-salon", service: "mani-pedi", window: [1, 2] },
  "gel-polish": { label: "Gel polish", category: "nails-lashes", service: "gel-polish", window: [1, 3] },
  "hair-spa": { label: "Hair spa", category: "hair", service: "hair-spa", window: [2, 6] },
  "lash-lift": { label: "Lash lift", category: "nails-lashes", service: "lash-lift", window: [3, 7] },
  "hair-colour": { label: "Hair colour", category: "hair", service: "global-colour", window: [7, 14] },
  keratin: { label: "Keratin", category: "hair", service: "keratin", window: [14, 21] },
}

const ROLE_RANK: Record<Role, number> = { bride: 3, mother: 2, family: 1, guest: 0 }
export const ROLE_LABEL: Record<Role, string> = { bride: "Bride", mother: "Mother", family: "Family", guest: "Guest" }
const CHANGEOVER = 10 // minutes between clients for the same pro
const ARRIVE_EARLY = 15 // pros arrive before their first client
const MAX_PROS = 8
const PREP_VISIT_MAX = 240 // minutes of work one pro takes on a prep visit

export const svcInfo = (s: Svc, cat: ShaadiCatalog) => {
  const f = cat.getService(s.category, s.service)
  return { minutes: s.minutes ?? f?.service.duration ?? 60, price: s.price === null ? null : (s.price ?? (f && f.service.price > 0 ? f.service.price : null)) }
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + (m || 0)
}
export const toHHMM = (min: number) => `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((min % 60) + 60) % 60).padStart(2, "0")}`
export const to12h = (hhmm: string) => {
  const m = toMin(hhmm)
  const h = Math.floor(m / 60) % 24
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`
}
const DAY = 86400000
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY)

// ---------------------------------------------------------------------------------------------

export type Block = { personId: string; person: string; key: string; label: string; start: string; end: string }
export type Track = { id: string; pool: "glam" | "mehndi"; arrive: string; blocks: Block[] }
export type EventSchedule = { eventId: string; name: string; date: string; readyBy: string; tracks: Track[]; pros: { glam: number; mehndi: number }; start: string; warning?: string }
export type PrepVisit = { date: string; window: string; pros: number; minutes: number; items: { personId: string; person: string; key: string; label: string; ideal: boolean }[]; total: number; warning?: string }
export type Cost = { personId: string; person: string; branch: string; amount: number; quoted: string[] }
export type Schedule = { prep: PrepVisit[]; events: EventSchedule[]; costs: Cost[]; branches: { branch: string; amount: number; people: number }[]; total: number; quoted: string[]; warnings: string[] }

type Seg = { key: string; label: string; minutes: number }
type Chain = { personId: string; person: string; rank: number; segments: Seg[]; parallel?: boolean }

/** Backwards list scheduling with k pros; returns null if it can't start after `earliest`. */
function fit(chains: Chain[], deadline: number, earliest: number, k: number) {
  const free = Array.from({ length: k }, () => deadline)
  const tracks: { blocks: { c: Chain; key: string; label: string; start: number; end: number }[] }[] = Array.from({ length: k }, () => ({ blocks: [] }))
  const order = [...chains].sort((a, b) => b.rank - a.rank || b.segments.reduce((s, x) => s + x.minutes, 0) - a.segments.reduce((s, x) => s + x.minutes, 0))
  for (const c of order) {
    const byFree = free.map((f, i) => ({ f, i })).sort((a, b) => b.f - a.f)
    if (c.parallel && k >= 2 && c.segments.length >= 2) {
      // Two pros side by side (bride): both finish together.
      const [a, b] = byFree
      const end = Math.min(a.f, b.f)
      // Finishing touches (e.g. dupatta draping) come last, on the first pro.
      let t = end
      for (const x of [...c.segments.slice(2)].reverse()) {
        tracks[a.i].blocks.push({ c, key: x.key, label: x.label, start: t - x.minutes, end: t })
        t -= x.minutes
      }
      const [s1, s2] = c.segments
      tracks[a.i].blocks.push({ c, key: s1.key, label: s1.label, start: t - s1.minutes, end: t })
      tracks[b.i].blocks.push({ c, key: s2.key, label: s2.label, start: t - s2.minutes, end: t })
      free[a.i] = t - s1.minutes - CHANGEOVER
      free[b.i] = t - s2.minutes - CHANGEOVER
      continue
    }
    const { i } = byFree[0]
    let t = free[i]
    for (const s of [...c.segments].reverse()) {
      tracks[i].blocks.push({ c, key: s.key, label: s.label, start: t - s.minutes, end: t })
      t -= s.minutes
    }
    free[i] = t - CHANGEOVER
  }
  const start = Math.min(...tracks.flatMap((t) => t.blocks.map((b) => b.start)), deadline)
  return start >= earliest ? { tracks: tracks.filter((t) => t.blocks.length), start } : null
}

function eventChains(plan: ShaadiPlan, e: ShaadiEvent, pool: "glam" | "mehndi", cat: ShaadiCatalog): Chain[] {
  const out: Chain[] = []
  for (const p of plan.people) {
    const keys = (p.looks[e.id] ?? []).filter((k) => LOOKS[k]?.pool === pool)
    if (!keys.length) continue
    const has = (k: string) => keys.includes(k)
    let segments: Seg[] = []
    let parallel = false
    if (pool === "mehndi") segments = keys.map((k) => ({ key: k, label: LOOKS[k].label, minutes: svcInfo(LOOKS[k], cat).minutes }))
    else if (has("bridal")) {
      segments = [
        { key: "bridal", label: "Bridal makeup", minutes: 120 },
        { key: "bridal", label: "Bridal hair", minutes: 75 },
      ]
      parallel = true
      if (has("draping")) segments.push({ key: "draping", label: "Dupatta draping", minutes: svcInfo(LOOKS.draping, cat).minutes })
    } else {
      // Makeup first, then hair, then draping, on one pro.
      const ordered = ["combo", "party-makeup", "soft-glam", "hair", "draping"].filter(has).filter((k) => !(k === "hair" && has("combo")))
      segments = ordered.map((k) => ({ key: k, label: LOOKS[k].label, minutes: svcInfo(LOOKS[k], cat).minutes }))
      if (p.role === "bride" && segments.length >= 2 && (has("party-makeup") || has("soft-glam")) && has("hair")) parallel = true
    }
    out.push({ personId: p.id, person: p.name, rank: ROLE_RANK[p.role], segments, parallel })
  }
  return out
}

export function scheduleEvent(plan: ShaadiPlan, e: ShaadiEvent, cat: ShaadiCatalog): EventSchedule {
  const ready = toMin(e.readyBy)
  const earliest = e.earliestStart ? toMin(e.earliestStart) : ready - 270
  const tracks: Track[] = []
  const pros = { glam: 0, mehndi: 0 }
  let start = ready
  let warning: string | undefined
  for (const pool of ["glam", "mehndi"] as const) {
    const chains = eventChains(plan, e, pool, cat)
    if (!chains.length) continue
    // Mehndi needs drying time before photos.
    const deadline = pool === "glam" ? ready - 10 : ready - (chains.some((c) => c.segments.some((s) => s.label.includes("full"))) ? 240 : 120)
    let got: ReturnType<typeof fit> = null
    let k = 1
    for (; k <= MAX_PROS && !got; k++) got = fit(chains, deadline, pool === "glam" ? earliest : earliest - 180, k)
    if (!got) {
      got = fit(chains, deadline, -Infinity, MAX_PROS)!
      warning = `Too many looks for the time: with ${MAX_PROS} ${pool} pros the first starts at ${to12h(toHHMM(got.start))}. Start earlier or trim looks.`
      k = MAX_PROS + 1
    }
    pros[pool] = k - 1
    start = Math.min(start, got.start)
    got.tracks.forEach((t, i) => {
      const blocks = t.blocks.sort((a, b) => a.start - b.start)
      tracks.push({
        id: `${pool}-${i + 1}`,
        pool,
        arrive: toHHMM(blocks[0].start - ARRIVE_EARLY),
        blocks: blocks.map((b) => ({ personId: b.c.personId, person: b.c.person, key: b.key, label: b.label, start: toHHMM(b.start), end: toHHMM(b.end) })),
      })
    })
  }
  return { eventId: e.id, name: e.name, date: e.date, readyBy: e.readyBy, tracks, pros, start: toHHMM(start), warning }
}

/** Groups everyone's prep into as few household visits as possible, each inside its ideal window. */
export function schedulePrep(plan: ShaadiPlan, today: string, cat: ShaadiCatalog): PrepVisit[] {
  const eventDays = new Set(plan.events.map((e) => e.date))
  const firstEvent = (p: Person) =>
    [...plan.events].filter((e) => (p.looks[e.id] ?? []).length).sort((a, b) => a.date.localeCompare(b.date))[0] ?? [...plan.events].sort((a, b) => a.date.localeCompare(b.date))[0]
  type Task = { personId: string; person: string; key: string; days: string[]; ideal: boolean }
  const tasks: Task[] = []
  const minDay = shift(today, 1)
  for (const p of plan.people) {
    const ev = firstEvent(p)
    if (!ev) continue
    for (const key of p.prep) {
      const def = PREP[key]
      if (!def) continue
      const [lo, hi] = def.window
      let days = Array.from({ length: hi - lo + 1 }, (_, i) => shift(ev.date, -(lo + i))).filter((d) => d >= minDay && !eventDays.has(d))
      let ideal = true
      if (!days.length) {
        // The ideal window has passed: do it as soon as possible before the event.
        ideal = false
        days = Array.from({ length: Math.max(0, daysBetween(minDay, ev.date)) }, (_, i) => shift(minDay, i)).filter((d) => !eventDays.has(d))
        if (!days.length) continue
        days = [days[0]]
      }
      tasks.push({ personId: p.id, person: p.name, key, days, ideal })
    }
  }
  const visits = new Map<string, Task[]>()
  let left = [...tasks]
  while (left.length) {
    // The day that covers the most remaining tasks; ties go to the later day (closer to the event).
    const count = new Map<string, number>()
    for (const t of left) for (const d of t.days) count.set(d, (count.get(d) ?? 0) + 1)
    const [best] = [...count.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]
    visits.set(best, [...(visits.get(best) ?? []), ...left.filter((t) => t.days.includes(best))])
    left = left.filter((t) => !t.days.includes(best))
  }
  return [...visits.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, ts]) => {
      const minutes = ts.reduce((s, t) => s + svcInfo(PREP[t.key], cat).minutes, 0)
      const total = ts.reduce((s, t) => s + (svcInfo(PREP[t.key], cat).price ?? 0), 0)
      return {
        date,
        window: plan.prepWindow,
        pros: Math.max(1, Math.ceil(minutes / PREP_VISIT_MAX)),
        minutes,
        total,
        items: ts.map((t) => ({ personId: t.personId, person: t.person, key: t.key, label: PREP[t.key].label, ideal: t.ideal })),
        warning: total < cat.MIN_ORDER ? `Under the PKR ${cat.MIN_ORDER.toLocaleString("en-PK")} minimum per visit: add a service or merge with another day.` : ts.some((t) => !t.ideal) ? "Some services are later than ideal because the event is close." : undefined,
      }
    })
}

export function computeSchedule(input: ShaadiPlan, today: string, cat: ShaadiCatalog): Schedule {
  const warnings: string[] = []
  // Events still being typed in (no date or time yet) are left out until they're complete.
  const plan = { ...input, events: input.events.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && /^\d{2}:\d{2}$/.test(e.readyBy)) }
  const events = [...plan.events].sort((a, b) => a.date.localeCompare(b.date) || a.readyBy.localeCompare(b.readyBy)).map((e) => scheduleEvent(plan, e, cat))
  const prep = schedulePrep(plan, today, cat)
  for (const e of plan.events) if (e.date < shift(today, 1)) warnings.push(`${e.name} is on ${e.date}: that's too soon to plan here, please WhatsApp us.`)
  for (const e of events) if (e.warning) warnings.push(`${e.name}: ${e.warning}`)
  for (const v of prep) if (v.warning) warnings.push(`Prep on ${v.date}: ${v.warning}`)
  const costs: Cost[] = plan.people.map((p) => {
    let amount = 0
    const quoted: string[] = []
    const add = (s: Svc) => {
      const pr = svcInfo(s, cat).price
      if (pr === null) quoted.push(s.label)
      else amount += pr
    }
    for (const e of plan.events) for (const k of p.looks[e.id] ?? []) if (LOOKS[k]) add(LOOKS[k])
    for (const k of p.prep) if (PREP[k]) add(PREP[k])
    return { personId: p.id, person: p.name, branch: p.branch || "Family", amount, quoted }
  })
  const byBranch = new Map<string, { amount: number; people: number }>()
  for (const c of costs) {
    const b = byBranch.get(c.branch) ?? { amount: 0, people: 0 }
    byBranch.set(c.branch, { amount: b.amount + c.amount, people: b.people + 1 })
  }
  return {
    prep,
    events,
    costs,
    branches: [...byBranch.entries()].map(([branch, v]) => ({ branch, ...v })).sort((a, b) => b.amount - a.amount),
    total: costs.reduce((s, c) => s + c.amount, 0),
    quoted: [...new Set(costs.flatMap((c) => c.quoted))],
    warnings,
  }
}

/** What moved between two schedules, in plain words (for "tell everyone"). */
export function diffSchedules(a: Schedule, b: Schedule): string[] {
  const out: string[] = []
  const slot = (s: Schedule) => {
    const m = new Map<string, string>()
    for (const e of s.events) for (const t of e.tracks) for (const x of t.blocks) m.set(`${x.person}|${e.name}|${x.label}`, `${e.date} ${x.start}`)
    for (const v of s.prep) for (const x of v.items) m.set(`${x.person}|prep|${x.label}`, v.date)
    return m
  }
  const ma = slot(a)
  const mb = slot(b)
  for (const [k, v] of mb) {
    const [person, ev, label] = k.split("|")
    const was = ma.get(k)
    if (!was) out.push(`${person}: ${label}${ev === "prep" ? "" : ` (${ev})`} added, ${fmtSlot(v)}`)
    else if (was !== v) out.push(`${person}: ${label}${ev === "prep" ? "" : ` (${ev})`} moved from ${fmtSlot(was)} to ${fmtSlot(v)}`)
  }
  for (const k of ma.keys()) if (!mb.has(k)) out.push(`${k.split("|")[0]}: ${k.split("|")[2]} removed`)
  return out
}
const fmtSlot = (v: string) => {
  const [d, t] = v.split(" ")
  const day = new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
  return t ? `${day} ${to12h(t)}` : day
}

/** One person's own schedule, ready to send on WhatsApp. */
export function personMessage(plan: ShaadiPlan, s: Schedule, personId: string) {
  const p = plan.people.find((x) => x.id === personId)
  if (!p) return ""
  const lines = [`Assalam o Alaikum ${p.name.split(" ")[0]}! Your Mjazo glam plan for ${plan.title}:`]
  for (const v of s.prep) {
    const mine = v.items.filter((i) => i.personId === p.id)
    if (mine.length) lines.push(`• ${fmtSlot(v.date)}, ${v.window}: ${mine.map((i) => i.label).join(", ")} (at home)`)
  }
  for (const e of s.events) {
    const blocks = e.tracks.flatMap((t) => t.blocks).filter((b) => b.personId === p.id).sort((a, b) => a.start.localeCompare(b.start))
    if (blocks.length) lines.push(`• ${e.name}, ${fmtSlot(e.date)}: please be ready to start at ${to12h(blocks[0].start)} (${[...new Set(blocks.map((b) => b.label))].join(", ")}). Done by ${to12h(blocks[blocks.length - 1].end)}, photos at ${to12h(e.readyBy)}.`)
  }
  const c = s.costs.find((x) => x.personId === p.id)
  if (c?.amount) lines.push(`Your share: PKR ${c.amount.toLocaleString("en-PK")}${c.quoted.length ? ` + ${c.quoted.join(", ")} (quoted)` : ""}, paid after each visit.`)
  lines.push("Times are confirmed by the Mjazo wedding coordinator.")
  return lines.join("\n")
}

export const uid = (p = "x") => `${p}${Math.random().toString(36).slice(2, 8)}`

export function emptyPlan(): ShaadiPlan {
  return { id: uid("plan-"), title: "Our shaadi", events: [], people: [], prepWindow: "11 am–1 pm", contact: { name: "", phone: "", area: "", address: "" } }
}
