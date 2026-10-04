import { NextResponse } from "next/server"
import { safeEqual } from "@/lib/server/session"
import { publishDue } from "@/lib/cms/write"

// Scheduled publishing for an external scheduler (every 5 minutes, like the safety cron),
// authorised with `Authorization: Bearer $CRON_SECRET`.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const published = await publishDue()
  return NextResponse.json({ published })
}
