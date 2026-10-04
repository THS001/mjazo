import { NextResponse } from "next/server"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { safeEqual, setSession, staffEnabled } from "@/lib/server/session"
import { handle, readJson } from "@/lib/server/api"

export async function POST(req: Request) {
  if (!staffEnabled()) return NextResponse.json({ error: "Staff login isn't set up yet (OPS_PASSCODE and SESSION_SECRET)." }, { status: 503 })
  if (rateLimited(`ops-login:${clientIp(req)}`, 6, 10 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again in 10 minutes." }, { status: 429 })
  return handle(async () => {
    const { passcode } = await readJson(req)
    if (typeof passcode !== "string" || !safeEqual(passcode, process.env.OPS_PASSCODE!)) return NextResponse.json({ error: "Wrong passcode." }, { status: 401 })
    await setSession({ role: "ops" }, 12 * 3600)
    return { ok: true }
  })
}
