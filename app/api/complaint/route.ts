import { NextResponse } from "next/server"
import { z } from "zod"
import { aiEnabled, clientIp, rateLimited } from "@/lib/ai/anthropic"
import { draftComplaint } from "@/lib/ai/staff-agents"
import { transcribe } from "@/lib/ai/stt"
import { handle, readJson } from "@/lib/server/api"
import { audit } from "@/lib/server/audit"
import { put } from "@/lib/server/docs"
import { newId, notifyOps } from "@/lib/server/store"
import { getJob, normalisePhone, nowIso, syncJobs } from "@/lib/server/ops"
import type { Complaint } from "@/lib/ops/types"

export const maxDuration = 60

// Public "report a problem" endpoint. The booking ID + phone must match. A voice note is
// transcribed when speech-to-text is configured (and kept for ops to listen to either way).
// Trust Desk drafts a policy-based resolution; a person approves it before anything is promised.

const AUDIO = /^data:audio\/(webm|ogg|mp4|mpeg|aac|x-m4a)(;[^,]*)?;base64,/
const body = z
  .object({
    bookingId: z.string().min(4).max(40),
    phone: z.string().min(10).max(20),
    text: z.string().max(2000).optional(),
    photo: z.string().startsWith("data:image/jpeg;base64,").max(1_500_000).optional(),
    audio: z.string().regex(AUDIO, "Unsupported voice note").max(1_600_000).optional(),
  })
  .refine((b) => (b.text?.trim().length ?? 0) >= 10 || b.audio, { message: "Please tell us a little more, or record a voice note", path: ["text"] })

export async function POST(req: Request) {
  if (rateLimited(`complaint:${clientIp(req)}`, 5, 10 * 60_000)) return NextResponse.json({ error: "Too many attempts. Please try again later or WhatsApp us." }, { status: 429 })
  return handle(async () => {
    const b = body.parse(await readJson(req))
    const bookingId = b.bookingId.trim().toUpperCase()
    let job = await getJob(bookingId)
    if (!job) {
      await syncJobs()
      job = await getJob(bookingId)
    }
    if (!job || normalisePhone(job.customer.phone) !== normalisePhone(b.phone)) return NextResponse.json({ error: "We couldn't match that booking ID and phone number. Check both, or WhatsApp us." }, { status: 404 })
    let transcript: string | undefined
    if (b.audio) {
      const mime = b.audio.slice(5, b.audio.indexOf(";"))
      transcript = (await transcribe(Uint8Array.from(Buffer.from(b.audio.split(",")[1], "base64")).buffer, mime).catch(() => null)) ?? undefined
    }
    const text = [b.text?.trim(), transcript && `Voice note: ${transcript}`].filter(Boolean).join("\n\n") || "(voice note, not transcribed yet)"
    const c: Complaint = { id: `C-${newId().slice(3)}`, createdAt: nowIso(), bookingId, phone: normalisePhone(b.phone), text, photo: b.photo, audio: b.audio, transcript, status: "new" }
    await put("complaints", c)
    await audit("customer", "reported a problem", bookingId, b.audio ? "with voice note" : undefined)
    if (aiEnabled() && (b.text?.trim() || transcript)) {
      try {
        c.draft = await draftComplaint(c, job)
        c.status = "draft_ready"
        await put("complaints", c)
      } catch (e) {
        console.error("[complaint] draft failed", e)
      }
    }
    void notifyOps(`[Mjazo] Complaint ${c.id} on ${bookingId}`, `${text}\n\nAI draft: ${c.draft ? `${c.draft.resolution}: ${c.draft.reasoning}` : "none"}`)
    return { id: c.id }
  })
}
