import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { CodeError } from "@/lib/core/phone-sign-in"
import { handle, readJson } from "@/lib/server/api"
import { codeErrorResponse, signInWithPhone } from "@/lib/server/phone-sign-in"

// Signs in with the number and the code sent to it: the token (send it as "Authorization: Bearer")
// and the customer that number belongs to, with every booking made with it. `isNew`: we hadn't
// seen the number, so the screens ask for their name.

const body = z.object({ phone: z.string().max(20), code: z.string().max(12) })

export async function POST(req: Request) {
  if (rateLimited(`phone-session:${clientIp(req)}`, 30, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait a few minutes.", code: "limit" }, { status: 429 })
  return handle(async () => {
    try {
      return await signInWithPhone(body.parse(await readJson(req)))
    } catch (e) {
      if (e instanceof CodeError) return codeErrorResponse(e)
      throw e
    }
  })
}
