import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { slotsFor } from "@/lib/server/bookings-core"

// Open arrival windows for a cart in an area, for the next 7 days (checkout and the apps).
// POST { area, items: [{ category, service, qty }] } → { mode, days: [{ date, windows: [{ label, open }] }] }
// mode: "capacity" (real pro availability), "open" (no pro can take it yet: the team confirms),
// or "off" (the core engine isn't connected: use the plain time rules).

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    return NextResponse.json(await slotsFor(await req.json().catch(() => null)), { headers: { "cache-control": "no-store" } })
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    console.error("[slots] failed", e)
    // Never block a booking because availability couldn't be read.
    return NextResponse.json({ mode: "off", days: [] })
  }
}
