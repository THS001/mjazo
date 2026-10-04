import { NextResponse } from "next/server"
import { karachiNow } from "@/lib/time"
import { safeEqual } from "@/lib/server/session"
import { safetySweep, syncJobs } from "@/lib/server/ops"

// Safety Guardian sweep for an external scheduler (every 5 minutes), authorised with
// `Authorization: Bearer $CRON_SECRET`. The ops console and the pro app also sweep when they poll.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const today = karachiNow().date
  const jobs = (await syncJobs()).filter((j) => j.date === today)
  const swept = await safetySweep(jobs)
  return NextResponse.json({ checked: swept.length, alerts: swept.filter((j) => j.safety.level !== "ok").map((j) => ({ id: j.id, level: j.safety.level })) })
}
