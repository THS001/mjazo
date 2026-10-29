import "server-only"
import { all, get, insertNew, mutate, put, remove } from "./docs"
import { listSubmissions, notifyOps, type StoredSubmission } from "./store"
import { randomToken } from "./session"
import { karachiNow } from "@/lib/time"
import { OPS, safetyStatus, type OpsCatalog } from "@/lib/ops/logic"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { core, type Db } from "@/lib/core/db"
import * as cj from "@/lib/core/jobs"
import { allProBalances, bookingEntries, bookingPaid, customerBalances, earnedSince, trialBalance } from "@/lib/core/ledger"
import * as money from "@/lib/core/money"
import * as offers from "@/lib/core/offers"
import * as promos from "@/lib/core/promos"
import * as cpros from "@/lib/core/pros"
import * as creq from "@/lib/core/requests"
import { listAudit, type AuditFilter } from "@/lib/core/audit"
import { markOnce, nobodyCameKey } from "@/lib/core/automation"
import { ensureReceipt } from "@/lib/core/receipts"
import { pairRates } from "@/lib/core/pairs"
import { receiptUrl } from "./receipts"
import { windowOpen } from "@/lib/core/capacity"
import { computeKpis } from "@/lib/ops/kpi"
import type { PlanLimits } from "@/lib/ops/logic"
import { paymentNeedsCheck } from "@/lib/ops/logic"
import { WINDOW_LABELS } from "@/lib/time"
import { recentAudit } from "./audit"
import { kick } from "./kick"
import { normalisePhone } from "@/lib/core/phone"
import { PricingError } from "@/lib/core/pricing"
import { ALLOWED, FINAL, STATUS_FOR } from "@/lib/core/status"
import type { Application, Complaint, Job, JobEvent, JobEventType, Pro, SafetyStatus, VerificationKey } from "@/lib/ops/types"

// The ops domain. Jobs (bookings) and pros live in the core engine's tables when it's on
// (lib/core: DATABASE_URL in production, PGlite locally), and in the older document store
// (ops_docs) otherwise. Applications, complaints, SOS, attachments and weddings stay in the
// document store for now. Every caller uses these functions, so the switch is invisible to the
// ops console and the pro app.

export const nowIso = () => new Date().toISOString()
export { normalisePhone }

let legacy: Promise<unknown> | null = null
/** The core database for ops, or null when it's off. The first use copies the older records across. */
async function opsDb(): Promise<Db | null> {
  const db = await core()
  if (!db) return null
  legacy ??= cj
    .importLegacy(db, async () => ({ pros: await all<Pro>("pros"), jobs: await all<Job>("jobs") }))
    .then((r) => r && console.log(`[ops] copied ${r.pros} pros and ${r.jobs} jobs into the core`))
    .catch((e) => {
      legacy = null
      throw e
    })
  await legacy
  return db
}

/** Only look at submissions from a little before the newest one already synced. */
const sinceOf = (docs: { createdAt: string }[]) => {
  const last = docs.reduce((m, d) => Math.max(m, Date.parse(d.createdAt) || 0), 0)
  return last ? new Date(last - 3600_000).toISOString() : undefined
}

/** A website booking submission as a job (the older document store, and the core's fallback import). */
function submissionJob(s: StoredSubmission): Job {
  const d = s.data as Record<string, unknown>
  return {
    id: s.id,
    createdAt: s.created_at,
    date: String(d.date),
    window: String(d.window),
    area: String(d.area),
    subArea: d.subArea ? String(d.subArea) : undefined,
    address: String(d.address),
    landmark: d.landmark ? String(d.landmark) : undefined,
    customer: { name: String(d.name), phone: String(d.phone) },
    items: (d.items as Job["items"]) ?? [],
    total: Number(d.total) || 0,
    payment: String(d.payment),
    notes: d.notes ? String(d.notes) : undefined,
    channel: d.channel ? String(d.channel) : "web",
    brief: d.brief ? (d.brief as Job["brief"]) : undefined,
    status: "new",
    events: [],
  }
}

