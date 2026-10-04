import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { MODELS, aiEnabled, clientIp, rateLimited } from "@/lib/ai/anthropic"
import { structured } from "@/lib/ai/structured"
import { lookBrief, lookServices, type GlamSelection } from "@/lib/glam/look"
import { getCatalog } from "@/lib/cms/read"

// Glam Mirror Look Card: the AI writes the brief for the pro from what the customer tried on.
// Only the selections are sent: no selfies or hand photos ever reach the server for this.
// Services and prices are mapped by code from the catalogue, never by the model.

const body = z.object({
  mehndi: z.object({ design: z.enum(["arabic-trail", "arabic-bloom", "pak-jaal", "pak-mandala", "minimal-tips", "minimal-vine", "bridal-full"]), coverage: z.enum(["front", "front-back"]), stain: z.enum(["fresh", "dark"]) }).optional(),
  makeup: z.object({ lips: z.string().max(20), blush: z.string().max(20), kajal: z.string().max(20), hair: z.string().max(20), hairLength: z.enum(["Short", "Medium", "Long"]).optional() }).optional(),
  occasion: z.string().max(120).optional(),
  lang: z.enum(["en", "ur", "ro"]).optional(),
})

const WRITE: Anthropic.Tool = {
  name: "look_card",
  description: "The Look Card for the pro.",
  input_schema: { type: "object", properties: { title: { type: "string", description: "2-5 words" }, brief: { type: "string", description: "3-5 sentences for the pro: style, placement, shades, technique notes, prep the customer should do." } }, required: ["title", "brief"] },
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid look" }, { status: 400 })
  const sel = parsed.data as GlamSelection & { occasion?: string; lang?: "en" | "ur" | "ro" }
  const services = lookServices(sel, await getCatalog())
  const fallback = lookBrief(sel)
  if (!aiEnabled() || rateLimited(`look:${clientIp(req)}`, 10)) return NextResponse.json({ ...fallback, services, ai: false })
  try {
    const LANG = { en: "English", ur: "Urdu script", ro: "Roman Urdu" }
    const r = ((await structured<{ title?: string; brief?: string }>({
      model: MODELS.fast,
      maxTokens: 500,
      system: `You write Look Cards for Mjazo, an at-home beauty service in Karachi with women-only pros. Turn the customer's try-on choices into a clear brief for the pro in ${LANG[sel.lang ?? "en"]}. Describe the look, never the person. Natural henna only (never "black henna"). Never mention skin lightening or fairness. Don't mention prices.`,
      tool: WRITE,
      messages: [{ role: "user", content: JSON.stringify({ choices: fallback.brief, occasion: sel.occasion ?? "" }) }],
    })) ?? {})
    return NextResponse.json({ title: r.title?.slice(0, 80) || fallback.title, brief: r.brief?.slice(0, 1200) || fallback.brief, services, ai: true })
  } catch (e) {
    console.error("[look-card] failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    return NextResponse.json({ ...fallback, services, ai: false })
  }
}
