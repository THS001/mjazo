import { NextResponse } from "next/server"
import { authMode, supabaseAuth } from "@/lib/cms/auth"
import { safeNext } from "@/lib/cms/next-path"

// Magic links, invites and password resets land here: swap the one-time code for a session.
// `next` may only be a CMS or mission control page.

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const next = safeNext(url.searchParams.get("next"))
  if (code && authMode() === "supabase") {
    const { error } = await (await supabaseAuth()).auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }
  return NextResponse.redirect(new URL(`/admin/login?error=link${next.startsWith("/ops") ? "&next=/ops" : ""}`, url.origin))
}
