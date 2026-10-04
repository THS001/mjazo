import { NextResponse } from "next/server"
import { requireCms } from "@/lib/cms/auth"
import { MEDIA_TYPES, MediaError, writeLocalFile } from "@/lib/cms/media"

// Local development only: receives the bytes of an upload that prepareUpload reserved.
// On Supabase the browser uploads straight to Storage with a signed URL instead.

export async function POST(req: Request) {
  try {
    await requireCms("media")
  } catch {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  }
  if (process.env.VERCEL) return NextResponse.json({ error: "Not available on the live site." }, { status: 404 })
  const url = new URL(req.url)
  const p = url.searchParams.get("path") ?? ""
  const mime = url.searchParams.get("mime") ?? ""
  const t = MEDIA_TYPES[mime]
  if (!t || !/^\d{4}\/\d{2}\/[a-z0-9]+-[a-z0-9-]+\.[a-z0-9]+$/.test(p) || !p.endsWith(`.${t.ext}`)) return NextResponse.json({ error: "Bad upload reference." }, { status: 400 })
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.length > t.max) return NextResponse.json({ error: "That file is too big." }, { status: 413 })
  try {
    await writeLocalFile(p, bytes, mime)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof MediaError ? e.message : "Upload failed." }, { status: 400 })
  }
}
