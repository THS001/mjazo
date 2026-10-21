import { z } from "zod"
import { audit } from "@/lib/server/audit"
import { handle, readJson } from "@/lib/server/api"
import { requireStaff } from "@/lib/server/staff"
import { addBookingNote, addJobEvent, bookingDetail, decideMoney, getPros, publicPro, requestMoney, rescheduleJob } from "@/lib/server/ops"

// The booking page: timeline, items, payments and ledger entries, notes, reschedule and cancel,
// and refunds and credits (asked for here, approved by a second person with the money permission).

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("note"), id: z.string(), note: z.string().min(2).max(500) }),
  z.object({ action: z.literal("reschedule"), id: z.string(), date: z.string(), window: z.string(), reason: z.string().max(200).optional(), force: z.boolean().optional() }),
  z.object({ action: z.literal("cancel"), id: z.string(), reason: z.string().min(2, "Say why").max(300) }),
  z.object({ action: z.literal("request"), id: z.string(), kind: z.enum(["refund", "credit"]), amount: z.number().int().positive(), reason: z.string().min(3).max(500) }),
  z.object({ action: z.literal("decide"), id: z.string(), requestId: z.string(), approve: z.boolean(), note: z.string().max(500).optional(), reference: z.string().max(120).optional() }),
])

export async function GET(req: Request) {
  return handle(async () => {
    await requireStaff("ops.view")
    const id = new URL(req.url).searchParams.get("id") ?? ""
    const [detail, pros] = await Promise.all([bookingDetail(id), getPros()])
    const job = detail.job.paymentRecord?.screenshot ? { ...detail.job, paymentRecord: { ...detail.job.paymentRecord, screenshot: "1" } } : detail.job
    return { ...detail, job, pros: pros.map(publicPro) }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = body.parse(await readJson(req))
    if (b.action === "note") {
      const me = await requireStaff("ops.bookings", "ops.dispatch")
      await addBookingNote(b.id, b.note, me.email)
      await audit(me.email, "added a booking note", b.id, b.note)
    } else if (b.action === "reschedule") {
      const me = await requireStaff("ops.bookings")
      const r = await rescheduleJob(b.id, { date: b.date, window: b.window }, me.email, { reason: b.reason, force: b.force })
      if (r.full) return { full: true }
      await audit(me.email, b.force ? "rescheduled a booking over capacity" : "rescheduled a booking", b.id, `${b.date}, ${b.window}${b.reason ? `: ${b.reason}` : ""}`)
    } else if (b.action === "cancel") {
      const me = await requireStaff("ops.bookings")
      await addJobEvent(b.id, "cancelled", "ops", { actor: me.email, note: b.reason })
      await audit(me.email, "cancelled a booking", b.id, b.reason)
    } else if (b.action === "request") {
      const me = await requireStaff("ops.money.request")
      await requestMoney({ kind: b.kind, bookingId: b.id, amount: b.amount, reason: b.reason, by: me.email })
    } else {
      const me = await requireStaff("ops.money")
      await decideMoney(b.requestId, { approve: b.approve, by: { email: me.email, role: me.role }, note: b.note, reference: b.reference })
    }
    return bookingDetail(b.id)
  })
}
