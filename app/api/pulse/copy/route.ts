import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { MODELS, aiEnabled, clientIp, rateLimited } from "@/lib/ai/anthropic"
import { structured } from "@/lib/ai/structured"

// Home Pulse copy: Claude Haiku rewrites the rule-based plan as warm, short reminders in the
// customer's language. Dates and services are fixed by the rules; only the wording changes.

const body = z.object({
  lang: z.enum(["en", "ur", "ro"]),
  name: z.string().max(60).optional(),
  items: z.array(z.object({ id: z.string().max(120), date: z.string().max(10), title: z.string().max(120), why: z.string().max(300) })).min(1).max(18),
})

const TOOL: Anthropic.Tool = {
  name: "write_plan",
  description: "Return the personalised intro and one reminder line per plan item.",
  input_schema: {
    type: "object",
    properties: {
      intro: { type: "string", description: "One or two warm sentences summarising the next weeks." },
      items: { type: "array", items: { type: "object", properties: { id: { type: "string" }, line: { type: "string", description: "Under 22 words." } }, required: ["id", "line"] } },
    },
    required: ["intro", "items"],
  },
}

const LANG = { en: "English", ur: "Urdu in Urdu script", ro: "Roman Urdu (Urdu written in English letters, the way Karachi texts)" }

export async function POST(req: Request) {
  if (!aiEnabled()) return NextResponse.json({ error: "ai_unavailable" }, { status: 503 })
  if (rateLimited(`pulse:${clientIp(req)}`, 10)) return NextResponse.json({ error: "Please wait a minute." }, { status: 429 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const { lang, name, items } = parsed.data
  try {
    const out = ((await structured<{ intro?: string; items?: { id: string; line: string }[] }>({
      model: MODELS.fast,
      maxTokens: 1500,
      system: `You write reminders for Mjazo's Home Pulse, a care calendar for Karachi homes. Write in ${LANG[lang]}. Warm, practical, never pushy, no emojis. Keep each item's meaning and date exactly; do not add prices, discounts or promises.`,
      tool: TOOL,
      messages: [{ role: "user", content: `Customer: ${name || "a Mjazo customer"}\nPlan:\n${items.map((i) => `${i.id} | ${i.date} | ${i.title} | ${i.why}`).join("\n")}` }],
    })) ?? {})
    const ids = new Set(items.map((i) => i.id))
    return NextResponse.json({ intro: out.intro ?? "", lines: Object.fromEntries((out.items ?? []).filter((x) => ids.has(x.id)).map((x) => [x.id, x.line])) })
  } catch (e) {
    console.error("[pulse/copy]", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    return NextResponse.json({ error: "Couldn't personalise right now." }, { status: 502 })
  }
}
