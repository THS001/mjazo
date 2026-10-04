import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { handle, readJson } from "@/lib/server/api"
import { put } from "@/lib/server/docs"
import { getJob, normalisePhone, nowIso, syncJobs } from "@/lib/server/ops"

// Photos for the pro's brief (Ghar Scan or Glam Mirror), sent right after a booking is placed.
// Kept only until the visit is completed or cancelled, then deleted (see addJobEvent).

const body = z.object({
  bookingId: z.string().min(4).max(40),
  phone: z.string().min(10).max(20),
  photos: z.array(z.string().startsWith("data:image/jpeg;base64,").max(450_000)).min(1).max(3),
})

export async function POST(req: Request) {
  if (rateLimited(`attach:${clientIp(req)}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 })
  return handle(async () => {
    const b = body.parse(await readJson(req))
    let job = await getJob(b.bookingId)
    if (!job) {
      await syncJobs()
      job = await getJob(b.bookingId)
    }
    if (!job || normalisePhone(job.customer.phone) !== normalisePhone(b.phone)) return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    if (Date.now() - Date.parse(job.createdAt) > 2 * 3600_000 || ["completed", "cancelled"].includes(job.status)) return NextResponse.json({ error: "Photos can only be added when booking." }, { status: 400 })
    await put("attachments", { id: job.id, photos: b.photos, at: nowIso() })
    return { ok: true }
  })
}
