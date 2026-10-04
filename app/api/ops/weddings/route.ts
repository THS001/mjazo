import { z } from "zod"
import { computeSchedule } from "@/lib/shaadi"
import { karachiNow } from "@/lib/time"
import { getCatalog } from "@/lib/cms/read"
import { handle, readJson } from "@/lib/server/api"
import { audit } from "@/lib/server/audit"
import { all, get, insertNew, mutate } from "@/lib/server/docs"
import { requireOps } from "@/lib/server/session"
import { OpsError, nowIso } from "@/lib/server/ops"
import { weddingJobs } from "@/lib/server/weddings"
import type { WeddingDoc } from "@/app/api/shaadi/submit/route"

// Wedding coordinator: review Shaadi Orchestrator plans; approving creates the visits as jobs.

const body = z.object({ action: z.enum(["approve", "decline"]), id: z.string(), note: z.string().max(500).optional() })

export async function GET() {
  return handle(async () => {
    await requireOps()
    const today = karachiNow().date
    const docs = (await all<WeddingDoc>("weddings")).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const cat = await getCatalog()
    return { weddings: docs.map((d) => ({ ...d, schedule: computeSchedule(d.plan, today, cat) })) }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireOps()
    const b = body.parse(await readJson(req))
    const today = karachiNow().date
    const doc = await get<WeddingDoc>("weddings", b.id)
    if (!doc) throw new OpsError("Plan not found")
    if (b.action === "approve" && doc.plan.events.some((e) => e.date <= today)) throw new OpsError("An event date has passed: ask the family to update the plan")
    // Claim the decision first so two coordinators can't approve (and create visits) twice.
    let saved = await mutate<WeddingDoc>("weddings", b.id, (d) => {
      if (d.status !== "submitted") throw new OpsError(`This plan is already ${d.status}`)
      Object.assign(d, { status: b.action === "approve" ? "approved" : "declined", note: b.note, decidedAt: nowIso() })
    })
    let jobIds: string[] = []
    if (b.action === "approve") {
      try {
        const jobs = weddingJobs(doc.plan, doc.id, today, await getCatalog())
        await insertNew("jobs", jobs)
        jobIds = jobs.map((j) => j.id)
        saved = await mutate<WeddingDoc>("weddings", b.id, (d) => void (d.jobIds = jobIds))
      } catch (e) {
        await mutate<WeddingDoc>("weddings", b.id, (d) => void Object.assign(d, { status: "submitted", decidedAt: undefined }))
        throw e
      }
    }
    await audit("ops", b.action === "approve" ? "approved wedding plan" : "declined wedding plan", b.id, b.action === "approve" ? `${jobIds.length} visits created` : b.note)
    return { wedding: saved, created: jobIds.length }
  })
}
