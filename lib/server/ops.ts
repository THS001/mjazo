import "server-only"
import { all, get, insertNew, mutate, remove } from "./docs"
import { listSubmissions, notifyOps } from "./store"
import { randomToken } from "./session"
import { karachiNow } from "@/lib/time"
import { OPS, safetyStatus, type OpsCatalog } from "@/lib/ops/logic"
import { getCatalog } from "@/lib/cms/read"
import type { Application, Complaint, Job, JobEvent, JobEventType, JobStatus, Pro, SafetyStatus } from "@/lib/ops/types"

// Ops domain on top of the document store. Bookings and applications arrive as website
// submissions and are turned into jobs / pipeline entries the first time ops reads them.

export const nowIso = () => new Date().toISOString()

/** Only look at submissions from a little before the newest one already synced. */
const sinceOf = (docs: { createdAt: string }[]) => {
  const last = docs.reduce((m, d) => Math.max(m, Date.parse(d.createdAt) || 0), 0)
  return last ? new Date(last - 3600_000).toISOString() : undefined
}

export async function syncJobs(): Promise<Job[]> {
  const jobs = await all<Job>("jobs")
  const subs = await listSubmissions("booking", sinceOf(jobs))
  const known = new Set(jobs.map((j) => j.id))
  const fresh: Job[] = []
  for (const s of subs) {
    if (known.has(s.id)) continue
    const d = s.data as Record<string, unknown>
    fresh.push({
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
    })
  }
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

export const getPros = () => all<Pro>("pros")
export const getComplaints = () => all<Complaint>("complaints")
export const getJob = (id: string) => get<Job>("jobs", id)

/** Atomic update of one job (re-reads the latest copy); throws when the job doesn't exist. */
export async function updateJob(id: string, fn: (j: Job) => void) {
  const j = await mutate<Job>("jobs", id, fn)
  if (!j) throw new OpsError("Job not found")
  return j
}

const STATUS_FOR: Partial<Record<JobEventType, JobStatus>> = {
  assigned: "assigned",
  en_route: "en_route",
  checked_in: "checked_in",
  checked_out: "checked_out",
  completed: "completed",
  cancelled: "cancelled",
}
const ALLOWED: Record<JobStatus, JobEventType[]> = {
  new: ["assigned", "cancelled", "note"],
  assigned: ["assigned", "en_route", "checked_in", "cancelled", "note", "sos", "safe"],
  en_route: ["checked_in", "assigned", "cancelled", "note", "sos", "safe"],
  checked_in: ["checked_out", "note", "sos", "safe", "payment"],
  checked_out: ["completed", "payment", "note", "sos", "safe"],
  completed: ["payment", "note"],
  cancelled: ["note", "assigned"],
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
  if (type === "completed" || type === "cancelled") await remove("attachments", job.id).catch((e) => console.error("[ops] attachment cleanup failed", e))
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
      j = (await mutate<Job>("jobs", j0.id, (d) => void (escalated = applyAlerts(d, now, cat)))) ?? j0
      const e = escalated as SafetyStatus | null
      if (e) void notifyOps(`[Mjazo SAFETY] No reply on ${j.id}`, `${e.message}. Pro ${j.proId ?? "?"} at ${j.address}, ${j.subArea ?? ""} ${j.area}. Call the pro, then the customer.`)
    }
    out.push({ ...j, safety: safetyStatus(j, now, cat) })
  }
  return out
}

export async function earningsFor(proId: string, jobs: Job[]) {
  const today = karachiNow().date
  const weekAgo = new Date(new Date(`${today}T00:00:00Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10)
  const done = jobs.filter((j) => j.proId === proId && j.status === "completed" && j.date >= weekAgo)
  return { visits: done.length, earned: Math.round(done.reduce((s, j) => s + j.total, 0) * OPS.proShare) }
}

export { OPS }

/** 03xxxxxxxxx form for matching phones typed in different ways. */
export function normalisePhone(p: string) {
  const d = p.replace(/\D/g, "")
  if (d.startsWith("0092")) return `0${d.slice(4)}`
  if (d.startsWith("92")) return `0${d.slice(2)}`
  return d.startsWith("0") ? d : `0${d}`
}

export const publicPro = ({ pinHash, ...p }: Pro) => ({ ...p, hasPin: Boolean(pinHash) })

export async function assignJob(jobId: string, proId: string | null, plan: { eta?: string; routeOrder?: number } = {}) {
  return updateJob(jobId, (job) => {
    if (!["new", "assigned", "en_route", "cancelled"].includes(job.status)) throw new OpsError("This job is already under way")
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
