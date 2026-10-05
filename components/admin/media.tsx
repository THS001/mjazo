"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Box, Check, Copy, FileText, Film, ImageIcon, Loader2, Replace, Search, Sparkles, Trash2, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MediaKind, MediaRow } from "@/lib/cms/media"
import type { Localized, MediaRef } from "@/lib/cms/fields"
import { deleteMediaAction, finishUploadAction, listMediaAction, mediaUsageAction, prepareUploadAction, replaceMediaAction, suggestAltAction, updateMediaAction } from "@/app/(staff)/admin/media-actions"
import { browserSupabase } from "./supabase-browser"
import { Btn, Notice } from "./ui"

// The media library: drag-and-drop uploads, alt text (with an AI suggestion), focal point, tags,
// "where used", replace and delete. Also used as the picker behind every image field.

const inputCls = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-foreground disabled:bg-zinc-50"
const ACCEPT: Record<MediaKind | "any", string> = {
  image: "image/jpeg,image/png,image/webp,image/avif,image/gif",
  video: "video/mp4,video/webm",
  model: ".glb,model/gltf-binary",
  file: "application/pdf",
  any: "image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,.glb,model/gltf-binary,application/pdf",
}
const KIND_LABEL: Record<MediaKind, string> = { image: "Images", video: "Videos", model: "3D models", file: "PDFs" }
export const fileName = (p: string) => p.split("/").pop()!.replace(/^[a-z0-9]+-/, "")
const mb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

// ---------------------------------------------------------------------------
// Uploading
// ---------------------------------------------------------------------------

/** Width, height and an average colour (placeholder while the image loads), measured in the browser. */
async function measure(file: File): Promise<{ width?: number; height?: number; color?: string }> {
  try {
    if (file.type.startsWith("image/")) {
      const bmp = await createImageBitmap(file)
      const c = document.createElement("canvas")
      c.width = c.height = 8
      const g = c.getContext("2d")!
      // Transparent parts count as the light page behind them, not black (logos would vanish on their placeholder).
      g.fillStyle = "#fff"
      g.fillRect(0, 0, 8, 8)
      g.drawImage(bmp, 0, 0, 8, 8)
      const d = g.getImageData(0, 0, 8, 8).data
      let r = 0, gr = 0, b = 0
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]
        gr += d[i + 1]
        b += d[i + 2]
      }
      const hex = (n: number) => Math.round(n / 64).toString(16).padStart(2, "0")
      return { width: bmp.width, height: bmp.height, color: `#${hex(r)}${hex(gr)}${hex(b)}` }
    }
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video")
      v.preload = "metadata"
      v.src = URL.createObjectURL(file)
      const dims = await new Promise<{ width?: number; height?: number }>((res) => {
        v.onloadedmetadata = () => res({ width: v.videoWidth, height: v.videoHeight })
        v.onerror = () => res({})
        setTimeout(() => res({}), 4000)
      })
      URL.revokeObjectURL(v.src)
      return dims
    }
  } catch {}
  return {}
}

/** Uploads one file (to Supabase Storage directly, or the local dev route) and records it. */
export async function uploadFile(file: File, replaceId?: string): Promise<MediaRow> {
  const prep = await prepareUploadAction({ name: file.name, mime: file.type, size: file.size })
  if (!prep.ok) throw new Error(prep.error)
  const p = prep.data
  const meta = await measure(file)
  if (p.mode === "supabase") {
    const sb = browserSupabase()
    if (!sb) throw new Error("Supabase isn't configured in the browser (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).")
    const { error } = await sb.storage.from("media").uploadToSignedUrl(p.path, p.token, file, { contentType: p.mime })
    if (error) throw new Error(`Upload failed: ${error.message}`)
  } else {
    const res = await fetch(p.url, { method: "POST", body: file })
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed.")
  }
  const done = replaceId ? await replaceMediaAction(replaceId, { path: p.path, mime: p.mime, ...meta }) : await finishUploadAction({ id: p.id, path: p.path, mime: p.mime, ...meta })
  if (!done.ok) throw new Error(done.error)
  return done.data
}

