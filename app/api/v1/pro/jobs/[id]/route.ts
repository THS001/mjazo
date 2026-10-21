import { z } from "zod"
import { readJson } from "@/lib/server/api"
import { proVisitAction } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

export const maxDuration = 60

// What she does on one of her visits, with her location where it matters: on my way, check in,
// I'm safe, check out, a note for next time, or finish with the payment (cash, or a digital
// payment with its screenshot, which AI reads and checks).

const geo = { lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }
const body = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["en_route", "check_in", "safe", "check_out"]), ...geo }),
  z.object({ action: z.literal("note"), note: z.string().trim().min(2).max(500) }),
  z.object({
    action: z.literal("complete"),
    ...geo,
    payment: z.object({ method: z.enum(["cash", "jazzcash", "easypaisa", "raast"]), amount: z.number().int().min(0).max(1_000_000), screenshot: z.string().max(1_500_000).optional() }),
  }),
])

export const POST = asPro<{ params: Promise<{ id: string }> }>(async (pro, req, { params }) => {
  const r = await proVisitAction(pro, (await params).id, body.parse(await readJson(req)))
  return { status: r.job.status, message: r.message ?? null }
})
