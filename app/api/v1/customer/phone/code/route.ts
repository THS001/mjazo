import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { CodeError } from "@/lib/core/phone-sign-in"
import { handle, readJson } from "@/lib/server/api"
import { codeErrorResponse, sendPhoneCode } from "@/lib/server/phone-sign-in"

// Sends a 6-digit sign-in code to a Pakistani mobile number: on WhatsApp, or by SMS when asked (or
// when only SMS is set up). The same code also proves a number when an emailed sign-in adds it
// (POST me/link with `code`). Limits: lib/core/phone-sign-in.ts.

const body = z.object({ phone: z.string().max(20), via: z.enum(["whatsapp", "sms"]).optional(), lang: z.enum(["en", "ur"]).optional() })

export async function POST(req: Request) {
  const ip = clientIp(req)
  if (rateLimited(`phone-code:${ip}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait a few minutes.", code: "limit" }, { status: 429 })
  return handle(async () => {
    try {
      return await sendPhoneCode({ ...body.parse(await readJson(req)), ip })
    } catch (e) {
      if (e instanceof CodeError) return codeErrorResponse(e)
      throw e
    }
  })
}
