import "server-only"
import { revalidateTag } from "next/cache"
import { SITE_URL } from "@/lib/site"
import { zodObject } from "./fields"
import { getType } from "./registry"
import { SINGLETON } from "./defaults"
import { addAudit, addVersion, allRows, getRow, writeRow, type Data, type EntryRow, type Status } from "./store"
import { importMediaRecords, listMedia, type MediaRow } from "./media"
import { listRedirects, type Redirect } from "./redirect-rules"
import { saveRedirect } from "./redirects"
import type { CmsUser } from "./auth"
import "./types"

// Backups of everything editors have saved: every entry (drafts, published, hidden, scheduled),
// the media library's records and the redirects. Built-in content isn't in a backup because it
// ships with the site's code, and media files stay in Storage (only their records are kept).
// Importing never deletes anything: it adds and replaces, and every imported entry gets an
// "imported" version in its history.

export const BACKUP_FORMAT = "mjazo-cms-backup"
export type Backup = {
  format: typeof BACKUP_FORMAT
  version: 1
  exportedAt: string
  exportedBy: string
  site: string
  entries: EntryRow[]
  media: MediaRow[]
  redirects: Redirect[]
}

/** "draft": every entry comes back as a draft to review and publish (the live site doesn't change). "replace": exactly as in the backup, live content included. */
export type ImportMode = "draft" | "replace"
export type ImportReport = { mode: ImportMode; entries: number; unchanged: number; media: number; redirects: number; skipped: { what: string; why: string }[] }

export async function exportBackup(user: CmsUser): Promise<Backup> {
  const [entries, media, redirects] = await Promise.all([allRows(), listMedia(), listRedirects()])
  await addAudit({ user_id: user.id, user_name: user.name, action: "downloaded a backup", type: "backup", entry_id: null, title: `${entries.length} entries, ${media.length} media, ${redirects.length} redirects`, detail: null })
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), exportedBy: user.name, site: SITE_URL, entries, media, redirects }
}

const STATUSES: Status[] = ["draft", "published", "scheduled", "archived"]

/** Problems that stop a file from being imported at all (empty when it's a backup this CMS can read). */
export function checkBackup(b: unknown): string[] {
  if (!b || typeof b !== "object") return ["That file isn't a Mjazo CMS backup."]
  const x = b as Partial<Backup>
  if (x.format !== BACKUP_FORMAT) return ["That file isn't a Mjazo CMS backup."]
  if (x.version !== 1) return [`This backup is version ${String(x.version)}; this CMS reads version 1.`]
  if (!Array.isArray(x.entries) || !Array.isArray(x.media ?? []) || !Array.isArray(x.redirects ?? [])) return ["The backup is incomplete or damaged."]
  return []
}

/** Why one stored payload can't be imported (or null when it fits its type). */
function payloadProblem(type: string, data: Data | null): string | null {
  if (data === null) return null
  const t = getType(type)!
  const r = zodObject(t.fields).safeParse(data)
  if (!r.success) return `${r.error.issues[0]?.path.join(".") || "entry"}: ${r.error.issues[0]?.message ?? "invalid"}`
  return t.check?.(data)[0] ?? null
}

export async function importBackup(user: CmsUser, b: Backup, mode: ImportMode): Promise<ImportReport> {
  const report: ImportReport = { mode, entries: 0, unchanged: 0, media: 0, redirects: 0, skipped: [] }
  const from = `the backup of ${b.exportedAt.slice(0, 10)}`

  for (const e of b.entries) {
    const what = `${e?.type}/${e?.id}`
    const t = e && typeof e.type === "string" ? getType(e.type) : undefined
    if (!t || typeof e.id !== "string" || !e.id) {
      report.skipped.push({ what, why: "This kind of content doesn't exist in this version of the site." })
      continue
    }
    if (t.kind === "singleton" && e.id !== SINGLETON) {
      report.skipped.push({ what, why: "Not a valid page or settings entry." })
      continue
    }
    const draft = (e.draft ?? null) as Data | null
    const published = (e.published ?? null) as Data | null
    const incoming = mode === "draft" ? (draft ?? published) : null
    if (mode === "draft" && !incoming) {
      report.skipped.push({ what, why: "Hidden in the backup, with nothing to restore as a draft." })
      continue
    }
    const problem = mode === "draft" ? payloadProblem(e.type, incoming) : (payloadProblem(e.type, draft) ?? payloadProblem(e.type, published))
    if (problem) {
      report.skipped.push({ what, why: `Doesn't fit this version of the site (${problem}).` })
      continue
    }
    const row = await getRow(e.type, e.id)
    // Already the same here: leave it alone, so it isn't marked as changed.
    const same = mode === "draft" ? JSON.stringify(incoming) === JSON.stringify(row?.draft ?? row?.published ?? null) : row !== null && JSON.stringify([row.status, row.draft, row.published]) === JSON.stringify([e.status, draft, published])
    if (same) {
      report.unchanged++
      continue
    }
    const saved =
      mode === "draft"
        ? await writeRow(
            {
              type: e.type,
              id: e.id,
              // The live site doesn't change: hidden items stay hidden, and a pending schedule is
              // cancelled so the imported draft isn't published by it.
              status: row?.status === "archived" ? "archived" : row?.published ? "published" : "draft",
              draft: incoming,
              published: row?.published ?? null,
              review: false,
              position: row?.position ?? e.position ?? null,
              publish_at: null,
              updated_by: user.name,
              published_by: row?.published_by ?? null,
              published_at: row?.published_at ?? null,
            },
            row?.version ?? 0,
          )
        : await writeRow(
            {
              type: e.type,
              id: e.id,
              status: STATUSES.includes(e.status) ? e.status : "draft",
              draft,
              published,
              review: Boolean(e.review),
              position: typeof e.position === "number" ? e.position : null,
              publish_at: e.status === "scheduled" ? (e.publish_at ?? null) : null,
              updated_by: user.name,
              published_by: e.published_by ?? null,
              published_at: e.published_at ?? null,
            },
            row?.version ?? 0,
          )
    const kept = incoming ?? draft ?? published
    if (kept) await addVersion({ type: e.type, entry_id: e.id, version: saved.version, kind: "imported", data: kept, note: `From ${from}${mode === "draft" ? " (as a draft)" : ""}`, user_id: user.id, user_name: user.name })
    report.entries++
  }

  report.media = await importMediaRecords(Array.isArray(b.media) ? b.media : [])

  const existing = new Set((await listRedirects()).map((r) => r.source))
  for (const r of Array.isArray(b.redirects) ? b.redirects : []) {
    if (!r || typeof r.source !== "string" || existing.has(r.source)) continue
    try {
      await saveRedirect(user, { source: r.source, destination: r.destination, permanent: r.permanent !== false, note: r.note ?? `From ${from}` })
      report.redirects++
    } catch (err) {
      report.skipped.push({ what: `redirect ${r.source}`, why: err instanceof Error ? err.message : "Couldn't be added." })
    }
  }

  // Everything the site reads from the CMS carries the "cms" tag.
  try {
    revalidateTag("cms", { expire: 0 })
  } catch {}
  await addAudit({
    user_id: user.id,
    user_name: user.name,
    action: mode === "draft" ? "imported a backup as drafts" : "restored a backup",
    type: "backup",
    entry_id: null,
    title: `${report.entries} entries${report.unchanged ? ` (${report.unchanged} already matched)` : ""}, ${report.media} media, ${report.redirects} redirects from ${from}`,
    detail: report.skipped.length ? `Skipped: ${report.skipped.map((s) => s.what).join(", ")}` : null,
  })
  return report
}
