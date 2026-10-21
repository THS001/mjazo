import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { getSettings } from "@/lib/cms/read"
import { requireCore } from "@/lib/core/db"
import { referralCodeForPhone } from "@/lib/core/growth"
import { handle, readJson } from "@/lib/server/api"

// A referral code for someone who isn't signed in (the website's "Refer & earn" box): their name
// and number. The code is theirs from then on; the credit it earns waits in their account, which
// they reach by signing in and adding the same number. Signed-in customers get theirs from /me.

const body = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().max(20) })

export async function POST(req: Request) {
  if (rateLimited(`referral:${clientIp(req)}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 })
  return handle(async () => {
    const b = body.parse(await readJson(req))
    const [code, s] = await Promise.all([referralCodeForPhone(await requireCore(), b.name, b.phone), getSettings("en")])
    return { code, friendOff: s.referral.friendOff, youGet: s.referral.youGet }
  })
}
