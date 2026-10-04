import { audit } from "@/lib/server/audit"
import { z } from "zod"
import { handle, readJson } from "@/lib/server/api"
import { requireOps } from "@/lib/server/session"
import { addJobEvent, assignJob, nowIso, type SosDoc } from "@/lib/server/ops"
import { get, put } from "@/lib/server/docs"

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), jobId: z.string(), proId: z.string().nullable() }),
  z.object({ action: z.literal("event"), jobId: z.string(), type: z.enum(["en_route", "checked_in", "checked_out", "completed", "cancelled", "safe", "note"]), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("resolve_sos"), id: z.string() }),
])

export async function POST(req: Request) {
  return handle(async () => {
    await requireOps()
    const b = body.parse(await readJson(req))
    if (b.action === "assign") {
      const job = await assignJob(b.jobId, b.proId)
      await audit("ops", b.proId ? "assigned job" : "unassigned job", b.jobId, b.proId ?? "")
      return { job }
    }
    if (b.action === "event") {
      const job = await addJobEvent(b.jobId, b.type, "ops", b.note ? { note: b.note } : {})
      await audit("ops", "job " + b.type.replace("_", " "), b.jobId, b.note)
      return { job }
    }
    const s = await get<SosDoc>("sos", b.id)
    if (s) await put("sos", { ...s, resolved: true, resolvedAt: nowIso() })
    await audit("ops", "SOS resolved", b.id)
    return { ok: true }
  })
}
