import { NextResponse } from "next/server"
import { core } from "@/lib/core/db"
import { customerForAccount } from "@/lib/core/customers"
import { placeBooking } from "@/lib/server/bookings-core"
import { accountOf } from "@/lib/server/customer-auth"
import { ValidationError } from "@/lib/server/store"

// A booking from the phone app: the same checks and prices as the website's checkout, marked as
// an app booking. Signed in (a customer's bearer token), their credit and saved addresses can be used.

export async function POST(req: Request) {
  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  try {
    const account = await accountOf(req)
    const db = account ? await core() : null
    const customerId = db && account ? (await customerForAccount(db, account.userId))?.id : undefined
    return NextResponse.json(await placeBooking({ ...(data as Record<string, unknown>), channel: "app" }, { source: "app" }, "app", customerId))
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message, code: e.code }, { status: 422 })
    console.error("[app booking] failed", e)
    return NextResponse.json({ error: "Could not save. Please try WhatsApp instead." }, { status: 500 })
  }
}
