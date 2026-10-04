"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, CalendarClock, Check, ChevronRight, Eye, EyeOff, History, Languages, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react"
import { approveAll, coverage } from "@/lib/cms/fields"
import { translateEntryAction } from "@/app/(staff)/admin/translate-actions"
import { cn } from "@/lib/utils"
import type { TypeMeta } from "@/lib/cms/meta"
import type { Loaded } from "@/lib/cms/write"
import type { Data, VersionRow } from "@/lib/cms/store"
import { archiveAction, createAction, discardAction, publishAction, restoreAction, saveDraftAction, scheduleAction, submitForReviewAction, unarchiveAction, unscheduleAction, versionsAction, type Result } from "@/app/(staff)/admin/actions"
import { FieldsForm, emptyObject, type FormCtx } from "./fields"
import { Btn, Card, Notice, StateBadge, ago, when } from "./ui"

export type EditorPerms = { canEdit: boolean; canPublish: boolean; canPrices: boolean; canMedia: boolean; seoOnly?: boolean; readOnlyReason: string | null }

type Props = {
  meta: TypeMeta
  entry: Loaded | null // null = creating a new item
  refs: FormCtx["refs"]
  perms: EditorPerms
  previewPath: string | null
}

type SaveState = { kind: "idle" | "saving" | "saved" | "error"; at?: string; message?: string }

