import { z } from "zod"
import { karachiNow } from "@/lib/time"
import { getCatalog } from "@/lib/cms/read"
import { leakageWatch, morningDigest, qualityReport, type LeakState } from "@/lib/ops/trust"
import { handle, readJson } from "@/lib/server/api"
import { requireOps } from "@/lib/server/session"
import { all, put } from "@/lib/server/docs"
import { audit, recentAudit } from "@/lib/server/audit"
import { getComplaints, getPros, nowIso, syncJobs } from "@/lib/server/ops"

// Trust Desk, Phase 3: morning digest, quality drift, leakage watch and the audit log.

const body = z.object({ action: z.enum(["leak_checkin", "leak_dismiss"]), key: z.string().min(3).max(80), note: z.string().max(300).optional() })

export async function GET() {
  return handle(async () => {
    await requireOps()
    const today = karachiNow().date
    const [jobs, pros, complaints, states, log, weddings] = await Promise.all([syncJobs(), getPros(), getComplaints(), all<LeakState>("leak"), recentAudit(80), all<{ id: string; status: string }>("weddings")])
    const cat = await getCatalog()
    const quality = qualityReport(jobs, pros, complaints, today, cat)
    const leakage = leakageWatch(jobs, pros, today, states, cat)
    const pendingWeddings = weddings.filter((w) => w.status === "submitted").length
    return { today, digest: morningDigest(jobs, complaints, quality, leakage, today, nowIso(), pendingWeddings), quality, leakage, audit: log }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireOps()
    const b = body.parse(await readJson(req))
    const status = b.action === "leak_checkin" ? "checked_in" : "dismissed"
    await put<LeakState>("leak", { id: b.key, status, at: nowIso(), note: b.note })
    await audit("ops", b.action === "leak_checkin" ? "leakage check-in sent" : "leakage flag dismissed", b.key.split("|")[1], b.note)
    return { ok: true }
  })
}
