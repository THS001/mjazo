import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { readJson } from "@/lib/server/api"
import { addGiftCard } from "@/lib/server/customer-api"
import { asCustomer } from "@/lib/server/customer-auth"

// A gift card turned into their Mjazo credit (once). Tries are limited, so codes can't be guessed.

const body = z.object({ code: z.string().trim().min(4).max(30) })

export const POST = asCustomer(async ({ customer }, req) => {
  if (rateLimited(`gift:${customer.id}`, 8, 10 * 60_000) || rateLimited(`gift-ip:${clientIp(req)}`, 20, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait a few minutes.", code: "tooMany" }, { status: 429 })
  return addGiftCard(customer, body.parse(await readJson(req)).code)
})
