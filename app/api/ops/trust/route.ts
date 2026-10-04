import { audit } from "@/lib/server/audit"
import { z } from "zod"
import { aiEnabled } from "@/lib/ai/anthropic"
import { draftComplaint } from "@/lib/ai/staff-agents"
import { karachiNow } from "@/lib/time"
import { handle, readJson } from "@/lib/server/api"
import { requireOps } from "@/lib/server/session"
import { get, put } from "@/lib/server/docs"
import { OpsError, getComplaints, getJob, getPros, nowIso, syncJobs, updateJob } from "@/lib/server/ops"
import type { Complaint } from "@/lib/ops/types"
import { paymentNeedsCheck } from "@/lib/ops/logic"

// Trust Desk: payment reconciliation (screenshots read by AI, checked by people) and complaints
// with AI-drafted, policy-based resolutions that a person approves.

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify"), jobId: z.string(), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("record"), jobId: z.string(), amount: z.number().min(0), method: z.enum(["cash", "jazzcash", "easypaisa", "raast"]) }),
  z.object({ action: z.literal("draft"), id: z.string() }),
  z.object({ action: z.literal("resolve"), id: z.string(), resolution: z.string().min(2).max(1000) }),
])

export async function GET(req: Request) {
  return handle(async () => {
    await requireOps()
    const shot = new URL(req.url).searchParams.get("shot")
    if (shot) return { screenshot: (await getJob(shot))?.paymentRecord?.screenshot ?? null }
    const media = new URL(req.url).searchParams.get("media")
    if (media) {
      const c = await get<Complaint>("complaints", media)
      return { photo: c?.photo ?? null, audio: c?.audio ?? null }
    }
    const today = karachiNow().date
    const since = new Date(new Date(`${today}T00:00:00Z`).getTime() - 13 * 86400000).toISOString().slice(0, 10)
    const [jobs, pros, complaints] = await Promise.all([syncJobs(), getPros(), getComplaints()])
    const name = (id?: string) => pros.find((p) => p.id === id)?.name ?? "—"
    const cash = jobs
      .filter((j) => j.status === "completed" && j.date >= since)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((j) => ({ id: j.id, date: j.date, pro: name(j.proId), customer: j.customer.name, total: j.total, booked: j.payment, needsCheck: paymentNeedsCheck(j), record: j.paymentRecord ? { ...j.paymentRecord, screenshot: j.paymentRecord.screenshot ? "1" : undefined } : null }))
    const expected = cash.reduce((s, r) => s + r.total, 0)
    const collected = cash.reduce((s, r) => s + (r.record?.amount ?? 0), 0)
    return { cash, expected, collected, complaints: complaints.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => ({ ...c, photo: c.photo ? "1" : undefined, audio: c.audio ? "1" : undefined })), ai: aiEnabled() }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireOps()
    const b = body.parse(await readJson(req))
    if (b.action === "verify" || b.action === "record") {
      await updateJob(b.jobId, (job) => {
        if (b.action === "record") job.paymentRecord = { amount: b.amount, method: b.method, at: nowIso(), status: b.method === "cash" ? "cash" : "matched", checked: true, note: "Recorded by ops" }
        else if (job.paymentRecord) Object.assign(job.paymentRecord, { checked: true, note: b.note || "Checked by ops" })
        else throw new OpsError("No payment recorded yet")
        job.events.push({ type: "payment", at: nowIso(), by: "ops", note: job.paymentRecord.note })
      })
      await audit("ops", b.action === "record" ? "recorded payment" : "checked payment", b.jobId, b.action === "record" ? b.method + " " + b.amount : b.note)
      return { ok: true }
    }
    const c = await get<Complaint>("complaints", b.id)
    if (!c) throw new OpsError("Complaint not found")
    if (b.action === "draft") {
      if (!aiEnabled()) throw new OpsError("AI isn't switched on (ANTHROPIC_API_KEY)")
      c.draft = await draftComplaint(c, await getJob(c.bookingId))
      c.status = "draft_ready"
    } else Object.assign(c, { status: "resolved", resolution: b.resolution, resolvedAt: nowIso() })
    await put("complaints", c)
    await audit(b.action === "draft" ? "system" : "ops", b.action === "draft" ? "drafted complaint resolution" : "resolved complaint", c.id, b.action === "resolve" ? b.resolution : c.draft?.resolution)
    return { complaint: { ...c, photo: c.photo ? "1" : undefined, audio: c.audio ? "1" : undefined } }
  })
}