/**
 * Bookings that reached the submissions table but not the core (a failed write, or bookings made
 * before the core was switched on) are added here. Lines that can no longer be priced keep the
 * prices the customer saw.
 */
async function catchUpBookings(db: Db) {
  const latest = await cj.latestBookingAt(db)
  const subs = await listSubmissions("booking", latest ? new Date(Date.parse(latest) - 3600_000).toISOString() : undefined)
  if (!subs.length) return
  const known = new Set((await db.query<{ id: string }>("select id from bookings where id = any($1::text[])", [subs.map((s) => s.id)])).map((r) => r.id))
  const missing = subs.filter((s) => !known.has(s.id))
  if (!missing.length) return
  const [cat, settings] = await Promise.all([getCatalog("en"), getSettings("en")])
  for (const s of missing) {
    const d = s.data as Parameters<typeof cj.createBooking>[1]
    // Bookings from before the server priced them carry the referral only in the notes.
    const referral = d.referral ?? (typeof d.notes === "string" ? d.notes.match(/Referral (\S+):/)?.[1] : undefined)
    // Priced as on the day it was made (promo codes, Plus, packs and sales tax).
    const now = new Date(s.created_at)
    try {
      await cj.createBooking(db, { ...d, id: s.id, createdAt: s.created_at, referral }, cat, { referralOff: settings.referral.friendOff, now })
    } catch (e) {
      if (!(e instanceof PricingError)) throw e
      await cj.importJobs(db, [submissionJob(s)])
      await cj.taxImported(db, s.id, now)
    }
  }
}

export async function syncJobs(): Promise<Job[]> {
  const db = await opsDb()
  if (db) {
    await catchUpBookings(db)
    return cj.listJobs(db)
  }
  const jobs = await all<Job>("jobs")
  const subs = await listSubmissions("booking", sinceOf(jobs))
  const known = new Set(jobs.map((j) => j.id))
  const fresh = subs.filter((s) => !known.has(s.id)).map(submissionJob)
  if (!fresh.length) return jobs
  await insertNew("jobs", fresh)
  return all<Job>("jobs")
}

export async function syncApplications(): Promise<Application[]> {
  const apps = await all<Application>("applications")
  const subs = await listSubmissions("apply", sinceOf(apps))
  const known = new Set(apps.map((a) => a.id))
  const fresh: Application[] = subs
    .filter((s) => !known.has(s.id))
    .map((s) => {
      const d = s.data as Record<string, unknown>
      return {
        id: s.id,
        createdAt: s.created_at,
        name: String(d.name),
        phone: normalisePhone(String(d.phone)),
        area: String(d.area),
        skills: (d.skills as string[]) ?? [],
        experience: String(d.experience ?? ""),
        availability: (d.availability as string[]) ?? [],
        transport: String(d.transport ?? ""),
        portfolio: d.portfolio ? String(d.portfolio) : undefined,
        lang: String(d.lang ?? "en"),
        status: "new",
        token: randomToken(),
      }
    })
  if (!fresh.length) return apps
  await insertNew("applications", fresh)
  return all<Application>("applications")
}

// ---------------------------------------------------------------------------
// Pros
// ---------------------------------------------------------------------------

export async function getPros(): Promise<Pro[]> {
  const db = await opsDb()
  return db ? cj.listPros(db) : all<Pro>("pros")
}

export async function getPro(id: string): Promise<Pro | null> {
  const db = await opsDb()
  return db ? cj.getProRow(db, id) : get<Pro>("pros", id)
}

export async function savePro(pro: Pro) {
  const db = await opsDb()
  if (db) await cj.savePro(db, pro)
  else await put("pros", pro)
}

