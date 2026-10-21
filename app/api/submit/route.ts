import { NextResponse } from "next/server"
import { z } from "zod"
import { saveSubmission, ValidationError } from "@/lib/server/store"
import { placeBooking } from "@/lib/server/bookings-core"
import { accountOf } from "@/lib/server/customer-auth"
import { core } from "@/lib/core/db"
import { customerForAccount } from "@/lib/core/customers"
import { createApplication } from "@/lib/server/ops"
import { aiEnabled } from "@/lib/ai/anthropic"

// One endpoint for every website form: bookings, WhatsApp requests, waitlist, pro applications
// and enquiries. Validation and storage live in lib/server/store.ts (shared with the AI agents).

const body = z.object({
  type: z.enum(["booking", "request", "waitlist", "apply", "enquiry"]),
  data: z.record(z.string(), z.unknown()),
  attribution: z.record(z.string(), z.unknown()).optional(),
  page: z.string().optional(),
})

/** The signed-in customer placing a booking, if any (their credit and saved addresses can be used). */
async function signedInCustomerId(req: Request) {
  const account = await accountOf(req)
  const db = account ? await core() : null
  return db && account ? (await customerForAccount(db, account.userId))?.id : undefined
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const { type, data, attribution, page } = parsed.data
  try {
    if (type === "booking") return NextResponse.json(await placeBooking(data, attribution ?? {}, page, await signedInCustomerId(req)))
    const { id } = await saveSubmission(type, data, attribution ?? {}, page)
    if (type === "apply") {
      // Recruiter Agent: hand the applicant their interview link straight away.
      const app = await createApplication(id, data).catch((e) => console.error("[submit] application failed", e))
      if (app && aiEnabled()) return NextResponse.json({ id, interview: `/partner/interview/${app.token}` })
    }
    return NextResponse.json({ id })
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message, code: e.code }, { status: 422 })
    console.error("[submit] store failed", e)
    return NextResponse.json({ error: "Could not save. Please try WhatsApp instead." }, { status: 500 })
  }
}
