import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { authMode } from "@/lib/cms/auth"
import { handle, readJson } from "@/lib/server/api"
import { prepareEmailSignIn } from "@/lib/server/pro-auth"

// Email sign-in for pros, step 1 (the browser or phone app then asks Supabase for the link, with
// new sign-ups switched off). Answers the same whether or not a pro has that email.

export async function POST(req: Request) {
  if (authMode() !== "supabase") return NextResponse.json({ error: "Email sign-in isn't available here. Use your phone number and PIN." }, { status: 404 })
  if (rateLimited(`pro-email:${clientIp(req)}`, 5, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait 10 minutes and try again." }, { status: 429 })
  return handle(async () => {
    const { email } = z.object({ email: z.string().trim().email("Enter your email").max(200) }).parse(await readJson(req))
    await prepareEmailSignIn(email)
    return { ok: true }
  })
}