export const getComplaints = () => all<Complaint>("complaints")

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** Every job (read only: no catch-up), for statistics like Ghar Scan's real price ranges. */
export async function allJobs(): Promise<Job[]> {
  const db = await opsDb()
  return db ? cj.listJobs(db, { sinceDays: 730 }) : all<Job>("jobs")
}

export async function getJob(id: string): Promise<Job | null> {
  const db = await opsDb()
  return db ? cj.getJob(db, id) : get<Job>("jobs", id)
}

/** Atomic change to one job (applied to the latest copy); null when it doesn't exist. */
async function changeJob(id: string, fn: (j: Job) => void): Promise<Job | null> {
  const db = await opsDb()
  const job = db ? await cj.mutateJob(db, id, fn) : await mutate<Job>("jobs", id, fn)
  // A change can mean a message or an offer (automation): run it soon.
  if (job && db) kick()
  return job
}

/** Atomic update of one job (re-reads the latest copy); throws when the job doesn't exist. */
export async function updateJob(id: string, fn: (j: Job) => void) {
  const j = await changeJob(id, fn)
  if (!j) throw new OpsError("Job not found")
  return j
}

/** Adds jobs built elsewhere (wedding plans), leaving any that already exist alone. */
export async function insertJobs(jobs: Job[]) {
  const db = await opsDb()
  if (db) await cj.importJobs(db, jobs)
  else await insertNew("jobs", jobs)
}

export class OpsError extends Error {}

export async function addJobEvent(jobId: string, type: JobEventType, by: JobEvent["by"], extra: Partial<JobEvent> = {}, opts: { proId?: string } = {}) {
  const job = await updateJob(jobId, (job) => {
    if (opts.proId !== undefined && job.proId !== opts.proId) throw new OpsError("This job isn't assigned to you")
    if (!ALLOWED[job.status].includes(type)) throw new OpsError(`Can't do "${type.replace("_", " ")}" while the job is ${job.status.replace("_", " ")}`)
    job.events.push({ type, at: nowIso(), by, ...(opts.proId ? { actor: opts.proId } : {}), ...extra })
    const next = STATUS_FOR[type]
    if (next) job.status = next
  })
  // Brief photos are for the visit only: delete them once it is over.
  const next = STATUS_FOR[type]
  if (next && FINAL.includes(next)) await remove("attachments", job.id).catch((e) => console.error("[ops] attachment cleanup failed", e))
  if (type === "cancelled") await withdrawOffers(job.id, extra.actor ?? by, "The visit was cancelled")
  if (type === "sos") await notifyOps(`[Mjazo SAFETY] SOS on ${job.id}`, `SOS raised by the pro on booking ${job.id} at ${job.address}, ${job.subArea ?? ""} ${job.area}.\nLocation: ${extra.lat ?? "?"}, ${extra.lng ?? "?"}\nCall the pro now.`)
  return job
}

export type JobWithSafety = Job & { safety: SafetyStatus }

/** Adds the ping / escalation events a job is due (mutates it). Returns the status if it was just escalated. */
function applyAlerts(j: Job, now: string, cat: OpsCatalog): SafetyStatus | null {
  let s = safetyStatus(j, now, cat)
  const since = j.events.filter((x) => x.type === "checked_in" || x.type === "safe").map((x) => x.at).sort().slice(-1)[0] ?? ""
  if (s.level === "overdue" && !j.events.some((e) => e.type === "alert_ping" && e.at > since)) {
    j.events.push({ type: "alert_ping", at: now, by: "system", note: "Are you safe? Tap ‘I'm safe’ or check out." })
    s = safetyStatus(j, now, cat)
  }
  const lastPing = j.events.filter((x) => x.type === "alert_ping").map((x) => x.at).sort().slice(-1)[0] ?? ""
  if (s.level === "escalated" && !j.events.some((e) => e.type === "alert_escalated" && e.at > lastPing)) {
    j.events.push({ type: "alert_escalated", at: now, by: "system", note: s.message })
    return s
  }
  return null
}

