"use client"

import { useState } from "react"
import { Download, FileJson, Loader2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn, Card, Notice, when } from "./ui"

// Team → Backup: download everything editors have saved, and (Owners) bring a backup back in.

type Summary = { exportedAt: string; exportedBy: string; site: string; entries: number; byStatus: Record<string, number>; types: number; media: number; redirects: number }
type Report = { mode: "draft" | "replace"; entries: number; unchanged: number; media: number; redirects: number; skipped: { what: string; why: string }[] }
const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

function summarise(b: Record<string, unknown>): Summary | null {
  if (b?.format !== "mjazo-cms-backup" || !Array.isArray(b.entries)) return null
  const entries = b.entries as { type: string; status: string }[]
  const byStatus: Record<string, number> = {}
  for (const e of entries) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1
  return {
    exportedAt: String(b.exportedAt ?? ""),
    exportedBy: String(b.exportedBy ?? ""),
    site: String(b.site ?? ""),
    entries: entries.length,
    byStatus,
    types: new Set(entries.map((e) => e.type)).size,
    media: Array.isArray(b.media) ? b.media.length : 0,
    redirects: Array.isArray(b.redirects) ? b.redirects.length : 0,
  }
}

const STATUS: Record<string, string> = { published: "published", draft: "drafts", scheduled: "scheduled", archived: "hidden" }

export function BackupTool({ canExport, canImport, writable }: { canExport: boolean; canImport: boolean; writable: boolean }) {
  const [file, setFile] = useState<{ name: string; text: string; summary: Summary } | null>(null)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"draft" | "replace">("draft")
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)

  const pick = async (f: File | undefined) => {
    setError("")
    setReport(null)
    setFile(null)
    if (!f) return
    try {
      const text = await f.text()
      const summary = summarise(JSON.parse(text))
      if (!summary) return setError("That file isn't a Mjazo CMS backup.")
      setFile({ name: f.name, text, summary })
    } catch {
      setError("That file isn't a Mjazo CMS backup (it isn't valid JSON).")
    }
  }

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/cms/backup?mode=${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: file.text })
      const j = await res.json().catch(() => ({ error: "The server didn't answer properly." }))
      if (!res.ok) setError(j.error ?? "The import failed.")
      else {
        setReport(j as Report)
        setFile(null)
        setSure(false)
      }
    } catch {
      setError("The import couldn't reach the server. Nothing may have been imported; check the activity log.")
    }
    setBusy(false)
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="flex items-center gap-2 font-medium">
          <Download className="h-4 w-4" /> Download a backup
        </p>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          One file with everything people have saved here: every page, catalogue item, post and setting (live, drafts, scheduled and hidden), the media library&apos;s records and the redirects. Keep it somewhere safe, for example before big changes. Built-in content isn&apos;t in it because it comes with the site; photos and videos stay in storage.
        </p>
        <div className="mt-4">
          {canExport ? (
            <a href="/api/cms/backup" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-black/85">
              <Download className="h-4 w-4" /> Download backup
            </a>
          ) : (
            <Notice>Owners and Admins can download backups.</Notice>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <p className="flex items-center gap-2 font-medium">
          <Upload className="h-4 w-4" /> Restore from a backup
        </p>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Brings a backup back in. It adds and replaces entries but never deletes anything, and every restored entry gets an “Imported” version in its history, so you can go back.
        </p>
        {!canImport ? (
          <Notice className="mt-4">Only an Owner can restore a backup.</Notice>
        ) : !writable ? (
          <Notice tone="warn" className="mt-4">
            Restoring needs Supabase: without it, the live site can&apos;t save anything.
          </Notice>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-4 text-sm hover:border-foreground">
              <FileJson className="h-5 w-5 text-zinc-400" />
              <span>{file ? file.name : "Choose a backup file (.json)"}</span>
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            </label>

            {file && (
              <>
                <div className="rounded-xl bg-zinc-50 p-4 text-sm">
                  <p className="font-medium">
                    Backup of {when(file.summary.exportedAt)} by {file.summary.exportedBy || "someone"}
                  </p>
                  <p className="mt-1 text-zinc-600">
                    {n(file.summary.entries, "entry", "entries")} across {n(file.summary.types, "kind")} of content (
                    {Object.entries(file.summary.byStatus)
                      .map(([s, n]) => `${n} ${STATUS[s] ?? s}`)
                      .join(", ")}
                    ), {n(file.summary.media, "media record")}, {n(file.summary.redirects, "redirect")}.
                  </p>
                  {file.summary.site && <p className="mt-1 text-xs text-zinc-500">From {file.summary.site}</p>}
                </div>

                <fieldset className="space-y-2">
                  {(
                    [
                      ["draft", "As drafts (recommended)", "Every entry comes back as a draft. The live site doesn't change until someone reviews and publishes."],
                      ["replace", "Exactly as in the backup", "Live content, drafts, schedules and hidden items become what they were in the backup. The live site changes straight away."],
                    ] as const
                  ).map(([v, label, help]) => (
                    <label key={v} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3", mode === v ? "border-foreground bg-white" : "border-zinc-200 bg-white")}>
                      <input type="radio" name="mode" checked={mode === v} onChange={() => (setMode(v), setSure(false))} className="mt-1 accent-black" />
                      <span>
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="block text-xs text-zinc-500">{help}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {mode === "replace" && (
                  <label className="flex items-start gap-2 text-sm text-red-800">
                    <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 accent-red-700" />
                    I understand the live site will change to match this backup.
                  </label>
                )}

                <Btn variant={mode === "replace" ? "danger" : "primary"} disabled={busy || (mode === "replace" && !sure)} onClick={run}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {mode === "replace" ? "Restore the backup" : "Import as drafts"}
                </Btn>
              </>
            )}
          </div>
        )}
        {error && (
          <Notice tone="error" className="mt-4">
            {error}
          </Notice>
        )}
        {report && (
          <Notice tone="ok" className="mt-4">
            <p className="font-medium">
              {report.mode === "draft" ? "Imported as drafts" : "Restored"}: {n(report.entries, "entry", "entries")}, {n(report.media, "media record")}, {n(report.redirects, "redirect")}.
              {report.unchanged > 0 && ` ${n(report.unchanged, "entry", "entries")} already matched and were left as they are.`}
              {report.mode === "draft" && report.entries > 0 && " Review them and publish when ready."}
            </p>
            {report.skipped.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer">{report.skipped.length} skipped</summary>
                <ul className="mt-1 list-disc ps-5 text-xs">
                  {report.skipped.map((s, i) => (
                    <li key={i}>
                      <b className="font-medium">{s.what}</b>: {s.why}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Notice>
        )}
      </Card>
    </div>
  )
}
