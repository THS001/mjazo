import { NextResponse } from "next/server"
import { readJson } from "@/lib/server/api"
import { placeBooking } from "@/lib/server/bookings-core"
import { customerBookings } from "@/lib/server/customer-api"
import { asCustomer } from "@/lib/server/customer-auth"
import { ValidationError } from "@/lib/server/store"

// Their bookings (upcoming and past, with each one's status and steps), and placing a new one
// from the phone app (the same as the website's checkout, with their credit and saved addresses).

export const GET = asCustomer(async ({ customer }) => customerBookings(customer))

export const POST = asCustomer(async ({ customer }, req) => {
  try {
    return await placeBooking(await readJson(req), {}, "app", customer.id)
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message, code: e.code }, { status: 422 })
    throw e
  }
})
