import { audit } from "@/lib/server/audit"
import { z } from "zod"
import { aiEnabled } from "@/lib/ai/anthropic"
import { readReceipt } from "@/lib/ai/staff-agents"
import { formatPKR } from "@/lib/catalog"
import { handle, readJson } from "@/lib/server/api"
import { requirePro } from "@/lib/server/session"
import { put } from "@/lib/server/docs"
import { newId, notifyOps } from "@/lib/server/store"
import { OpsError, addJobEvent, getJob, getPros, nowIso, updateJob } from "@/lib/server/ops"
import type { PaymentRecord } from "@/lib/ops/types"

export const maxDuration = 60

// Pro actions on a job: on the way, check in, I'm safe, SOS, finish + payment, visit notes.

const geo = { lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }
const body = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["en_route", "check_in", "safe"]), jobId: z.string(), ...geo }),
  z.object({ action: z.literal("sos"), jobId: z.string().optional(), ...geo }),
  z.object({ action: z.literal("note"), jobId: z.string(), note: z.string().min(2).max(500) }),
  z.object({
    action: z.literal("complete"),
    jobId: z.string(),
    ...geo,
    payment: z.object({ method: z.enum(["cash", "jazzcash", "easypaisa", "raast"]), amount: z.number().min(0).max(1_000_000), screenshot: z.string().max(1_500_000).optional() }),
  }),
])

export async function POST(req: Request) {
  return handle(async () => {
    const { proId } = await requirePro()
    const b = body.parse(await readJson(req))
    const g = "lat" in b && b.lat !== undefined ? { lat: b.lat, lng: b.lng } : {}

    if (b.action === "sos") {
      await audit("pro", "SOS raised", b.jobId ?? proId)
      if (b.jobId) {
        const job = await getJob(b.jobId)
        if (job?.proId === proId && !["completed", "cancelled", "new"].includes(job.status)) return { job: await addJobEvent(b.jobId, "sos", "pro", g, { proId }) }
      }
      // SOS outside a job (on the road, between visits): still reaches ops at once.
      const pro = (await getPros()).find((p) => p.id === proId)
      await put("sos", { id: `S-${newId().slice(3)}`, proId, at: nowIso(), ...g })
      await notifyOps(`[Mjazo SAFETY] SOS from ${pro?.name ?? proId}`, `${pro?.name ?? proId} (${pro?.phone ?? ""}) pressed SOS.\nLocation: ${g.lat ?? "?"}, ${g.lng ?? "?"}\nCall her now.`)
      return { ok: true }
    }
    if (b.action === "en_route") return { job: await addJobEvent(b.jobId, "en_route", "pro", g, { proId }) }
    if (b.action === "check_in") return { job: await addJobEvent(b.jobId, "checked_in", "pro", g, { proId }) }
    if (b.action === "safe") return { job: await addJobEvent(b.jobId, "safe", "pro", g, { proId }) }

    if (b.action === "note") {
      await updateJob(b.jobId, (job) => {
        if (job.proId !== proId) throw new OpsError("This job isn't assigned to you")
        job.visitNotes = [...(job.visitNotes ?? []), `${job.date}: ${b.note}`]
      })
      return { ok: true }
    }

    if (b.action !== "complete") throw new OpsError("Unknown action")
    // complete: check out, record the payment (AI reads digital receipts), then mark done.
    if (b.payment.method !== "cash" && !b.payment.screenshot) throw new OpsError("Add a screenshot of the payment")
    let job = await getJob(b.jobId)
    if (!job || job.proId !== proId) throw new OpsError("This job isn't assigned to you")
    if (job.status === "checked_in") job = await addJobEvent(b.jobId, "checked_out", "pro", g, { proId })
    if (job.status !== "checked_out") throw new OpsError("Check in first, then finish the visit")
    const p = b.payment
    let record: PaymentRecord = { amount: p.amount, method: p.method, at: nowIso(), status: p.method === "cash" ? "cash" : "pending" }
    let message = p.method === "cash" ? `Cash ${formatPKR(p.amount)} recorded.` : "Payment saved. Ops will check it."
    if (p.method !== "cash") {
      record.screenshot = p.screenshot
      if (aiEnabled() && p.screenshot) {
        try {
          const r = await readReceipt(p.screenshot.split(",")[1] ?? p.screenshot, job.total)
          record = { ...record, status: r.status, ocr: r.ocr }
          message =
            r.status === "matched"
              ? `Payment checked: ${formatPKR(r.ocr.amount ?? p.amount)} matches.`
              : r.status === "mismatch"
                ? `The screenshot shows ${formatPKR(r.ocr.amount ?? 0)}, but the visit total is ${formatPKR(job.total)}. Ops will check.`
                : "We couldn't read the screenshot. Ops will check it."
        } catch (e) {
          console.error("[pro/job] receipt read failed", e)
        }
      }
    }
    if (p.amount !== job.total && record.status === "cash") message = `Cash ${formatPKR(p.amount)} recorded (total was ${formatPKR(job.total)}). Ops will check.`
    if (record.status === "cash" && p.amount !== job.total) record.status = "mismatch"
    await updateJob(b.jobId, (j) => {
      j.paymentRecord = record
      j.events.push({ type: "payment", at: nowIso(), by: "pro", note: `${p.method} ${p.amount} (${record.status})` })
    })
    return { job: await addJobEvent(b.jobId, "completed", "pro", {}, { proId }), message }
  })
}
