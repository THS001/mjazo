import { draftMode } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { getCmsUser } from "@/lib/cms/auth"

// Preview: a signed-in CMS user sees drafts on the real site (Next draft mode) until they exit.
// GET /api/cms/preview?path=/services/womens-salon   ·   GET /api/cms/preview?exit=1&path=/

export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = url.searchParams.get("path") || "/"
  // Only same-site paths, never an open redirect.
  const path = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/"
  const dm = await draftMode()
  if (url.searchParams.get("exit")) {
    dm.disable()
    redirect(path)
  }
  const user = await getCmsUser()
  if (!user || (user.mfa && user.mfa !== "ok")) return NextResponse.json({ error: "Sign in to the CMS to preview." }, { status: 401 })
  dm.enable()
  redirect(path)
}
