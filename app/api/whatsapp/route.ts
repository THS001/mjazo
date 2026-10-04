import { NextResponse, after } from "next/server"
import crypto from "crypto"
import type Anthropic from "@anthropic-ai/sdk"
import { aiEnabled } from "@/lib/ai/anthropic"
import { runConcierge } from "@/lib/ai/concierge"
import { transcribe } from "@/lib/ai/stt"
import { firstTime, loadConversation, saveConversation } from "@/lib/server/conversations"
import { notifyOps, saveSubmission } from "@/lib/server/store"

// WhatsApp Cloud API webhook for the Mjazo Concierge.
// Env: WHATSAPP_VERIFY_TOKEN, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET
// (signature check), optional WHATSAPP_GRAPH_VERSION. Voice notes need STT_API_KEY.

export const maxDuration = 60
const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0"}`
const enabled = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)

// Meta's one-time webhook verification.
export async function GET(req: Request) {
  const u = new URL(req.url)
  if (u.searchParams.get("hub.mode") === "subscribe" && process.env.WHATSAPP_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN)
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 })
  return new Response("Forbidden", { status: 403 })
}

type WaMessage = {
  id: string
  from: string
  type: "text" | "image" | "audio" | "interactive" | "button" | string
  text?: { body: string }
  image?: { id: string; mime_type: string; caption?: string }
  audio?: { id: string; mime_type: string }
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }
  button?: { text: string }
}

function validSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return true // not configured: accept (set it in production)
  if (!header?.startsWith("sha256=")) return false
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex")
  const got = header.slice(7)
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))
}

async function media(id: string) {
  const auth = { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
  const meta = (await (await fetch(`${GRAPH}/${id}`, { headers: auth })).json()) as { url?: string; mime_type?: string }
  if (!meta.url) return null
  const res = await fetch(meta.url, { headers: auth })
  return res.ok ? { data: await res.arrayBuffer(), mime: meta.mime_type ?? res.headers.get("content-type") ?? "" } : null
}

async function send(to: string, body: string) {
  await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000), preview_url: true } }),
  }).catch((e) => console.error("[whatsapp] send failed", e))
}

const localNumber = (from: string) => (from.startsWith("92") ? `0${from.slice(2)}` : from)

async function handle(m: WaMessage) {
  const phone = localNumber(m.from)
  const content: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []

  if (m.type === "text" && m.text?.body) content.push({ type: "text", text: m.text.body })
  else if (m.type === "interactive" || m.type === "button") content.push({ type: "text", text: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? m.button?.text ?? "" })
  else if (m.type === "image" && m.image) {
    const file = await media(m.image.id)
    if (file && /image\/(jpeg|png|webp)/.test(file.mime) && file.data.byteLength < 4_500_000)
      content.push({ type: "image", source: { type: "base64", media_type: file.mime.split(";")[0] as "image/jpeg", data: Buffer.from(file.data).toString("base64") } })
    content.push({ type: "text", text: m.image.caption || "Here's a photo." })
  } else if (m.type === "audio" && m.audio) {
    const file = await media(m.audio.id)
    const text = file ? await transcribe(file.data, file.mime) : null
    if (!text) {
      await send(m.from, "Shukriya! I can't listen to voice notes just yet. Please type your message, or tap to talk to our team. Mujhe likh kar bata dein.")
      return
    }
    content.push({ type: "text", text: `(voice note) ${text}` })
  } else {
    await send(m.from, "Please send text, a photo or a voice note and I'll help you book.")
    return
  }

  const history = await loadConversation(phone)
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content }]
  const { reply, ui } = await runConcierge(messages, { channel: "whatsapp", phone })
  const handoff = ui.find((a) => a.type === "handoff")
  const stored: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: content.map((b) => (b.type === "image" ? { type: "text" as const, text: "[photo]" } : b)) },
    { role: "assistant", content: reply || "…" },
  ]
  await saveConversation(phone, stored, Boolean(handoff))
  if (reply) await send(m.from, reply)
  if (handoff && handoff.type === "handoff") {
    await saveSubmission("enquiry", { kind: "handoff", name: "WhatsApp customer", phone, message: handoff.reason, details: { channel: "whatsapp" } }).catch(() => {})
    await notifyOps(`[Mjazo] WhatsApp handoff ${phone}`, `${handoff.reason}\n\nLast message: ${content.map((c) => (c.type === "text" ? c.text : "[photo]")).join(" ")}`)
  }
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Bad signature", { status: 401 })
  if (!enabled() || !aiEnabled()) return NextResponse.json({ ok: true, skipped: "not configured" })

  let payload: { entry?: { changes?: { value?: { messages?: WaMessage[] } }[] }[] }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response("Bad JSON", { status: 400 })
  }
  const messages = (payload.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? [])).filter((m) => firstTime(m.id))

  // Acknowledge immediately (Meta retries slow webhooks); do the work after responding.
  after(async () => {
    for (const m of messages) {
      try {
        await handle(m)
      } catch (e) {
        console.error("[whatsapp] handle failed", e)
        await send(m.from, "Sorry, something went wrong on our side. A person from our team will reply shortly.")
      }
    }
  })
  return NextResponse.json({ ok: true })
}
