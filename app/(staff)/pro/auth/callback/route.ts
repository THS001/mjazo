import { NextResponse } from "next/server"
import { authMode, supabaseAuth } from "@/lib/cms/auth"
import { proForAccount, SESSION_DAYS, startSession } from "@/lib/server/pro-auth"
import { setSession } from "@/lib/server/session"

// A pro's emailed sign-in link lands here: the one-time code proves the email, and the pro app
// then keeps its own session (the same as a PIN sign-in). The Supabase session is only used for
// that proof, so it's signed out again on this browser only (her phone app stays signed in).

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  let error = "link"
  if (code && authMode() === "supabase") {
    const sb = await supabaseAuth()
    const { data, error: failed } = await sb.auth.exchangeCodeForSession(code)
    if (!failed && data.user) {
      const pro = await proForAccount(data.user)
      await sb.auth.signOut({ scope: "local" }).catch(() => {})
      if (pro) {
        const s = startSession(pro)
        await setSession(s.value, SESSION_DAYS * 86400)
        return NextResponse.redirect(new URL("/pro", url.origin))
      }
      error = "no-pro"
    }
  }
  return NextResponse.redirect(new URL(`/pro?error=${error}`, url.origin))
}