type Job = { key: string; name: string; state: "uploading" | "done" | "error"; error?: string }

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

export function MediaThumb({ row, className }: { row: Pick<MediaRow, "kind" | "url" | "color" | "path"> & { alt?: Localized | null }; className?: string }) {
  if (row.kind === "image")
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={row.url} alt={row.alt?.en ?? ""} loading="lazy" className={cn("h-full w-full object-cover", className)} style={{ background: row.color ?? "#f4f4f5" }} />
  const Icon = row.kind === "video" ? Film : row.kind === "model" ? Box : FileText
  return (
    <div className={cn("grid h-full w-full place-items-center bg-zinc-100 text-zinc-500", className)}>
      <div className="flex flex-col items-center gap-1 px-2 text-center">
        <Icon className="h-7 w-7" strokeWidth={1.5} />
        <span className="line-clamp-2 break-all text-[10px]">{fileName(row.path)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export function MediaLibrary({ mode, accept, onPick, canEdit, canDelete }: { mode: "manage" | "pick"; accept?: MediaKind; onPick?: (row: MediaRow) => void; canEdit: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<MediaRow[] | null>(null)
  const [error, setError] = useState("")
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<MediaKind | "all">(accept ?? "all")
  const [selected, setSelected] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await listMediaAction()
    if (r.ok) setRows(r.data)
    else setError(r.error)
  }, [])
  useEffect(() => void load(), [load])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? []).filter((r) => (kind === "all" || r.kind === kind) && (!needle || `${fileName(r.path)} ${r.alt?.en ?? ""} ${r.tags.join(" ")}`.toLowerCase().includes(needle)))
  }, [rows, q, kind])

  const upload = async (files: FileList | File[]) => {
    const list = [...files]
    for (const file of list) {
      const key = `${file.name}-${Math.random()}`
      setJobs((j) => [{ key, name: file.name, state: "uploading" }, ...j])
      try {
        const row = await uploadFile(file)
        setRows((r) => [row, ...(r ?? [])])
        setJobs((j) => j.map((x) => (x.key === key ? { ...x, state: "done" } : x)))
        if (list.length === 1) setSelected(row.id)
      } catch (e) {
        setJobs((j) => j.map((x) => (x.key === key ? { ...x, state: "error", error: e instanceof Error ? e.message : "Upload failed." } : x)))
      }
    }
    setTimeout(() => setJobs((j) => j.filter((x) => x.state !== "done")), 2500)
  }

  const current = rows?.find((r) => r.id === selected) ?? null
  const kinds: (MediaKind | "all")[] = accept ? [accept] : ["all", "image", "video", "model", "file"]

  return (
    <div
      className={cn("relative", drag && "after:pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:border-2 after:border-dashed after:border-brand after:bg-brand-soft/40")}
      onDragOver={(e) => {
        if (!canEdit) return
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setDrag(false)
      }}
      onDrop={(e) => {
        if (!canEdit) return
        e.preventDefault()
        setDrag(false)
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
      }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, alt text or tag" className={cn(inputCls, "pl-9")} />
        </div>
        {kinds.length > 1 && (
          <div className="flex rounded-full border border-zinc-300 bg-white p-0.5 text-xs">
            {kinds.map((k) => (
              <button key={k} onClick={() => setKind(k)} className={cn("rounded-full px-3 py-1.5", kind === k ? "bg-foreground text-background" : "text-zinc-600 hover:text-foreground")}>
                {k === "all" ? "All" : KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        {canEdit && (
          <>
            <input ref={input} type="file" multiple accept={ACCEPT[accept ?? "any"]} className="hidden" onChange={(e) => e.target.files && void upload(e.target.files).then(() => (e.target.value = ""))} />
            <Btn variant="primary" onClick={() => input.current?.click()}>
              <Upload className="h-4 w-4" /> Upload
            </Btn>
          </>
        )}
      </div>

      {jobs.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {jobs.map((j) => (
            <li key={j.key} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-xs", j.state === "error" ? "bg-red-50 text-red-800" : "bg-white")}>
              {j.state === "uploading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : j.state === "done" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5" />}
              <span className="truncate font-medium">{j.name}</span>
              {j.error && <span className="truncate">· {j.error}</span>}
            </li>
          ))}
        </ul>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {!rows && !error && <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />}
      {rows && rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          <ImageIcon className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
          {canEdit ? "No files yet. Drop images, videos or GLB models here, or press Upload." : "No files yet."}
          <p className="mt-1 text-xs">JPG, PNG, WebP, AVIF and GIF up to 10 MB · MP4 and WebM up to 50 MB · GLB up to 25 MB · PDF up to 10 MB</p>
        </div>
      )}

      <div className={cn("grid gap-6", mode === "manage" && current && "lg:grid-cols-[1fr_340px]")}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
          {shown.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => (mode === "pick" ? onPick?.(r) : setSelected(r.id === selected ? null : r.id))}
              className={cn("group relative aspect-square overflow-hidden rounded-xl border bg-white text-left transition", selected === r.id ? "border-foreground ring-2 ring-foreground" : "border-zinc-200 hover:border-zinc-400")}
              title={fileName(r.path)}
            >
              <MediaThumb row={r} />
              {r.kind === "image" && !r.alt?.en && <span className="absolute bottom-1 left-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-900">No alt text</span>}
            </button>
          ))}
        </div>
        {mode === "manage" && current && (
          <MediaDetail
            key={current.id}
            row={current}
            canEdit={canEdit}
            canDelete={canDelete}
            onChange={(r) => setRows((all) => (all ?? []).map((x) => (x.id === r.id ? r : x)))}
            onDeleted={() => {
              setRows((all) => (all ?? []).filter((x) => x.id !== current.id))
              setSelected(null)
            }}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

type Usage = { type: string; id: string; where: string; label: string; title: string; href: string }

export function MediaDetail({ row, canEdit, canDelete, onChange, onDeleted, onClose }: { row: MediaRow; canEdit: boolean; canDelete: boolean; onChange: (r: MediaRow) => void; onDeleted: () => void; onClose: () => void }) {
  const [alt, setAlt] = useState<Localized>(row.alt ?? { en: "" })
  const [tags, setTags] = useState(row.tags.join(", "))
  const [focal, setFocal] = useState<[number, number] | null>(row.focal)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null)
  const [usage, setUsage] = useState<Usage[] | null>(null)
  const [copied, setCopied] = useState(false)
  const replaceInput = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(alt) !== JSON.stringify(row.alt ?? { en: "" }) || tags !== row.tags.join(", ") || JSON.stringify(focal) !== JSON.stringify(row.focal)

  useEffect(() => {
    void mediaUsageAction(row.id).then((r) => setUsage(r.ok ? r.data : []))
  }, [row.id])

  const save = async () => {
    setBusy("save")
    const r = await updateMediaAction(row.id, { alt: alt.en || alt.ur ? alt : null, tags: tags.split(","), focal })
    setBusy(null)
    if (r.ok) {
      onChange(r.data)
      setMsg({ tone: "info", text: "Saved. Pages using this file update on their next visit." })
    } else setMsg({ tone: "error", text: r.error })
  }
  const suggest = async () => {
    setBusy("ai")
    const r = await suggestAltAction(row.id)
    setBusy(null)
    if (r.ok) setAlt(r.data)
    else setMsg({ tone: "error", text: r.error })
  }
  const replace = async (file: File) => {
    setBusy("replace")
    try {
      onChange(await uploadFile(file, row.id))
      setMsg({ tone: "info", text: "Replaced. Every page using it now shows the new file." })
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Replace failed." })
    }
    setBusy(null)
  }
  const remove = async () => {
    if (!confirm(`Delete ${fileName(row.path)} for good?`)) return
    setBusy("delete")
    const r = await deleteMediaAction(row.id)
    setBusy(null)
    if (r.ok) onDeleted()
    else setMsg({ tone: "error", text: r.error })
  }

  return (
    <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-start justify-between gap-2">
        <p className="break-all text-sm font-medium">{fileName(row.path)}</p>
        <button onClick={onClose} className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-zinc-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {row.kind === "image" ? (
        <div>
          <div
            className={cn("relative overflow-hidden rounded-xl bg-zinc-100", canEdit && "cursor-crosshair")}
            onClick={(e) => {
              if (!canEdit) return
              const b = e.currentTarget.getBoundingClientRect()
              setFocal([Number(((e.clientX - b.left) / b.width).toFixed(3)), Number(((e.clientY - b.top) / b.height).toFixed(3))])
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.url} alt="" className="block w-full" />
            {focal && <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.5)]" style={{ left: `${focal[0] * 100}%`, top: `${focal[1] * 100}%` }} />}
          </div>
          {canEdit && <p className="mt-1 text-[11px] text-zinc-500">Click the most important spot. Crops keep it in view. {focal && <button className="underline" onClick={() => setFocal(null)}>Reset</button>}</p>}
        </div>
      ) : row.kind === "video" ? (
        <video src={row.url} controls muted className="w-full rounded-xl bg-black" />
      ) : (
        <div className="aspect-video overflow-hidden rounded-xl">
          <MediaThumb row={row} />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-500">
        <dt>Type</dt>
        <dd className="text-right">{row.mime}</dd>
        <dt>Size</dt>
        <dd className="text-right">{mb(row.size)}</dd>
        {row.width && (
          <>
            <dt>Dimensions</dt>
            <dd className="text-right">
              {row.width} × {row.height}
            </dd>
          </>
        )}
        <dt>Uploaded</dt>
        <dd className="text-right">
          {new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          {row.uploaded_by ? ` · ${row.uploaded_by}` : ""}
        </dd>
      </dl>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(new URL(row.url, location.href).href)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:border-zinc-400"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy link"}
      </button>

      {row.kind === "image" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Alt text</span>
            {canEdit && (
              <button onClick={suggest} disabled={busy === "ai"} className="inline-flex items-center gap-1 text-[11px] text-violet-700 hover:text-violet-900 disabled:opacity-50">
                {busy === "ai" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Suggest with AI
              </button>
            )}
          </div>
          <textarea rows={2} value={alt.en} disabled={!canEdit} onChange={(e) => setAlt({ ...alt, en: e.target.value, ai: false })} placeholder="What does the image show?" className={cn(inputCls, "resize-none")} />
          <textarea rows={2} value={alt.ur ?? ""} disabled={!canEdit} onChange={(e) => setAlt({ ...alt, ur: e.target.value, ai: false })} placeholder="اردو" dir="rtl" lang="ur" className={cn(inputCls, "resize-none font-urdu leading-loose")} />
          {alt.ai && <p className="text-[11px] text-violet-700">Written by AI. Check it before saving.</p>}
        </div>
      )}
      <div>
        <span className="text-[13px] font-medium">Tags</span>
        <input value={tags} disabled={!canEdit} onChange={(e) => setTags(e.target.value)} placeholder="salon, hero, eid" className={cn(inputCls, "mt-1")} />
      </div>
      {canEdit && (
        <Btn variant="primary" className="w-full" busy={busy === "save"} disabled={!dirty} onClick={save}>
          Save details
        </Btn>
      )}
      {msg && <Notice tone={msg.tone === "error" ? "error" : undefined}>{msg.text}</Notice>}

      <div>
        <p className="text-[13px] font-medium">Where it's used</p>
        {!usage ? (
          <Loader2 className="mt-1 h-4 w-4 animate-spin text-zinc-400" />
        ) : usage.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">Not used anywhere yet.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs">
            {usage.map((u) => (
              <li key={`${u.type}/${u.id}`}>
                <Link href={u.href} className="hover:underline">
                  {u.label}: {u.title}
                </Link>{" "}
                <span className="text-zinc-400">({u.where === "draft" ? "draft only" : u.where === "both" ? "live + draft" : "live"})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <div className="flex gap-2 border-t border-zinc-100 pt-3">
          <input ref={replaceInput} type="file" accept={ACCEPT[row.kind]} className="hidden" onChange={(e) => e.target.files?.[0] && void replace(e.target.files[0])} />
          <Btn size="sm" className="flex-1" busy={busy === "replace"} onClick={() => replaceInput.current?.click()}>
            <Replace className="h-3.5 w-3.5" /> Replace file
          </Btn>
          {canDelete && (
            <Btn size="sm" variant="danger" busy={busy === "delete"} disabled={!usage || usage.length > 0} onClick={remove} title={usage?.length ? "Remove it from the pages that use it first" : undefined}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Btn>
          )}
        </div>
      )}
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Picker (image fields)
// ---------------------------------------------------------------------------

export function MediaPicker({ accept, onPick, onClose, canEdit }: { accept: MediaKind; onPick: (row: MediaRow) => void; onClose: () => void; canEdit: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-[#F4F4F2] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Choose {accept === "image" ? "an image" : accept === "video" ? "a video" : accept === "model" ? "a 3D model" : "a file"}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <MediaLibrary mode="pick" accept={accept} onPick={onPick} canEdit={canEdit} canDelete={false} />
      </div>
    </div>
  )
}

/** The form control for an image / video / model field. */
export function MediaInput({ value, onChange, accept = "image", disabled, canUpload, showUr }: { value: MediaRef | null | undefined; onChange: (v: MediaRef | null) => void; accept?: "image" | "video" | "model"; disabled?: boolean; canUpload: boolean; showUr: boolean }) {
  const [open, setOpen] = useState(false)
  const [altOpen, setAltOpen] = useState(Boolean(value?.alt?.en))
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-2">
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
          {value ? <MediaThumb row={{ kind: accept === "image" ? "image" : accept, url: value.url, color: null, path: value.url }} /> : <div className="grid h-full place-items-center text-zinc-300">{accept === "video" ? <Film className="h-6 w-6" /> : accept === "model" ? <Box className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}</div>}
        </div>
        <div className="min-w-0 flex-1 text-xs text-zinc-500">
          {value ? <p className="truncate">{fileName(value.url)}</p> : <p>Nothing chosen: the page shows its built-in design.</p>}
          {!disabled && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Btn size="sm" onClick={() => setOpen(true)}>
                {value ? "Change" : "Choose"}
              </Btn>
              {value && (
                <Btn size="sm" variant="ghost" onClick={() => onChange(null)}>
                  Remove
                </Btn>
              )}
              {value && accept === "image" && (
                <button type="button" onClick={() => setAltOpen((o) => !o)} className="text-[11px] text-zinc-500 underline-offset-2 hover:underline">
                  Alt text for this use
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {value && altOpen && accept === "image" && (
        <div className={cn("mt-2 grid gap-2", showUr && "sm:grid-cols-2")}>
          <input value={value.alt?.en ?? ""} disabled={disabled} onChange={(e) => onChange({ ...value, alt: { ...(value.alt ?? { en: "" }), en: e.target.value } })} placeholder="Leave empty to use the library's alt text" className={inputCls} />
          {showUr && <input value={value.alt?.ur ?? ""} disabled={disabled} onChange={(e) => onChange({ ...value, alt: { ...(value.alt ?? { en: "" }), ur: e.target.value } })} placeholder="اردو" dir="rtl" className={cn(inputCls, "font-urdu")} />}
        </div>
      )}
      {open && (
        <MediaPicker
          accept={accept}
          canEdit={canUpload}
          onClose={() => setOpen(false)}
          onPick={(row) => {
            onChange({ id: row.id, url: row.url, ...(value?.alt ? { alt: value.alt } : {}) })
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}
