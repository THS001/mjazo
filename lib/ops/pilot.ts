import { computeKpis } from "./kpi"
import type { Job, Pro } from "./types"

// The pilot gates: what the validation sprint must show before money goes into the full launch
// (the blueprint analysis, "Recommended path", Mjazo_Blueprint_Analysis.md §8). Worked out from the
// jobs alone plus the founder's monthly inputs (ad spend, transport) and the ledger's margin per
// visit (pure, so it's easy to test; lib/server/pilot.ts gathers the data).
//
// | Gate                                   | Pass                    |
// | Cost per paying customer               | ≤ PKR 1,500             |
// | Second booking within 90 days          | ≥ 40% (stretch 50%)     |
// | Visits per pro per working day         | ≥ 2.0                   |
// | Pros still active at day 90            | ≥ 80%                   |
// | Average basket                         | ≥ PKR 3,000             |
// | Regular pairs going quiet (leakage)    | ≤ 10%, or explained     |
// | Contribution per visit (after transport and sales tax) | > 0     |

export const TARGETS = { costPerCustomer: 1500, secondBooking: 0.4, secondStretch: 0.5, visitsPerProDay: 2, proRetention: 0.8, basket: 3000, leakShare: 0.1 } as const
/** Below these, a gate says "too early" rather than pass or fail. */
const MIN = { newCustomers: 5, cohort: 10, proDays: 5, prosAt90: 3, visits: 10, pairs: 3 } as const

export type PilotMonth = { marketing: number; transport: number; note?: string; by: string; at: string }
export type PilotSettings = {
  /** The day the pilot started (the "since the start" view begins here). null: from the first visit. */
  startDate: string | null
  /** Sindh sales tax on services, e.g. 0.08. 0 until the tax opinion says otherwise. */
  taxRate: number
  /** Inside the price the customer pays (Mjazo bears it), or added on top (passed through). */
  taxInclusive: boolean
  /** On the whole booking (Mjazo as principal) or only on Mjazo's share (as agent). */
  taxBase: "total" | "commission"
  /** "YYYY-MM" → what was spent that month. */
  months: Record<string, PilotMonth>
}
export const DEFAULT_PILOT: PilotSettings = { startDate: null, taxRate: 0, taxInclusive: true, taxBase: "total", months: {} }

export type GateKey = "costPerCustomer" | "secondBooking" | "visitsPerProDay" | "proRetention" | "basket" | "leakage" | "contribution"
export type GateStatus = "pass" | "stretch" | "fail" | "early" | "input"
export type Gate = { key: GateKey; label: string; value: number | null; target: string; status: GateStatus; detail: string }

const DAY = 86400_000
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const addDays = (iso: string, n: number) => new Date(ms(iso) + n * DAY).toISOString().slice(0, 10)
const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-US")}`
const pct = (n: number) => `${Math.round(n * 100)}%`
const subtotalOf = (j: Job) => j.items.reduce((s, i) => s + i.unitPrice * i.qty, 0)

/** What was spent on `key` between `from` and `to` (inclusive), each month's figure shared out by its days. */
export function spendIn(months: PilotSettings["months"], from: string, to: string, key: "marketing" | "transport") {
  let total = 0
  let missing = 0
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addDays(`${m}-28`, 7).slice(0, 7)) {
    const first = `${m}-01`
    const last = addDays(addDays(`${m}-28`, 7).slice(0, 7) + "-01", -1)
    const overlap = (Math.min(ms(last), ms(to)) - Math.max(ms(first), ms(from))) / DAY + 1
    if (overlap <= 0) continue
    const entry = months[m]
    if (!entry) missing++
    else total += (entry[key] * overlap) / ((ms(last) - ms(first)) / DAY + 1)
  }
  return { total: Math.round(total), missing }
}

/** Mjazo's margin on a visit without a ledger entry: the total (less tax added on top) less the pro's share of the full price. */
const fallbackMargin = (j: Job, pros: Map<string, Pro>) => {
  const rate = (j.proId ? pros.get(j.proId)?.commissionRate : undefined) ?? 0.25
  return j.total - (j.tax && !j.tax.inclusive ? j.tax.amount : 0) - Math.round(subtotalOf(j) * (1 - rate))
}

