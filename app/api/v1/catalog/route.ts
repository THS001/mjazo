import { NextResponse } from "next/server"
import { appCatalog } from "@/lib/server/app-catalog"

// The catalogue for the phone app (?lang=en|ur): categories, services and prices, areas, time
// windows, the minimum order, the booking policy and the contact numbers. Public; cached briefly.

export async function GET(req: Request) {
  const url = new URL(req.url)
  const lang = url.searchParams.get("lang") === "ur" ? "ur" : "en"
  try {
    return NextResponse.json(await appCatalog(lang, url.origin), { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } })
  } catch (e) {
    console.error("[catalog] failed", e)
    return NextResponse.json({ error: "The catalogue couldn't be loaded. Try again." }, { status: 500 })
  }
}
