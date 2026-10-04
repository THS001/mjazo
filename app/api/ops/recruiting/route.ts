import { audit } from "@/lib/server/audit"
import { z } from "zod"
import { SITE_URL } from "@/lib/site"
import { getCatalog } from "@/lib/cms/read"
import { karachiNow } from "@/lib/time"
import { handle, readJson } from "@/lib/server/api"
import { hashPin, requireOps } from "@/lib/server/session"
import { all, get, put } from "@/lib/server/docs"
import { OpsError, getPros, nowIso, syncApplications, syncJobs } from "@/lib/server/ops"
import { SKILL_TO_CATEGORIES, demandForecast } from "@/lib/ops/logic"
import type { Application, Pro } from "@/lib/ops/types"

// Recruiter Agent pipeline: applications with AI interview scores, plus the demand forecast that
// says where (area × category) more pros are needed. Decisions always stay with a person.

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), id: z.string(), status: z.enum(["new", "interviewing", "interviewed", "test_booked", "declined"]), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("hire"), id: z.string(), pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits"), note: z.string().max(500).optional() }),
])

export async function GET() {
  return handle(async () => {
    await requireOps()
    const [apps, jobs, pros] = await Promise.all([syncApplications(), syncJobs(), getPros()])
    return {
      applications: apps.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => ({ ...a, link: `${SITE_URL}/partner/interview/${a.token}` })),
      forecast: demandForecast(jobs, pros, karachiNow().date, await getCatalog()).slice(0, 12),
    }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireOps()
    const b = body.parse(await readJson(req))
    const app = await get<Application>("applications", b.id)
    if (!app) throw new OpsError("Application not found")
    if (b.action === "status") {
      Object.assign(app, { status: b.status, decisionNote: b.note ?? app.decisionNote })
      await put("applications", app)
      await audit("ops", "applicant " + b.status, app.id, b.note)
      return { application: app }
    }
    if (app.proId) throw new OpsError("Already hired")
    if ((await all<Pro>("pros")).some((p) => p.phone === app.phone)) throw new OpsError("A pro with this number already exists")
    const pro: Pro = {
      id: `P-${app.id.replace(/^MJ-/, "")}`,
      name: app.name,
      phone: app.phone,
      area: app.area,
      skills: [...new Set(app.skills.flatMap((s) => SKILL_TO_CATEGORIES[s] ?? []))],
      women: true, // the partner programme recruits women pros for women customers
      status: "active",
      pinHash: hashPin(b.pin),
      createdAt: nowIso(),
      applicationId: app.id,
    }
    await put("pros", pro)
    Object.assign(app, { status: "hired", proId: pro.id, decisionNote: b.note ?? app.decisionNote })
    await put("applications", app)
    await audit("ops", "hired applicant", app.id, pro.id)
    return { application: app }
  })
}