/** Safety Guardian sweep: ping overdue pros once, escalate unanswered pings to ops once. */
export async function safetySweep(jobs: Job[]): Promise<JobWithSafety[]> {
  const cat = await getCatalog()
  const today = karachiNow().date
  const now = nowIso()
  const out: JobWithSafety[] = []
  for (const j0 of jobs) {
    if (j0.date !== today) {
      out.push({ ...j0, safety: { level: "ok", message: "" } })
      continue
    }
    let j = j0
    const probe = structuredClone(j0)
    applyAlerts(probe, now, cat)
    if (probe.events.length !== j0.events.length) {
      // Re-apply on the latest copy so a check-out that just landed isn't overwritten.
      let escalated: SafetyStatus | null = null
      j = (await changeJob(j0.id, (d) => void (escalated = applyAlerts(d, now, cat)))) ?? j0
      const e = escalated as SafetyStatus | null
      if (e) void notifyOps(`[Mjazo SAFETY] No reply on ${j.id}`, `${e.message}. Pro ${j.proId ?? "?"} at ${j.address}, ${j.subArea ?? ""} ${j.area}. Call the pro, then the customer.`)
    }
    out.push({ ...j, safety: safetyStatus(j, now, cat) })
  }
  return out
}

/** A pro's visits and earnings over the last 7 days (from the ledger when the core is on). */
export async function earningsFor(proId: string, jobs: Job[]) {
  const today = karachiNow().date
  const weekAgo = new Date(new Date(`${today}T00:00:00Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10)
  const db = await opsDb()
  if (db) return earnedSince(db, proId, `${weekAgo}T00:00:00+05:00`)
  const done = jobs.filter((j) => j.proId === proId && j.status === "completed" && j.date >= weekAgo)
  return { visits: done.length, earned: Math.round(done.reduce((s, j) => s + j.total, 0) * OPS.proShare) }
}

export { OPS }

export const publicPro = ({ pinHash, ...p }: Pro) => ({ ...p, hasPin: Boolean(pinHash) })

/** `actor`: the staff email recorded on the assignment (Route Brain passes the person who applied its plan). */
export async function assignJob(jobId: string, proId: string | null, plan: { eta?: string; routeOrder?: number } = {}, actor?: string) {
  if (proId && !(await getPro(proId))) throw new OpsError("Pro not found")
  const job = await updateJob(jobId, (job) => {
    if (!["new", "assigned", "en_route", "cancelled", "no_show"].includes(job.status)) throw new OpsError("This job is already under way")
    if (proId === null) {
      delete job.proId
      delete job.eta
      delete job.routeOrder
      job.status = "new"
      job.events.push({ type: "note", at: nowIso(), by: "ops", actor, note: "Unassigned" })
    } else {
      const changed = job.proId !== proId
      Object.assign(job, { proId, eta: plan.eta ?? job.eta, routeOrder: plan.routeOrder ?? job.routeOrder, status: "assigned" })
      if (changed) job.events.push({ type: "assigned", at: nowIso(), by: "ops", actor, note: proId })
    }
  })
  if (proId) await withdrawOffers(jobId, actor ?? "ops", "Assigned directly by ops")
  return job
}

/** Create the pipeline entry (with its interview link token) as soon as someone applies. */
export async function createApplication(id: string, d: Record<string, unknown>) {
  const app: Application = {
    id,
    createdAt: nowIso(),
    name: String(d.name),
    phone: normalisePhone(String(d.phone)),
    area: String(d.area),
    skills: (d.skills as string[]) ?? [],
    experience: String(d.experience ?? ""),
    availability: (d.availability as string[]) ?? [],
    transport: String(d.transport ?? ""),
    portfolio: d.portfolio ? String(d.portfolio) : undefined,
    lang: String(d.lang ?? "en"),
    status: "new",
    token: randomToken(),
  }
  await insertNew("applications", [app])
  return (await get<Application>("applications", id)) ?? app
}

export async function findApplication(token: string) {
  if (!token || token.length < 16) return null
  return (await all<Application>("applications")).find((a) => a.token === token) ?? null
}

export type SosDoc = { id: string; proId: string; at: string; lat?: number; lng?: number; resolved?: boolean; resolvedAt?: string }
export const getOpenSos = async () => (await all<SosDoc>("sos")).filter((s) => !s.resolved)

// ---------------------------------------------------------------------------
// Mission control (platform stage 2): booking pages, money, pros' profiles, zones, promo codes,
// the requests inbox, KPIs and the audit log. Money moves only through lib/core/money.ts, which
// posts through lib/core/ledger.ts; jobs change only through updateJob() (mutateJob on the core).
// ---------------------------------------------------------------------------

/** The core database, for the screens that only exist on it (money, promo codes, …). */
async function needCore(): Promise<Db> {
  const db = await opsDb()
  if (!db) throw new OpsError("This needs the core database (DATABASE_URL).")
  return db
}

const daysAgo = (n: number) => new Date(new Date(`${karachiNow().date}T00:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10)

/** Route Brain's and checkout's day-level limits (zone caps), when the core is on. */
export async function opsLimits(): Promise<PlanLimits> {
  const db = await opsDb()
  return db ? { zoneCaps: await cpros.zoneCaps(db) } : {}
}

// Bookings -------------------------------------------------------------------

/** Everything the booking page shows: the job, its money (ledger entries, refunds and credits) and the customer's balances. */
export async function bookingDetail(id: string) {
  const job = await getJob(id)
  if (!job) throw new OpsError("Booking not found")
  const db = await opsDb()
  if (!db) return { job, money: null, ledger: [], requests: [], customer: null, offer: null }
  const row = await db.one<{ customer_id: string | null; subtotal: number; discount: number; promo_code: string | null; client_total: number | null }>("select customer_id, subtotal, discount, promo_code, client_total from bookings where id = $1", [id])
  const ledger = await bookingEntries(db, id)
  const requests = await money.listMoneyRequests(db, { bookingId: id })
  const paid = await bookingPaid(db, id)
  let customer = null
  if (row?.customer_id) {
    const bal = await customerBalances(db, row.customer_id)
    const visits = (await db.one<{ n: number }>("select count(*)::int as n from bookings where customer_id = $1 and status = 'completed'", [row.customer_id]))!.n
    customer = { id: row.customer_id, ...bal, visits }
  }
  const open = (await offers.listOffers(db, { bookingIds: [id], status: "pending" }))[0]
  const offer = open ? { id: open.id, jobId: id, proId: open.proId, expiresAt: open.expiresAt } : null
  const r = job.status === "completed" ? await ensureReceipt(db, job) : null
  const receipt = r ? { number: r.number, url: receiptUrl(r) } : null
  // A regular customer of her pro: Mjazo's lower share (once it's done, the ledger's memo says it).
  const proRate = job.proId && job.status !== "completed" ? await db.one<{ commission_rate: number }>("select commission_rate from pros where id = $1", [job.proId]) : null
  const rate = proRate && job.proId ? (await pairRates(db, [{ bookingId: id, proId: job.proId, proRate: proRate.commission_rate }])).get(id) : undefined
  const pairRate = rate?.regular ? { rate: rate.rate } : null
  return { job, money: { subtotal: row?.subtotal ?? job.total, discount: row?.discount ?? 0, promo: row?.promo_code ?? null, ...paid }, ledger, requests, customer, offer, receipt, pairRate }
}

export const addBookingNote = (id: string, note: string, actor: string) => addJobEvent(id, "note", "ops", { note, actor })

/** Ops are cancelling a visit no pro took because nobody could come (the favourite-pro guarantee's credit follows). */
export async function markNobodyCame(id: string, by: string) {
  const job = await getJob(id)
  if (!job) throw new OpsError("Booking not found")
  if (job.proId) throw new OpsError("A pro has this visit: unassign her first, or cancel it without the guarantee")
  const db = await opsDb()
  if (db) await markOnce(db, nobodyCameKey(id), { by })
}

/**
 * Moves a booking to another day or window, before the visit starts. Checks capacity first (the
 * same check as checkout) unless `force`; returns { full: true } and changes nothing when the
 * window is full. An assigned pro is taken off it, to be dispatched again.
 */
export async function rescheduleJob(id: string, to: { date: string; window: string }, actor: string, opts: { reason?: string; force?: boolean; by?: "ops" | "customer" } = {}): Promise<{ job: Job | null; full: boolean }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to.date) || to.date < karachiNow().date) throw new OpsError("Pick today or a later day")
  if (!WINDOW_LABELS.includes(to.window)) throw new OpsError("Pick an arrival window")
  const current = await getJob(id)
  if (!current) throw new OpsError("Booking not found")
  const db = await opsDb()
  if (db && !opts.force) {
    const [jobs, pros, cat, limits] = [await cj.listJobs(db, { sinceDays: 0 }), await cj.listPros(db), await getCatalog(), await opsLimits()]
    const others = jobs.filter((j) => j.id !== id)
    if (!windowOpen(to.date, to.window, others, pros, { area: current.area, items: current.items }, cat, limits)) return { job: null, full: true }
  }
  const job = await updateJob(id, (j) => {
    if (!ALLOWED[j.status].includes("rescheduled")) throw new OpsError("This visit has started or is over, so it can't be moved")
    if (j.date === to.date && j.window === to.window) throw new OpsError("That's the day and window it already has")
    const from = `${j.date}, ${j.window}`
    const hadPro = j.proId
    j.date = to.date
    j.window = to.window
    if (hadPro) {
      delete j.proId
      delete j.eta
      delete j.routeOrder
      j.status = "new"
      // A customer who moves their visit most likely wants the same pro again.
      if (opts.by === "customer") j.preferredProId ??= hadPro
    }
    const why = opts.reason?.trim() ? `: ${opts.reason.trim().slice(0, 200)}` : ""
    j.events.push({ type: "rescheduled", at: nowIso(), by: opts.by ?? "ops", actor, note: `From ${from} to ${to.date}, ${to.window}${why}${hadPro ? ` (${hadPro} taken off it)` : ""}${opts.force ? " (booked over capacity)" : ""}` })
  })
  await withdrawOffers(id, actor, "The visit was moved")
  return { job, full: false }
}

