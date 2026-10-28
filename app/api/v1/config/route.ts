import { NextResponse } from "next/server"
import { authMode } from "@/lib/cms/auth"
import { getSettings } from "@/lib/cms/read"
import { core } from "@/lib/core/db"
import { bookingTaxTerms } from "@/lib/core/policy"
import { phoneSignIn } from "@/lib/server/phone-sign-in"

// What the phone apps need before anyone signs in: Supabase's public address and key (for the
// emailed sign-in link; both are public, the website's pages carry them too), whether email
// sign-in is on, how sign-in codes can go to a phone number (null: phone sign-in is off), the
// contact numbers, and the sales tax a booking made now carries. Nothing secret.

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = authMode() === "supabase" && Boolean(url && anonKey)
  const site = await getSettings("en")
    .then((s) => s.site)
    .catch(() => null)
  const phone = await phoneSignIn()
  // Sindh sales tax on a booking made now (null: none), so checkout can show it as the server works it out.
  const db = await core().catch(() => null)
  const tax = db ? await bookingTaxTerms(db).catch(() => null) : null
  return NextResponse.json(
    { emailSignIn: email, supabase: email ? { url, anonKey } : null, phoneSignIn: phone, contact: site ? { phone: site.phone, whatsapp: site.whatsapp, email: site.email } : null, tax },
    // Not cached: checkout must show the sales tax the server charges from the moment it changes.
    { headers: { "cache-control": "no-store" } },
  )
}
