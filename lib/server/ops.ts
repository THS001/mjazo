import "server-only"
import { all, get, insertNew, mutate, put, remove } from "./docs"
import { listSubmissions, notifyOps, type StoredSubmission } from "./store"
import { randomToken } from "./session"
import { karachiNow } from "@/lib/time"
import { OPS, safetyStatus, type OpsCatalog } from "@/lib/ops/logic"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { core, type Db } from "@/lib/core/db"
import * as cj from "@/lib/core/jobs"
import { earnedSince } from "@/lib/core/ledger"
import { normalisePhone } from "@/lib/core/phone"
import { PricingError } from "@/lib/core/pricing"
import { ALLOWED, FINAL, STATUS_FOR } from "@/lib/core/status"
import type { Application, Complaint, Job, JobEvent, JobEventType, Pro, SafetyStatus } from "@/lib/ops/types"

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
    try {
      await cj.createBooking(db, { ...d, id: s.id, createdAt: s.created_at, referral }, cat, { referralOff: settings.referral.friendOff })
    } catch (e) {
      if (!(e instanceof PricingError)) throw e
      await cj.importJobs(db, [submissionJob(s)])
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
  return db ? cj.mutateJob(db, id, fn) : mutate<Job>("jobs", id, fn)
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
    job.events.push({ type, at: nowIso(), by, ...extra })
    const next = STATUS_FOR[type]
    if (next) job.status = next
  })
  // Brief photos are for the visit only: delete them once it is over.
  const next = STATUS_FOR[type]
  if (next && FINAL.includes(next)) await remove("attachments", job.id).catch((e) => console.error("[ops] attachment cleanup failed", e))
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

export async function assignJob(jobId: string, proId: string | null, plan: { eta?: string; routeOrder?: number } = {}) {
  if (proId && !(await getPro(proId))) throw new OpsError("Pro not found")
  return updateJob(jobId, (job) => {
    if (!["new", "assigned", "en_route", "cancelled", "no_show"].includes(job.status)) throw new OpsError("This job is already under way")
    if (proId === null) {
      delete job.proId
      delete job.eta
      delete job.routeOrder
      job.status = "new"
      job.events.push({ type: "note", at: nowIso(), by: "ops", note: "Unassigned" })
    } else {
      const changed = job.proId !== proId
      Object.assign(job, { proId, eta: plan.eta ?? job.eta, routeOrder: plan.routeOrder ?? job.routeOrder, status: "assigned" })
      if (changed) job.events.push({ type: "assigned", at: nowIso(), by: "ops", note: proId })
    }
  })
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
