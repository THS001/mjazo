import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { aiEnabled, clientIp, rateLimited } from "@/lib/ai/anthropic"
import { runConcierge, sanitizeHistory } from "@/lib/ai/concierge"
import { whatsappLink } from "@/lib/cms/read"

export const maxDuration = 60

const body = z.object({
  messages: z.array(z.unknown()).min(1).max(40),
  // The Mjazo app says so: its bookings are marked "concierge-app".
  channel: z.enum(["web", "app"]).optional(),
  context: z
    .object({
      name: z.string().max(80).optional(),
      phone: z.string().max(20).optional(),
      area: z.string().max(40).optional(),
      subArea: z.string().max(40).optional(),
      address: z.string().max(200).optional(),
      cart: z.array(z.string().max(200)).max(20).optional(),
      attribution: z.record(z.string(), z.unknown()).optional(),
      locale: z.enum(["en", "ur"]).optional(),
    })
    .optional(),
})

export async function POST(req: Request) {
  // `code` picks the customer's message on the site (Buttons & labels → AI chat); `error` is for other callers.
  if (!aiEnabled()) return NextResponse.json({ code: "offline", error: "ai_unavailable", whatsapp: await whatsappLink("Hi Mjazo! I'd like some help booking.") }, { status: 503 })
  if (rateLimited(`concierge:${clientIp(req)}`, 20)) return NextResponse.json({ code: "tooMany", error: "Too many messages. Please wait a minute." }, { status: 429 })

  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const history = sanitizeHistory(parsed.data.messages)
  if (!history.length || history[history.length - 1].role !== "user") return NextResponse.json({ error: "Send a message first." }, { status: 400 })

  try {
    const { reply, ui } = await runConcierge(history, { channel: parsed.data.channel ?? "web", ...parsed.data.context })
    return NextResponse.json({ reply, ui })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ code: "busy", error: "The assistant is busy. Try again in a moment." }, { status: 429 })
    if (e instanceof Anthropic.APIError) console.error("[concierge] API error", e.status, e.message)
    else console.error("[concierge] failed", e)
    return NextResponse.json({ code: "failed", error: "The assistant couldn't answer just now.", whatsapp: await whatsappLink("Hi Mjazo! I'd like some help booking.") }, { status: 502 })
  }
}