export function Editor({ meta, entry, refs, perms, previewPath }: Props) {
  const router = useRouter()
  const isNew = !entry
  const [data, setData] = useState<Data>(() => entry?.data ?? (emptyObject(meta.fields) as Data))
  const [loaded, setLoaded] = useState(entry)
  const [save, setSave] = useState<SaveState>({ kind: "idle" })
  const [issues, setIssues] = useState<string[]>([])
  const [conflict, setConflict] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showUr, setShowUr] = useState(true)
  const [history, setHistory] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const dirty = useRef(false)
  const version = useRef(entry?.version ?? 0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const dataRef = useRef(data)
  dataRef.current = data
  const readOnly = !perms.canEdit || Boolean(perms.readOnlyReason) || loaded?.state === "hidden"
  const ctx: FormCtx = { showUr, canPrices: perms.canPrices, canMedia: perms.canMedia, seoOnly: perms.seoOnly, readOnly, refs, entryType: meta.type }

  const apply = useCallback((r: Result<Loaded | null>) => {
    if (r.ok) {
      setIssues([])
      if (r.data) {
        setLoaded(r.data)
        version.current = r.data.version
      }
      return true
    }
    if (r.conflict) setConflict(r.error)
    setIssues(r.issues ?? [])
    setSave({ kind: "error", message: r.error })
    return false
  }, [])

  /** Saves run one at a time so each uses the version the previous one returned. */
  const enqueue = useCallback(<T,>(fn: () => Promise<T>) => {
    const run = queue.current.then(fn, fn)
    queue.current = run.catch(() => {})
    return run
  }, [])

  const saveNow = useCallback(
    (manual = false) =>
      enqueue(async () => {
        if (isNew || readOnly || conflict) return true
        setSave({ kind: "saving" })
        const r = await saveDraftAction(meta.type, entry!.id, dataRef.current, version.current, manual)
        if (apply(r)) {
          dirty.current = false
          setSave({ kind: "saved", at: new Date().toISOString() })
          return true
        }
        return false
      }),
    [apply, conflict, enqueue, entry, isNew, meta.type, readOnly],
  )

  // Autosave 1.5 s after the last change.
  useEffect(() => {
    if (!dirty.current || isNew) return
    const t = setTimeout(() => void saveNow(false), 1500)
    return () => clearTimeout(t)
  }, [data, isNew, saveNow])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault()
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [])

  const change = (v: Data) => {
    dirty.current = true
    setData(v)
  }

  const act = async (label: string, fn: () => Promise<Result<Loaded | null>>, after?: (r: Result<Loaded | null>) => void) => {
    setBusy(label)
    const r = await enqueue(fn)
    setBusy(null)
    if (apply(r)) {
      dirty.current = false
      setSave({ kind: "saved", at: new Date().toISOString() })
      if (r.ok && r.data) setData(r.data.data)
    }
    after?.(r)
    router.refresh()
  }

  const create = async () => {
    setBusy("create")
    const r = await createAction(meta.type, data)
    setBusy(null)
    if (r.ok) {
      dirty.current = false
      router.push(`/admin/c/${meta.type}/${r.data.id}`)
    } else {
      setIssues(r.issues ?? [])
      setSave({ kind: "error", message: r.error })
    }
  }

  const cov = coverage(meta.fields, data)
  const translate = async (mode: "missing" | "all") => {
    setBusy("translate")
    const r = await translateEntryAction(meta.type, data, mode)
    setBusy(null)
    if (!r.ok) return setSave({ kind: "error", message: r.error })
    if (!r.data.count) return setSave({ kind: "saved", at: new Date().toISOString(), message: "Nothing to translate." })
    change(r.data.data as Data)
  }

  const preview = async () => {
    await saveNow(false)
    if (previewPath) window.open(`/api/cms/preview?path=${encodeURIComponent(previewPath)}`, "_blank")
  }

  const state = loaded?.state
  const rawTitle = data.name ?? data.title
  const title = (typeof rawTitle === "object" && rawTitle ? (rawTitle as { en?: string }).en : typeof rawTitle === "string" ? rawTitle : "") || (meta.kind === "singleton" ? meta.label : "Untitled")

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <span>{meta.group}</span>
            <ChevronRight className="w-3 h-3" />
            {meta.kind === "collection" ? (
              <Link href={`/admin/c/${meta.type}`} className="hover:text-foreground">
                {meta.plural}
              </Link>
            ) : (
              <span>{meta.label}</span>
            )}
          </p>
          <h1 className="mt-1 truncate font-serif text-3xl">{isNew ? `New ${meta.label.toLowerCase()}` : title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            {state && <StateBadge state={state} review={loaded?.review} />}
            <SaveIndicator save={save} />
            {loaded?.publishedAt && <span>Published {ago(loaded.publishedAt)}{loaded.publishedBy ? ` by ${loaded.publishedBy}` : ""}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowUr((s) => !s)} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm", showUr ? "border-foreground bg-foreground text-background" : "border-zinc-300 bg-white")} title="Show the Urdu version of each field">
            <Languages className="w-4 h-4" /> اردو
          </button>
          {!isNew && previewPath && (
            <Btn onClick={preview}>
              <Eye className="w-4 h-4" /> Preview
            </Btn>
          )}
          {!isNew && (
            <Btn onClick={() => setHistory(true)}>
              <History className="w-4 h-4" /> History
            </Btn>
          )}
          {isNew ? (
            <Btn variant="primary" busy={busy === "create"} onClick={create}>
              Create draft
            </Btn>
          ) : perms.canPublish ? (
            <Btn variant="primary" busy={busy === "publish"} disabled={readOnly || Boolean(conflict)} onClick={() => act("publish", () => publishAction(meta.type, entry!.id, data, version.current))}>
              <Send className="w-4 h-4" /> Publish
            </Btn>
          ) : (
            perms.canEdit && (
              <Btn variant="primary" busy={busy === "review"} disabled={readOnly || Boolean(conflict) || loaded?.review} onClick={() => act("review", () => submitForReviewAction(meta.type, entry!.id, data, version.current))}>
                <Send className="w-4 h-4" /> {loaded?.review ? "Submitted" : "Submit for review"}
              </Btn>
            )
          )}
        </div>
      </div>

      {conflict && (
        <Notice tone="error" className="mb-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {conflict}
          </span>
          <Btn size="sm" onClick={() => window.location.reload()}>
            Reload
          </Btn>
        </Notice>
      )}
      {perms.readOnlyReason && <Notice className="mb-4">{perms.readOnlyReason}</Notice>}
      {loaded?.state === "hidden" && <Notice className="mb-4">This item is hidden from the site. Restore it to edit or publish it again.</Notice>}
      {issues.length > 0 && (
        <Notice tone="error" className="mb-4">
          <p className="font-medium">Please fix these first:</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <Card className="p-5 sm:p-6">
          {meta.description && <p className="mb-5 text-sm text-zinc-500">{meta.description}</p>}
          <FieldsForm fields={meta.fields} value={data} onChange={(v) => change(v as Data)} ctx={ctx} />
        </Card>

        {/* Side panel */}
        {!isNew && (
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card className="p-4 text-sm">
              <p className="font-medium">Status</p>
              <dl className="mt-2 space-y-1.5 text-xs text-zinc-500">
                <div className="flex justify-between gap-2">
                  <dt>Last change</dt>
                  <dd className="text-right">{loaded?.updatedAt ? `${ago(loaded.updatedAt)}${loaded.updatedBy ? ` · ${loaded.updatedBy}` : ""}` : "Never edited"}</dd>
                </div>
                {loaded?.publishAt && (
                  <div className="flex justify-between gap-2">
                    <dt>Goes live</dt>
                    <dd className="text-right text-sky-700">{when(loaded.publishAt)}</dd>
                  </div>
                )}
              </dl>
              {perms.canPublish && !readOnly && (
                <div className="mt-4 space-y-2">
                  {loaded?.state === "scheduled" ? (
                    <Btn size="sm" className="w-full" busy={busy === "unschedule"} onClick={() => act("unschedule", () => unscheduleAction(meta.type, entry!.id, version.current))}>
                      <X className="w-3.5 h-3.5" /> Cancel schedule
                    </Btn>
                  ) : scheduling ? (
                    <ScheduleForm onCancel={() => setScheduling(false)} busy={busy === "schedule"} onPick={(at) => act("schedule", () => scheduleAction(meta.type, entry!.id, data, version.current, at), () => setScheduling(false))} />
                  ) : (
                    <Btn size="sm" className="w-full" onClick={() => setScheduling(true)}>
                      <CalendarClock className="w-3.5 h-3.5" /> Schedule publish
                    </Btn>
                  )}
                  {(loaded?.state === "changed" || loaded?.state === "draft") && (
                    <Btn
                      size="sm"
                      className="w-full"
                      busy={busy === "discard"}
                      onClick={() => {
                        if (!confirm(loaded?.state === "draft" && !loaded.isDefault ? "Delete this draft? It has never been published." : "Discard your unpublished changes and go back to the live version?")) return
                        void act("discard", () => discardAction(meta.type, entry!.id, version.current), (r) => {
                          if (r.ok && !r.data) router.push(`/admin/c/${meta.type}`)
                        })
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> {loaded?.state === "draft" && !loaded.isDefault ? "Delete draft" : "Discard changes"}
                    </Btn>
                  )}
                </div>
              )}
              {perms.canPublish && meta.kind === "collection" && (
                <div className="mt-2">
                  {loaded?.state === "hidden" ? (
                    <Btn size="sm" className="w-full" busy={busy === "unhide"} onClick={() => act("unhide", () => unarchiveAction(meta.type, entry!.id, version.current))}>
                      <Eye className="w-3.5 h-3.5" /> Restore to site
                    </Btn>
                  ) : (
                    <Btn
                      size="sm"
                      variant="danger"
                      className="w-full"
                      busy={busy === "hide"}
                      onClick={async () => {
                        if (!confirm(`Hide “${title}” from the site? You can restore it later.`)) return
                        setBusy("hide")
                        const r = await archiveAction(meta.type, entry!.id, version.current)
                        setBusy(null)
                        if (r.ok) router.push(`/admin/c/${meta.type}`)
                        else setSave({ kind: "error", message: r.error })
                      }}
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Hide from site
                    </Btn>
                  )}
                </div>
              )}
            </Card>
            {cov.total > 0 && (
              <Card className="p-4 text-sm">
                <p className="flex items-center gap-1.5 font-medium">
                  <Languages className="w-4 h-4" /> Urdu
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {cov.done} of {cov.total} texts translated{cov.ai ? `, ${cov.ai} by AI and not reviewed yet` : ""}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((cov.done / cov.total) * 100)}%` }} />
                </div>
                {perms.canEdit && !readOnly && (
                  <div className="mt-3 space-y-2">
                    <Btn size="sm" className="w-full" busy={busy === "translate"} disabled={cov.done === cov.total} onClick={() => translate("missing")}>
                      <Sparkles className="w-3.5 h-3.5" /> Translate the rest with AI
                    </Btn>
                    {cov.ai > 0 && (
                      <Btn size="sm" className="w-full" onClick={() => change(approveAll(data) as Data)} title="After reading the Urdu: clears the 'needs review' flags">
                        <Check className="w-3.5 h-3.5" /> Mark AI Urdu as reviewed
                      </Btn>
                    )}
                    <button
                      type="button"
                      disabled={busy === "translate"}
                      onClick={() => confirm("Translate every text again, replacing the current Urdu?") && void translate("all")}
                      className="w-full text-center text-[11px] text-zinc-500 underline-offset-2 hover:underline"
                    >
                      Retranslate everything
                    </button>
                  </div>
                )}
              </Card>
            )}
            <Card className="p-4 text-xs text-zinc-500">
              <p className="mb-1 font-medium text-foreground">How saving works</p>
              Changes save as a draft automatically. The site only changes when you press <b>Publish</b>
              {perms.canPublish ? "" : " (an Editor or Admin does this for you)"}. Use <b>Preview</b> to see the draft on the real page first.
            </Card>
          </div>
        )}
      </div>

      {history && !isNew && (
        <HistoryPanel
          type={meta.type}
          id={entry!.id}
          onClose={() => setHistory(false)}
          canRestore={perms.canEdit && !readOnly}
          onRestore={(seq) =>
            act("restore", () => restoreAction(meta.type, entry!.id, seq, version.current), () => setHistory(false))
          }
        />
      )}
    </div>
  )
}

function SaveIndicator({ save }: { save: SaveState }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 20000)
    return () => clearInterval(id)
  }, [])
  if (save.kind === "saving")
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving…
      </span>
    )
  if (save.kind === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <Check className="w-3 h-3" /> {save.message ?? `Draft saved ${ago(save.at)}`}
      </span>
    )
  if (save.kind === "error") return <span className="text-red-700">{save.message}</span>
  return null
}

function ScheduleForm({ onPick, onCancel, busy }: { onPick: (iso: string) => void; onCancel: () => void; busy: boolean }) {
  const [v, setV] = useState("")
  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 p-2">
      <p className="text-[11px] text-zinc-500">Publish at (Karachi time)</p>
      <input type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs" />
      <div className="flex gap-2">
        <Btn size="sm" variant="primary" className="flex-1" busy={busy} disabled={!v} onClick={() => onPick(new Date(`${v}:00+05:00`).toISOString())}>
          Schedule
        </Btn>
        <Btn size="sm" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}

function HistoryPanel({ type, id, onClose, onRestore, canRestore }: { type: string; id: string; onClose: () => void; onRestore: (seq: number) => void; canRestore: boolean }) {
  const [rows, setRows] = useState<Omit<VersionRow, "data">[] | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    void versionsAction(type, id).then((r) => (r.ok ? setRows(r.data) : setError(r.error)))
  }, [type, id])
  const KIND: Record<string, string> = { saved: "Saved", published: "Published", restored: "Restored", imported: "Imported" }
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">History</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-zinc-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-zinc-500">Every publish and every manual save is kept. Restoring a version puts it back as a draft; publish it to make it live.</p>
        {error && <Notice tone="error">{error}</Notice>}
        {!rows && !error && <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />}
        {rows?.length === 0 && <p className="text-sm text-zinc-500">No versions yet. The built-in content is shown until the first publish.</p>}
        <ol className="space-y-2">
          {rows?.map((v) => (
            <li key={v.seq} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2.5">
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {KIND[v.kind] ?? v.kind} <span className="font-normal text-zinc-400">· v{v.version}</span>
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {when(v.created_at)} · {v.user_name ?? "Someone"}
                  {v.note ? ` · ${v.note}` : ""}
                </p>
              </div>
              {canRestore && (
                <Btn size="sm" onClick={() => onRestore(v.seq)}>
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </Btn>
              )}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}

