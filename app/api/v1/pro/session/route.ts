import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { core } from "@/lib/core/db"
import { handle, readJson } from "@/lib/server/api"
import { getPros, normalisePhone } from "@/lib/server/ops"
import { proProfile } from "@/lib/server/pro-api"
import { SESSION_DAYS, startSession } from "@/lib/server/pro-auth"
import { clearSession, proEnabled, setSession, verifyPin } from "@/lib/server/session"

// Pro sign-in with phone + PIN (set by ops). The answer carries a token for the phone app
// ("Authorization: Bearer <token>"), and the same session is set as a cookie for /pro on the web.
// DELETE signs the web app out (the phone app just forgets its token).

const body = z.object({ phone: z.string().max(20), pin: z.string().max(6) })

export async function POST(req: Request) {
  if (!proEnabled() || !(await core())) return NextResponse.json({ error: "The pro app isn't set up yet. Please contact Mjazo ops." }, { status: 503 })
  if (rateLimited(`pro-login:${clientIp(req)}`, 8, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait 10 minutes and try again." }, { status: 429 })
  return handle(async () => {
    const b = body.parse(await readJson(req))
    const phone = normalisePhone(b.phone)
    const pro = (await getPros()).find((p) => p.phone === phone)
    if (!pro || !verifyPin(b.pin, pro.pinHash)) return NextResponse.json({ error: "Phone number or PIN is wrong." }, { status: 401 })
    if (pro.status !== "active") return NextResponse.json({ error: "Your account is paused. Please contact Mjazo ops." }, { status: 403 })
    const s = startSession(pro)
    await setSession(s.value, SESSION_DAYS * 86400)
    return { token: s.token, expiresAt: s.expiresAt, pro: await proProfile(pro) }
  })
}

export async function DELETE() {
  return handle(async () => {
    await clearSession()
    return { ok: true }
  })
}
