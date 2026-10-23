import { NextResponse } from "next/server"
import { z } from "zod"
import { rateLimited } from "@/lib/ai/anthropic"
import { LinkError } from "@/lib/core/customers"
import { CodeError } from "@/lib/core/phone-sign-in"
import { readJson } from "@/lib/server/api"
import { linkCustomer } from "@/lib/server/customer-api"
import { asAccount } from "@/lib/server/customer-auth"
import { codeErrorResponse } from "@/lib/server/phone-sign-in"

// Adds the signed-in account's phone number, which joins it to the bookings made with that number.
// A number that already has bookings needs proof: the code sent to it (POST phone/code), or booking
// numbers from it (the ones saved on this device are sent automatically; a customer can also type
// one from a confirmation).

const body = z.object({ name: z.string().trim().min(2, "Enter your name").max(80), phone: z.string().max(20), proof: z.array(z.string().max(40)).max(50).optional(), code: z.string().max(12).optional() })

export const POST = asAccount(async (account, req) => {
  if (rateLimited(`link:${account.by === "email" ? account.userId : account.customer.id}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait 10 minutes and try again.", code: "slow" }, { status: 429 })
  try {
    return { customer: await linkCustomer(account, body.parse(await readJson(req))) }
  } catch (e) {
    if (e instanceof LinkError) return NextResponse.json({ error: e.message, code: e.code }, { status: 400 })
    if (e instanceof CodeError) return codeErrorResponse(e)
    throw e
  }
})