export type PilotInput = {
  jobs: Job[]
  pros: Pro[]
  today: string
  from: string
  to: string
  settings: PilotSettings
  /** booking id → Mjazo's net on the visit from the ledger (commission less the discount it funded). */
  margins: Map<string, number>
  /** Leakage watch: regular pairs flagged and not explained (dismissed) by ops. */
  openLeaks: number
}

export function pilotGates({ jobs, pros, today, from, to, settings, margins, openLeaks }: PilotInput) {
  const proById = new Map(pros.map((p) => [p.id, p]))
  const completed = jobs.filter((j) => j.status === "completed").sort((a, b) => a.date.localeCompare(b.date))
  const done = completed.filter((j) => j.date >= from && j.date <= to)
  const k = computeKpis(jobs, from, to)
  const firstVisit = new Map<string, string>()
  for (const j of completed) if (!firstVisit.has(j.customer.phone)) firstVisit.set(j.customer.phone, j.date)
  const start = settings.startDate ?? completed[0]?.date ?? today
  const gates: Gate[] = []

  // 1. Cost per paying customer: ad spend over the customers whose first paid visit fell in the range.
  const newPaying = [...firstVisit.values()].filter((d) => d >= from && d <= to).length
  const ads = spendIn(settings.months, from, to, "marketing")
  const cpc = newPaying && !ads.missing ? ads.total / newPaying : null
  gates.push({
    key: "costPerCustomer",
    label: "Cost per paying customer",
    value: cpc === null ? null : Math.round(cpc),
    target: `≤ ${pkr(TARGETS.costPerCustomer)}`,
    status: ads.missing ? "input" : newPaying < MIN.newCustomers ? "early" : cpc! <= TARGETS.costPerCustomer ? "pass" : "fail",
    detail: ads.missing ? `Enter the ad spend for ${ads.missing === 1 ? "a month" : `${ads.missing} months`} in this range` : `${pkr(ads.total)} of ads · ${newPaying} new paying customer${newPaying === 1 ? "" : "s"}`,
  })

  // 2. Second booking within 90 days of the first visit, for customers whose first visit is 60+ days old.
  const cohort = [...firstVisit.entries()].filter(([, d]) => d >= start && d <= addDays(today, -60))
  const again = cohort.filter(([phone, first]) => jobs.some((j) => j.customer.phone === phone && j.date > first && j.date <= addDays(first, 90) && j.status !== "cancelled" && j.status !== "no_show")).length
  const second = cohort.length ? again / cohort.length : null
  gates.push({
    key: "secondBooking",
    label: "Second booking within 90 days",
    value: second,
    target: `≥ ${pct(TARGETS.secondBooking)} (stretch ${pct(TARGETS.secondStretch)})`,
    status: cohort.length < MIN.cohort ? "early" : second! >= TARGETS.secondStretch ? "stretch" : second! >= TARGETS.secondBooking ? "pass" : "fail",
    detail: cohort.length ? `${again} of ${cohort.length} customers whose first visit was 60+ days ago booked again within 90 days` : "No customer's first visit is 60 days old yet",
  })

  // 3. Visits per pro per working day (a day she did at least one visit).
  gates.push({
    key: "visitsPerProDay",
    label: "Visits per pro per working day",
    value: k.visitsPerProDay,
    target: `≥ ${TARGETS.visitsPerProDay.toFixed(1)}`,
    status: k.proDays < MIN.proDays ? "early" : k.visitsPerProDay! >= TARGETS.visitsPerProDay ? "pass" : "fail",
    detail: `${done.filter((j) => j.proId).length} visits over ${k.proDays} pro-days`,
  })

  // 4. Pros still active at day 90: of the pros whose first visit is 90+ days old, those still
  //    working (active, with a visit in the last 30 days).
  const firstByPro = new Map<string, string>()
  for (const j of completed) if (j.proId && !firstByPro.has(j.proId)) firstByPro.set(j.proId, j.date)
  const veterans = [...firstByPro.entries()].filter(([, d]) => d >= start && d <= addDays(today, -90))
  const still = veterans.filter(([id]) => proById.get(id)?.status === "active" && completed.some((j) => j.proId === id && j.date > addDays(today, -30))).length
  const nextAt90 = [...firstByPro.values()].filter((d) => d >= start && d > addDays(today, -90)).sort()[0]
  gates.push({
    key: "proRetention",
    label: "Pros still active at day 90",
    value: veterans.length ? still / veterans.length : null,
    target: `≥ ${pct(TARGETS.proRetention)}`,
    status: veterans.length < MIN.prosAt90 ? "early" : still / veterans.length >= TARGETS.proRetention ? "pass" : "fail",
    detail: veterans.length ? `${still} of ${veterans.length} pros who started 90+ days ago are still doing visits` : nextAt90 ? `The first pro reaches 90 days on ${addDays(nextAt90, 90)}` : "No pro has done a visit yet",
  })

  // 5. Average basket of completed visits.
  gates.push({
    key: "basket",
    label: "Average basket",
    value: done.length ? k.avgOrder : null,
    target: `≥ ${pkr(TARGETS.basket)}`,
    status: done.length < MIN.visits ? "early" : k.avgOrder >= TARGETS.basket ? "pass" : "fail",
    detail: `${done.length} completed visit${done.length === 1 ? "" : "s"} · ${pkr(k.gmv)}`,
  })

  // 6. Leakage: regular customer–pro pairs (3+ visits together in 180 days) the leakage watch
  //    flags as gone quiet while the pro kept working, and ops haven't explained.
  const pairs = new Map<string, number>()
  for (const j of completed) if (j.proId && j.date >= addDays(today, -180)) pairs.set(`${j.customer.phone}|${j.proId}`, (pairs.get(`${j.customer.phone}|${j.proId}`) ?? 0) + 1)
  const regular = [...pairs.values()].filter((n) => n >= 3).length
  const leakShare = regular ? openLeaks / regular : null
  gates.push({
    key: "leakage",
    label: "Regular pairs going quiet",
    value: leakShare,
    target: `≤ ${pct(TARGETS.leakShare)}, or explained`,
    status: regular < MIN.pairs ? "early" : leakShare! <= TARGETS.leakShare ? "pass" : "fail",
    detail: regular ? `${openLeaks} of ${regular} regular pairs to follow up (Trust Desk → Leakage watch)` : "No regular customer–pro pairs yet (3+ visits together)",
  })

  // 7. Contribution per visit: Mjazo's net from the ledger, less sales tax (when it's inside the
  //    price) and the month's transport spend shared over its visits. A visit that carried real
  //    sales tax (Money → Policies) counts what it posted: the ledger already took tax inside the
  //    price out of Mjazo's share, so it's added back to the net here and taken off once, below.
  //    Other visits are modelled from the pilot's own tax inputs.
  const transport = spendIn(settings.months, from, to, "transport")
  const net = done.map((j) => (margins.has(j.id) ? margins.get(j.id)! + (j.tax?.inclusive ? j.tax.amount : 0) : fallbackMargin(j, proById)))
  const tax = done.map((j, i) => {
    if (j.tax) return j.tax.inclusive ? j.tax.amount : 0
    if (!settings.taxInclusive || !settings.taxRate) return 0
    const base = settings.taxBase === "total" ? j.total : Math.max(0, net[i])
    return Math.round((base * settings.taxRate) / (1 + settings.taxRate))
  })
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
  const perVisit = { net: Math.round(avg(net)), tax: Math.round(avg(tax)), transport: done.length ? Math.round(transport.total / done.length) : 0 }
  const contribution = done.length && !transport.missing ? perVisit.net - perVisit.tax - perVisit.transport : null
  gates.push({
    key: "contribution",
    label: "Contribution per visit",
    value: contribution,
    target: "> PKR 0, after transport and sales tax",
    status: transport.missing ? "input" : done.length < MIN.visits ? "early" : contribution! > 0 ? "pass" : "fail",
    detail: transport.missing
      ? `Enter the transport spend for ${transport.missing === 1 ? "a month" : `${transport.missing} months`} in this range`
      : `${pkr(perVisit.net)} Mjazo's share − ${pkr(perVisit.tax)} sales tax − ${pkr(perVisit.transport)} transport, per visit`,
  })

  const counted = gates.filter((g) => g.status !== "early" && g.status !== "input")
  return {
    from,
    to,
    start,
    gates,
    perVisit,
    spend: { marketing: ads.total, transport: transport.total },
    passed: counted.filter((g) => g.status === "pass" || g.status === "stretch").length,
    measured: counted.length,
  }
}
export type PilotReport = ReturnType<typeof pilotGates>