// Job offers (the pro app) -------------------------------------------------------

export async function offerJob(o: { bookingId: string; proId: string; by: string }) {
  const r = await offers.offerJob(await needCore(), o)
  kick()
  return r
}
export async function answerOffer(a: Parameters<typeof offers.answerOffer>[1]) {
  const r = await offers.answerOffer(await needCore(), a)
  kick()
  return r
}
export const listOffers = async (f: Parameters<typeof offers.listOffers>[1]) => offers.listOffers(await needCore(), f)

/** Withdraws a visit's open offer, if there is one (nothing to do without the core). */
export async function withdrawOffers(bookingId: string, by: string, reason?: string) {
  const db = await opsDb()
  return db ? offers.withdrawOffers(db, bookingId, by, reason) : 0
}

/** Open offers by booking, for the board and the booking page (none without the core). */
export async function openOffers(bookingIds?: string[]) {
  const db = await opsDb()
  return db ? offers.listOffers(db, { status: "pending", bookingIds }) : []
}

// Money ----------------------------------------------------------------------

export const requestMoney = async (r: { kind: "refund" | "credit"; bookingId: string; amount: number; reason: string; by: string }) => money.requestMoney(await needCore(), r)
export const decideMoney = async (id: string, d: Parameters<typeof money.decideMoney>[2]) => money.decideMoney(await needCore(), id, d)
export const recordCashIn = async (c: Parameters<typeof money.recordCashIn>[1]) => money.recordCashIn(await needCore(), c)
export const draftPayoutRun = async (p: Parameters<typeof money.draftPayoutRun>[1]) => money.draftPayoutRun(await needCore(), p)
export const approvePayoutRun = async (id: string, by: money.Actor) => money.approvePayoutRun(await needCore(), id, by)
export const payPayout = async (id: string, p: Parameters<typeof money.payPayout>[2]) => money.payPayout(await needCore(), id, p)
export const cancelPayoutRun = async (id: string, by: string) => money.cancelPayoutRun(await needCore(), id, by)

