import { MEDIA_TYPES, readLocalFile } from "@/lib/cms/media"

// Local development only: serves files from .data/media (on Supabase they come from Storage).

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = (await params).path.join("/")
  const bytes = /^\d{4}\/\d{2}\/[a-z0-9]+-[a-z0-9-]+\.[a-z0-9]+$/.test(p) ? await readLocalFile(p) : null
  if (!bytes) return new Response("Not found", { status: 404 })
  const ext = p.split(".").pop()
  const mime = Object.entries(MEDIA_TYPES).find(([, t]) => t.ext === ext)?.[0] ?? "application/octet-stream"
  return new Response(new Uint8Array(bytes), { headers: { "content-type": mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } })
}
