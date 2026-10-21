import { NextResponse } from "next/server"
import { safeEqual } from "@/lib/server/session"
import { runAutomation } from "@/lib/server/automation"

export const maxDuration = 60

// The automation run for an external scheduler (every 5 minutes, the same pinger and CRON_SECRET as
// the Safety Guardian) and for Vercel's daily cron (vercel.json): customer messages, the day-before
// reminders, review requests, the weekly payout run, the opt-in nudges, and sending what's queued.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json((await runAutomation()) ?? { skipped: "The core database isn't set up" })
}