/** The money screen: cash held and owed per pro, payments to check, refunds and credits waiting, payout runs, and the books' balance check. */
export async function moneyOverview() {
  const db = await needCore()
  const pros = await cj.listPros(db)
  const balances = await allProBalances(db)
  const jobs = await cj.listJobs(db, { sinceDays: 45 })
  const since = daysAgo(30)
  const name = (id?: string) => pros.find((p) => p.id === id)?.name ?? id ?? "—"
  const perPro = pros
    .map((p) => ({ proId: p.id, name: p.name, phone: p.phone, status: p.status, ...(balances.get(p.id) ?? { cashHeld: 0, payable: 0 }) }))
    .filter((p) => p.cashHeld || p.payable || p.status === "active")
    .sort((a, b) => b.cashHeld - a.cashHeld || b.payable - a.payable)
  const unreconciled = jobs
    .filter((j) => j.status === "completed" && j.date >= since && paymentNeedsCheck(j))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((j) => ({ id: j.id, date: j.date, pro: name(j.proId), customer: j.customer.name, total: j.total, booked: j.payment, record: j.paymentRecord ? { ...j.paymentRecord, screenshot: j.paymentRecord.screenshot ? "1" : undefined } : null }))
  const pending = await money.listMoneyRequests(db, { status: "pending" })
  const decided = (await money.listMoneyRequests(db, { limit: 30 })).filter((r) => r.status !== "pending")
  const runs = await money.listPayoutRuns(db)
  const trial = await trialBalance(db)
  return {
    perPro,
    totals: { cashHeld: perPro.reduce((s, p) => s + Math.max(0, p.cashHeld), 0), payable: perPro.reduce((s, p) => s + Math.max(0, p.payable), 0) },
    unreconciled,
    pending,
    decided,
    runs,
    trial,
  }
}

