import { audit } from "@/lib/server/audit"
import { z } from "zod"
import { handle, readJson } from "@/lib/server/api"
import { requireStaff } from "@/lib/server/staff"
import { addJobEvent, assignJob, nowIso, offerJob, withdrawOffers, type SosDoc } from "@/lib/server/ops"
import { get, put } from "@/lib/server/docs"

// The board's actions: assign, offer to a pro (she accepts or declines in the pro app), status
// changes and SOS. Each is recorded with the person's email.

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), jobId: z.string(), proId: z.string().nullable() }),
  z.object({ action: z.literal("offer"), jobId: z.string(), proId: z.string() }),
  z.object({ action: z.literal("withdraw_offer"), jobId: z.string() }),
  z.object({ action: z.literal("event"), jobId: z.string(), type: z.enum(["en_route", "checked_in", "checked_out", "completed", "cancelled", "no_show", "safe", "note"]), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("resolve_sos"), id: z.string() }),
])

export async function POST(req: Request) {
  return handle(async () => {
    await requireStaff("ops.view")
    const b = body.parse(await readJson(req))
    if (b.action === "assign") {
      const me = await requireStaff("ops.dispatch")
      const job = await assignJob(b.jobId, b.proId, {}, me.email)
      await audit(me.email, b.proId ? "assigned job" : "unassigned job", b.jobId, b.proId ?? "")
      return { job }
    }
    if (b.action === "offer") {
      const me = await requireStaff("ops.dispatch")
      return { offer: await offerJob({ bookingId: b.jobId, proId: b.proId, by: me.email }) }
    }
    if (b.action === "withdraw_offer") {
      const me = await requireStaff("ops.dispatch")
      return { withdrawn: await withdrawOffers(b.jobId, me.email) }
    }
    if (b.action === "event") {
      // Notes and cancelling are booking work (Support too); moving a visit along is dispatching.
      const me = await requireStaff(...(b.type === "note" || b.type === "cancelled" ? (["ops.dispatch", "ops.bookings"] as const) : (["ops.dispatch"] as const)))
      const job = await addJobEvent(b.jobId, b.type, "ops", { actor: me.email, ...(b.note ? { note: b.note } : {}) })
      await audit(me.email, "job " + b.type.replace("_", " "), b.jobId, b.note)
      return { job }
    }
    const me = await requireStaff("ops.dispatch")
    const s = await get<SosDoc>("sos", b.id)
    if (s) await put("sos", { ...s, resolved: true, resolvedAt: nowIso() })
    await audit(me.email, "SOS resolved", b.id)
    return { ok: true }
  })
}
