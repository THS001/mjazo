import "server-only"
import type Anthropic from "@anthropic-ai/sdk"
import { db } from "./store"

// WhatsApp conversation memory: last 20 text turns per phone number. Supabase table
// `conversations` when configured (see supabase/migrations/0002_ai.sql); otherwise in-memory
// (fine for local testing, lost between serverless instances).

const memory = new Map<string, { messages: Anthropic.MessageParam[]; at: number }>()
const TTL = 1000 * 60 * 60 * 24 * 3

export async function loadConversation(phone: string): Promise<Anthropic.MessageParam[]> {
  if (db) {
    const { data } = await db.from("conversations").select("messages, updated_at").eq("phone", phone).maybeSingle()
    if (data && Date.now() - new Date(data.updated_at).getTime() < TTL) return (data.messages as Anthropic.MessageParam[]) ?? []
    return []
  }
  const m = memory.get(phone)
  return m && Date.now() - m.at < TTL ? m.messages : []
}

export async function saveConversation(phone: string, messages: Anthropic.MessageParam[], needsHuman = false) {
  const trimmed = messages.slice(-20)
  if (db) {
    await db.from("conversations").upsert({ phone, messages: trimmed, needs_human: needsHuman, updated_at: new Date().toISOString() })
    return
  }
  memory.set(phone, { messages: trimmed, at: Date.now() })
}

const seen = new Set<string>()
/** WhatsApp retries webhooks; process each message id once per instance. */
export function firstTime(id: string) {
  if (seen.has(id)) return false
  seen.add(id)
  if (seen.size > 2000) seen.clear()
  return true
}