// Promo codes ------------------------------------------------------------------

export const listPromos = async () => promos.listPromos(await needCore())
export const savePromo = async (p: promos.PromoInput, by: string, create: boolean) => promos.savePromo(await needCore(), p, by, create)

// Pros: profile, verification, zones --------------------------------------------

export async function saveProProfile(id: string, patch: cpros.ProProfilePatch) {
  const cat = await getCatalog()
  await cpros.setProProfile(await needCore(), id, patch, cat.areas.map((a) => a.slug))
  return getPro(id)
}

export async function verifyPro(id: string, key: VerificationKey, v: { done: boolean; last4?: string; note?: string }, actor: string) {
  await cpros.setVerification(await needCore(), id, key, v, actor)
  return getPro(id)
}

/** Zones with their caps, the active pros who cover each, and the visits booked today and tomorrow. */
export async function zonesOverview() {
  const db = await needCore()
  const cat = await getCatalog()
  await cpros.ensureZones(db, cat.areas)
  const zones = await cpros.listZones(db)
  const pros = (await cj.listPros(db)).filter((p) => p.status === "active")
  const jobs = await cj.listJobs(db, { sinceDays: 0 })
  const today = karachiNow().date
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
  const booked = (slug: string, d: string) => jobs.filter((j) => j.area === slug && j.date === d && j.status !== "cancelled" && j.status !== "no_show").length
  return zones.map((z) => ({
    ...z,
    homePros: pros.filter((p) => p.area === z.slug).length,
    coverPros: pros.filter((p) => p.area === z.slug || !p.zones?.length || p.zones.includes(z.slug)).length,
    today: booked(z.slug, today),
    tomorrow: booked(z.slug, tomorrow),
  }))
}

