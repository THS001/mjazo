import { NextResponse } from "next/server"
import { authMode } from "@/lib/cms/auth"
import { getSettings } from "@/lib/cms/read"
import { phoneSignIn } from "@/lib/server/phone-sign-in"

// What the phone apps need before anyone signs in: Supabase's public address and key (for the
// emailed sign-in link; both are public, the website's pages carry them too), whether email
// sign-in is on, how sign-in codes can go to a phone number (null: phone sign-in is off), and the
// contact numbers. Nothing secret.

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = authMode() === "supabase" && Boolean(url && anonKey)
  const site = await getSettings("en")
    .then((s) => s.site)
    .catch(() => null)
  const phone = await phoneSignIn()
  return NextResponse.json(
    { emailSignIn: email, supabase: email ? { url, anonKey } : null, phoneSignIn: phone, contact: site ? { phone: site.phone, whatsapp: site.whatsapp, email: site.email } : null },
    { headers: { "cache-control": "public, s-maxage=300" } },
  )
}
