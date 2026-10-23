import { NextResponse } from "next/server"
import { aiEnabled } from "@/lib/ai/anthropic"
import { getPage, getUi } from "@/lib/cms/read"
import type { GharScanContent } from "@/lib/cms/types/pages/tools"

// The wording of the AI tools for the phone app (?lang=en|ur), from the CMS, so the app says what
// the website says and both are edited in one place: the Concierge (Buttons & labels → AI chat)
// and Ghar Scan (Pages → Ghar Scan → Tool text). Also whether the AI is switched on. Public.

export async function GET(req: Request) {
  const lang = new URL(req.url).searchParams.get("lang") === "ur" ? "ur" : "en"
  try {
    const [ui, scan] = await Promise.all([getUi(lang), getPage<GharScanContent>("ghar-scan", lang)])
    return NextResponse.json({ ai: aiEnabled(), concierge: ui.concierge, scan: scan.tool }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } })
  } catch (e) {
    console.error("[tools] failed", e)
    return NextResponse.json({ error: "Couldn't load. Try again." }, { status: 500 })
  }
}
