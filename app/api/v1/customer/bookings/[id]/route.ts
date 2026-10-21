import { NextResponse } from "next/server"
import { z } from "zod"
import { readJson } from "@/lib/server/api"
import { changeBooking, customerBooking } from "@/lib/server/customer-api"
import { asCustomer } from "@/lib/server/customer-auth"

// One of their bookings, and changing it: cancel, or move it to another day or window (online
// only until the policy's free-change time before the visit; the window must have room).

type Ctx = { params: Promise<{ id: string }> }
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), reason: z.string().max(200).optional() }),
  z.object({ action: z.literal("reschedule"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), window: z.string().max(40) }),
])

export const GET = asCustomer<Ctx>(async ({ customer }, _req, { params }) => customerBooking(customer, (await params).id))

export const POST = asCustomer<Ctx>(async ({ customer }, req, { params }) => {
  const r = await changeBooking(customer, (await params).id, body.parse(await readJson(req)))
  return "full" in r ? NextResponse.json({ error: "That window just filled up. Pick another one.", code: "slotFull" }, { status: 409 }) : r
})
