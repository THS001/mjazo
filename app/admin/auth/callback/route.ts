import { NextResponse } from "next/server"
import { authMode, supabaseAuth } from "@/lib/cms/auth"

// Magic links, invites and password resets land here: swap the one-time code for a session.

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/admin"
  const safeNext = next.startsWith("/admin") ? next : "/admin"
  if (code && authMode() === "supabase") {
    const { error } = await (await supabaseAuth()).auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin))
  }
  return NextResponse.redirect(new URL("/admin/login?error=link", url.origin))
}
