import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { karachiNow } from "@/lib/time"
import { RATING_TAGS } from "@/lib/ops/types"
import { handle, readJson } from "@/lib/server/api"
import { audit } from "@/lib/server/audit"
import { notifyOps } from "@/lib/server/store"
import { OpsError, getJob, normalisePhone, nowIso, syncJobs, updateJob } from "@/lib/server/ops"

// Post-visit rating (booking ID + phone must match). Feeds Trust Desk quality signals.

const TAGS = [...RATING_TAGS.good, ...RATING_TAGS.bad] as string[]
const body = z.object({
  bookingId: z.string().min(4).max(40),
  phone: z.string().min(10).max(20),
  stars: z.number().int().min(1).max(5),
  tags: z.array(z.string()).max(8).optional(),
  comment: z.string().max(500).optional(),
})

export async function POST(req: Request) {
  if (rateLimited(`rate:${clientIp(req)}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
  return handle(async () => {
    const b = body.parse(await readJson(req))
    const id = b.bookingId.trim().toUpperCase()
    let job = await getJob(id)
    if (!job) {
      await syncJobs()
      job = await getJob(id)
    }
    if (!job || normalisePhone(job.customer.phone) !== normalisePhone(b.phone)) return NextResponse.json({ error: "We couldn't match that booking ID and phone number." }, { status: 404 })
    if (job.status === "cancelled") return NextResponse.json({ error: "This booking was cancelled." }, { status: 400 })
    if (job.status !== "completed" && job.date >= karachiNow().date) return NextResponse.json({ error: "You can rate the visit once it's done." }, { status: 400 })
    const tags = (b.tags ?? []).filter((t) => TAGS.includes(t))
    const rated = await updateJob(id, (j) => {
      if (j.rating) throw new OpsError("This visit is already rated. Thank you!")
      j.rating = { stars: b.stars, tags, comment: b.comment?.trim() || undefined, at: nowIso() }
    })
    await audit("customer", "rated visit", id, `${b.stars}★ ${tags.join(", ")}`)
    if (b.stars <= 2) void notifyOps(`[Mjazo] Low rating on ${id} (${b.stars}★)`, `${rated.customer.name} rated ${b.stars}/5.\nTags: ${tags.join(", ") || "none"}\n${b.comment ?? ""}`)
    return { ok: true, low: b.stars <= 2 }
  })
}