export const setZoneCap = async (slug: string, cap: number | null) => cpros.setZoneCap(await needCore(), slug, cap)

// The requests inbox ---------------------------------------------------------------

export type InboxKind = "plus" | "gift" | "referral" | "pulse" | "wedding" | "business" | "contact" | "handoff" | "page" | "request"
export type InboxItem = { id: string; createdAt: string; kind: InboxKind; name: string; phone: string; email?: string; message?: string; details?: Record<string, unknown>; status: creq.RequestStatus; note: string | null; handledBy: string | null; updatedAt: string | null }

/** Enquiries (Plus, gift cards, referrals, Home Pulse and the rest) and WhatsApp requests from the website, with how far the team has got. */
export async function requestsInbox(days = 90): Promise<InboxItem[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const [enquiries, requests] = await Promise.all([listSubmissions("enquiry", since), listSubmissions("request", since)])
  const items: Omit<InboxItem, "status" | "note" | "handledBy" | "updatedAt">[] = [
    ...enquiries.map((e) => {
      const d = e.data as { kind: string; name: string; phone: string; email?: string; message?: string; details?: Record<string, unknown> }
      const kind = (d.kind === "contact" && d.details?.referralCode ? "referral" : d.kind) as InboxKind
      return { id: e.id, createdAt: e.created_at, kind, name: d.name, phone: d.phone, email: d.email || undefined, message: d.message, details: d.details }
    }),
    ...requests.map((r) => {
      const d = r.data as { name: string; phone: string; area: string; services: string; when?: string }
      return { id: r.id, createdAt: r.created_at, kind: "request" as const, name: d.name, phone: d.phone, message: `${d.services}${d.when ? ` · ${d.when}` : ""} · ${d.area}` }
    }),
  ]
  const db = await opsDb()
  const states = db ? await creq.requestStates(db, items.map((i) => i.id)) : new Map((await all<{ id: string } & creq.RequestState>("requests")).map((r) => [r.id, r]))
  return items
    .map((i) => {
      const st = states.get(i.id)
      return { ...i, status: st?.status ?? "new", note: st?.note ?? null, handledBy: st?.handledBy ?? null, updatedAt: st?.updatedAt ?? null }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function setRequestStatus(id: string, status: creq.RequestStatus, note: string | undefined, by: string) {
  const db = await opsDb()
  if (db) return creq.setRequestState(db, id, { status, note }, by)
  const cur = await get<{ id: string } & creq.RequestState>("requests", id)
  await put("requests", { id, status, note: note?.trim() || cur?.note || null, handledBy: by, updatedAt: nowIso() })
}

// KPIs and the audit log -----------------------------------------------------------

/** The KPI dashboard for the last `days` days (today included). */
export async function kpiReport(days: number) {
  const to = karachiNow().date
  const from = daysAgo(days - 1)
  const jobs = await allJobs()
  const k = computeKpis(jobs, from, to)
  const db = await opsDb()
  const balances = db ? [...(await allProBalances(db)).values()] : []
  const unreconciled = jobs.filter((j) => j.status === "completed" && j.date >= from && j.date <= to && paymentNeedsCheck(j))
  return {
    ...k,
    cashHeld: balances.reduce((s, b) => s + Math.max(0, b.cashHeld), 0),
    unreconciled: { count: unreconciled.length, amount: unreconciled.reduce((s, j) => s + j.total, 0) },
    books: db ? (await trialBalance(db)).balanced : null,
  }
}

export async function auditLog(f: AuditFilter = {}) {
  const db = await opsDb()
  if (db) return listAudit(db, f)
  return (await recentAudit(f.limit ?? 100)).map((a, i) => ({ id: i + 1, at: a.at, actor: a.actor, action: a.action, target: a.target ?? null, detail: a.detail ?? null }))
}
