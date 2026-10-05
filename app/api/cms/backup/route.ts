import { NextResponse } from "next/server"
import { CmsAuthError, requireCms } from "@/lib/cms/auth"
import { checkBackup, exportBackup, importBackup, type Backup } from "@/lib/cms/backup"
import { writable } from "@/lib/cms/store"

// Backups (Team → Backup). GET downloads one (Owners and Admins); POST imports one (Owners only),
// with ?mode=draft (everything comes back as drafts) or ?mode=replace (exactly as in the backup).
// A route rather than a server action: backups can be bigger than a server action may receive.

const denied = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : "You don't have permission to do that." }, { status: 403 })

export async function GET() {
  let user
  try {
    user = await requireCms("settings")
  } catch (e) {
    return denied(e)
  }
  const backup = await exportBackup(user)
  return new NextResponse(JSON.stringify(backup), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mjazo-cms-backup-${backup.exportedAt.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  })
}

export async function POST(req: Request) {
  let user
  try {
    user = await requireCms("backup")
  } catch (e) {
    return e instanceof CmsAuthError ? denied(e) : denied(null)
  }
  if (!writable()) return NextResponse.json({ error: "Importing needs Supabase: the live site can't save without it." }, { status: 400 })
  const mode = new URL(req.url).searchParams.get("mode") === "replace" ? "replace" : "draft"
  const body = await req.json().catch(() => null)
  const problems = checkBackup(body)
  if (problems.length) return NextResponse.json({ error: problems[0] }, { status: 400 })
  try {
    return NextResponse.json(await importBackup(user, body as Backup, mode))
  } catch (e) {
    console.error("[cms] backup import failed", e)
    return NextResponse.json({ error: "The import stopped part-way. Entries imported so far are kept; check the activity log." }, { status: 500 })
  }
}
