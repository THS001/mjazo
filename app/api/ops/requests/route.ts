import { z } from "zod"
import { audit } from "@/lib/server/audit"
import { handle, readJson } from "@/lib/server/api"
import { requireStaff } from "@/lib/server/staff"
import { requestsInbox, setRequestStatus } from "@/lib/server/ops"

// The requests inbox: Plus, gift card, referral and Home Pulse enquiries (and the website's other
// enquiries and WhatsApp requests), with how far the team has got with each.

const body = z.object({ id: z.string().max(60), status: z.enum(["new", "contacted", "done", "declined"]), note: z.string().max(500).optional() })

export async function GET() {
  return handle(async () => {
    await requireStaff("ops.requests")
    return { items: await requestsInbox() }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireStaff("ops.requests")
    const b = body.parse(await readJson(req))
    await setRequestStatus(b.id, b.status, b.note, me.email)
    await audit(me.email, `marked a request ${b.status}`, b.id, b.note)
    return { items: await requestsInbox() }
  })
}
