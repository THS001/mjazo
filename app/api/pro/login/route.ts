import { NextResponse } from "next/server"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { handle, readJson } from "@/lib/server/api"
import { setSession, staffEnabled, verifyPin } from "@/lib/server/session"
import { getPros, normalisePhone } from "@/lib/server/ops"

export async function POST(req: Request) {
  if (!staffEnabled()) return NextResponse.json({ error: "The pro app isn't set up yet. Please contact Mjazo ops." }, { status: 503 })
  if (rateLimited(`pro-login:${clientIp(req)}`, 8, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait 10 minutes and try again." }, { status: 429 })
  return handle(async () => {
    const { phone, pin } = await readJson(req)
    const pro = typeof phone === "string" ? (await getPros()).find((p) => p.phone === normalisePhone(phone)) : undefined
    if (!pro || typeof pin !== "string" || !verifyPin(pin, pro.pinHash)) return NextResponse.json({ error: "Phone number or PIN is wrong." }, { status: 401 })
    if (pro.status !== "active") return NextResponse.json({ error: "Your account is paused. Please contact Mjazo ops." }, { status: 403 })
    await setSession({ role: "pro", proId: pro.id }, 14 * 86400)
    return { ok: true }
  })
}
