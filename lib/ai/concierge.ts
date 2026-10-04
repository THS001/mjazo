import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { formatPKR } from "@/lib/catalog"
import { getCatalog, getSettings } from "@/lib/cms/read"
import type { Settings } from "@/lib/site"
import { karachiNow, nextDays, WINDOW_LABELS } from "@/lib/time"
import { MODELS, ai } from "./anthropic"
import { TOOLS, catalogueBrief, runTool, type Channel, type UiAction } from "./tools"

// Mjazo Concierge: one agent for the website chat and WhatsApp. A manual tool loop so every
// step can emit UI actions (cards, cart additions, a created booking) and be capped.

const rules = (site: Settings["site"], MIN_ORDER: number) => `You are the Mjazo Concierge, the AI booking assistant for Mjazo, a home-services company in Karachi (${site.url}).
Mjazo sends verified pros to people's homes: salon, spa, makeup and mehndi (women-only beauty pros), cleaning, pest control, AC and appliances, repairs, health visits, care, moving and laundry.

How you talk
- Reply in the customer's language and script: English, Urdu script, or Roman Urdu, matching their last message. Mixing like Karachi people do is fine.
- Warm, brief, practical: WhatsApp-length replies (usually under 70 words), one question at a time. Use short lists for options.
- In your first reply of a conversation, say once that you are Mjazo's AI assistant and that a person is available any time.

Hard rules
- Prices, services, areas, time windows and policies come ONLY from your tools. Never guess a price or invent a service, discount, or availability.
- Any total or multi-unit price: call quote first and state only the total it returns. Never do the sum yourself, and never write a figure you then correct.
- Before recommending, call search_services or get_service. Use quote to show an exact total.
- Booking needs: services (with options), people, area + sub-area, house/street, date, arrival window, name, mobile number, payment method (pay after: cash, JazzCash, Easypaisa or Raast). Ask only for what's missing; reuse what you already know from the customer context.
- Before create_booking, show one clear summary (services, date and window, address, total, payment) and ask for a yes. Only call create_booking after an explicit yes. If it returns problems, fix them with the customer.
- Never ask for card numbers, CNIC, passwords or OTP codes. Payment is always after the service.
- Minimum order is ${formatPKR(MIN_ORDER)} per visit; suggest a sensible add-on or bundle if they're below it.
- No medical diagnosis or advice; for health visits, describe the service and suggest a doctor visit or 1122 in emergencies.
- Photos: describe what you see in plain words, then map it to services with search_services. For repairs, say the final price is confirmed before work starts.
- Use handoff_to_human for complaints, refunds, safety concerns, anything upsetting, or when asked for a person.
- Stay on Mjazo topics. Politely decline unrelated requests.`

export async function buildSystem(context: ConciergeContext) {
  const [cat, { site }] = await Promise.all([getCatalog(), getSettings()])
  const now = karachiNow()
  const days = nextDays(7).map((d) => `${d.iso} = ${d.label}`).join(", ")
  const known = [
    context.name && `name: ${context.name}`,
    context.phone && `mobile: ${context.phone}`,
    context.area && `area: ${context.area}${context.subArea ? `, ${context.subArea}` : ""}`,
    context.address && `address: ${context.address}`,
    context.cart?.length && `cart: ${context.cart.join("; ")}`,
  ].filter(Boolean)
  return [
    { type: "text" as const, text: `${rules(site, cat.MIN_ORDER)}\n\nCatalogue (category slugs in brackets)\n${catalogueBrief(cat)}\n\nAreas: ${cat.areas.map((a) => `${a.name} [${a.slug}]`).join(", ")}\nArrival windows: ${WINDOW_LABELS.join(", ")}`, cache_control: { type: "ephemeral" as const } },
    { type: "text" as const, text: `Now in Karachi: ${now.date}, ${Math.floor(now.hour)}:${String(Math.round((now.hour % 1) * 60)).padStart(2, "0")}. Bookable dates: ${days}.\nChannel: ${context.channel}.${known.length ? `\nWhat we know about this customer (confirm before using): ${known.join(" | ")}` : ""}` },
  ]
}

export type ConciergeContext = {
  channel: Channel
  name?: string
  phone?: string
  area?: string
  subArea?: string
  address?: string
  cart?: string[]
  attribution?: Record<string, unknown>
}

export type ConciergeResult = { reply: string; ui: UiAction[]; messages: Anthropic.MessageParam[] }

export async function runConcierge(history: Anthropic.MessageParam[], context: ConciergeContext): Promise<ConciergeResult> {
  const messages: Anthropic.MessageParam[] = [...history]
  const ui: UiAction[] = []
  const system = await buildSystem(context)

  for (let step = 0; step < 8; step++) {
    const response = await ai().messages.create({
      model: MODELS.concierge,
      max_tokens: 1024,
      system,
      tools: TOOLS,
      messages,
    })
    messages.push({ role: "assistant", content: response.content })

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    if (response.stop_reason !== "tool_use" || !toolUses.length) {
      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim()
      return { reply, ui, messages }
    }

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const t of toolUses) {
      const outcome = await runTool(t.name, (t.input ?? {}) as Record<string, unknown>, { channel: context.channel, attribution: context.attribution })
      if (outcome.ui) ui.push(...outcome.ui)
      results.push({ type: "tool_result", tool_use_id: t.id, content: JSON.stringify(outcome.result) })
    }
    messages.push({ role: "user", content: results })
  }
  return { reply: "Sorry, that took too many steps. Could you say it another way, or tap to chat with the team on WhatsApp?", ui, messages }
}

/** Keep only plain user/assistant text (and user images) from a browser-supplied history. */
export function sanitizeHistory(raw: unknown): Anthropic.MessageParam[] {
  if (!Array.isArray(raw)) return []
  const out: Anthropic.MessageParam[] = []
  for (const m of raw.slice(-20)) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue
    if (typeof m.content === "string") {
      if (m.content.trim()) out.push({ role: m.role, content: m.content.slice(0, 4000) })
      continue
    }
    if (!Array.isArray(m.content)) continue
    const blocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
    for (const b of m.content) {
      if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) blocks.push({ type: "text", text: b.text.slice(0, 4000) })
      if (m.role === "user" && b?.type === "image" && b.source?.type === "base64" && /^image\/(jpeg|png|webp)$/.test(b.source.media_type) && typeof b.source.data === "string" && b.source.data.length < 2_800_000)
        blocks.push({ type: "image", source: { type: "base64", media_type: b.source.media_type, data: b.source.data } })
    }
    if (blocks.length) out.push({ role: m.role, content: blocks })
  }
  // The API needs the conversation to start with a user turn and alternate.
  while (out.length && out[0].role !== "user") out.shift()
  const merged: Anthropic.MessageParam[] = []
  for (const m of out) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) {
      const toBlocks = (c: Anthropic.MessageParam["content"]) => (typeof c === "string" ? [{ type: "text" as const, text: c }] : c)
      last.content = [...toBlocks(last.content), ...toBlocks(m.content)] as Anthropic.MessageParam["content"]
    } else merged.push({ ...m })
  }
  // Only the last 3 images are kept (cost + payload size).
  let images = 0
  for (let i = merged.length - 1; i >= 0; i--) {
    const c = merged[i].content
    if (typeof c === "string") continue
    merged[i].content = c.filter((b) => b.type !== "image" || ++images <= 3) as Anthropic.MessageParam["content"]
  }
  return merged
}
