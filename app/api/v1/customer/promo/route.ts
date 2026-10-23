import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { core } from "@/lib/core/db"
import { handle, readJson } from "@/lib/server/api"
import { checkCustomerPromo } from "@/lib/server/customer-api"
import { customerOf } from "@/lib/server/customer-auth"

// Checks a promo code against the cart before booking (anyone can; a signed-in customer's own
// uses count against the per-customer limit). Answers what it takes off, or why it can't be used.

const body = z.object({
  code: z.string().trim().min(1).max(20),
  items: z.array(z.object({ name: z.string().max(120), category: z.string().max(80), service: z.string().max(120), options: z.array(z.string()).default([]), addOns: z.array(z.string()).default([]), qty: z.number().int().min(1).max(10) })).min(1).max(20),
})

export async function POST(req: Request) {
  if (rateLimited(`promo:${clientIp(req)}`, 20, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 })
  return handle(async () => {
    const db = await core()
    if (!db) return { ok: false, problem: "invalid" }
    const b = body.parse(await readJson(req))
    return checkCustomerPromo(b.code, b.items, (await customerOf(req))?.id)
  })
}
