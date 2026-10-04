import "server-only"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { promises as fs } from "fs"
import path from "path"

// Every submission (website forms, the Concierge on web or WhatsApp) is validated and stored
// here. Supabase when configured; otherwise /tmp on Vercel (plus a log line) or .data/ locally.
// Ops are emailed through Resend when configured.

export const PK_PHONE = /^(\+92|0092|0)?3\d{9}$/
const phone = z.string().regex(PK_PHONE, "Invalid Pakistani mobile number")

export const bookingItem = z.object({
  name: z.string(),
  category: z.string(),
  service: z.string(),
  options: z.array(z.string()),
  addOns: z.array(z.string()),
  qty: z.number().int().min(1).max(10),
  unitPrice: z.number().min(0),
})

export const schemas = {
  booking: z.object({
    name: z.string().min(2),
    phone,
    area: z.string(),
    subArea: z.string().optional(),
    address: z.string().min(5),
    landmark: z.string().optional(),
    date: z.string(),
    window: z.string(),
    payment: z.enum(["cash", "jazzcash", "easypaisa", "raast", "online"]),
    notes: z.string().optional(),
    items: z.array(bookingItem).min(1),
    total: z.number(),
    channel: z.enum(["web", "concierge-web", "concierge-whatsapp"]).optional(),
    // Ghar Scan diagnosis or Glam Mirror Look Card for the pro (photos travel separately, see /api/booking/attach)
    brief: z
      .object({
        kind: z.enum(["scan", "look"]),
        title: z.string().max(160),
        text: z.string().max(1500),
        causes: z.array(z.string().max(200)).max(4).optional(),
        parts: z.array(z.string().max(120)).max(6).optional(),
        pins: z.array(z.object({ photo: z.number().int().min(0).max(2), x: z.number().min(0).max(1), y: z.number().min(0).max(1), label: z.string().max(80) })).max(6).optional(),
        hasPhotos: z.boolean().optional(),
      })
      .optional(),
  }),
  request: z.object({ name: z.string().min(2), phone, area: z.string(), services: z.string(), when: z.string().optional() }),
  waitlist: z.object({ phone, name: z.string().optional(), area: z.string(), category: z.string(), source: z.string() }),
  apply: z.object({
    name: z.string().min(2),
    phone,
    area: z.string(),
    skills: z.array(z.string()).min(1),
    experience: z.string(),
    availability: z.array(z.string()),
    transport: z.string(),
    portfolio: z.string().optional(),
    lang: z.string(),
  }),
  enquiry: z.object({
    kind: z.enum(["wedding", "business", "contact", "gift", "plus", "pulse", "handoff"]),
    name: z.string().min(2),
    phone,
    email: z.string().email().optional().or(z.literal("")),
    message: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
} as const

export type SubmissionType = keyof typeof schemas

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null

export const db = supabase

export function newId() {
  return `MJ-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

export async function notifyOps(subject: string, text: string) {
  if (!process.env.RESEND_API_KEY || !process.env.OPS_EMAIL) return
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.OPS_FROM ?? "Mjazo <ops@mjazo.pk>", to: process.env.OPS_EMAIL, subject, text }),
  }).catch((e) => console.error("[notifyOps] email failed", e))
}

/** Validates and stores a submission. Throws a ValidationError with a user-facing message. */
export class ValidationError extends Error {}

export async function saveSubmission(type: SubmissionType, raw: unknown, attribution: Record<string, unknown> = {}, page?: string) {
  const parsed = schemas[type].safeParse(raw)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid data")
  const id = newId()
  const record = { id, type, data: parsed.data, attribution, page, created_at: new Date().toISOString() }
  if (supabase) {
    const { error } = await supabase.from("submissions").insert(record)
    if (error) throw error
  } else {
    // No database: Vercel only allows writes to /tmp, so keep a copy there and log the record
    // (visible in Vercel → Logs). Connect Supabase for durable storage.
    console.log("[submission]", JSON.stringify(record))
    const dir = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".data")
    await fs.mkdir(dir, { recursive: true })
    await fs.appendFile(path.join(dir, "submissions.jsonl"), JSON.stringify(record) + "\n")
  }
  void notifyOps(`[Mjazo] New ${type} ${id}`, JSON.stringify(record, null, 2))
  return { id, record }
}

export type StoredSubmission = { id: string; type: SubmissionType; data: Record<string, unknown>; attribution: Record<string, unknown>; page?: string; created_at: string }

/** Read stored submissions of one type (for the ops tools), optionally only those since an ISO time. */
export async function listSubmissions(type: SubmissionType, since?: string): Promise<StoredSubmission[]> {
  if (supabase) {
    // Paged: Supabase caps each response at 1000 rows.
    const out: StoredSubmission[] = []
    for (let from = 0; ; from += 1000) {
      let q = supabase.from("submissions").select("*").eq("type", type)
      if (since) q = q.gte("created_at", since)
      const { data, error } = await q.order("created_at", { ascending: true }).range(from, from + 999)
      if (error) throw error
      out.push(...((data ?? []) as StoredSubmission[]))
      if (!data || data.length < 1000) return out
    }
  }
  const dir = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".data")
  try {
    const text = await fs.readFile(path.join(dir, "submissions.jsonl"), "utf8")
    const t = since ? Date.parse(since) : 0
    return text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as StoredSubmission)
      .filter((r) => r.type === type && (!t || Date.parse(r.created_at) >= t))
  } catch {
    return []
  }
}
