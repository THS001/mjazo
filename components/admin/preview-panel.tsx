"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLink, Loader2, Monitor, MousePointerClick, RefreshCw, Smartphone, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { localePath } from "@/lib/i18n"

// The live preview beside an editor: the real page with this entry's draft (Next draft mode), at
// phone or desktop width, in English or Urdu. It refreshes after every save, follows the block being
// edited, and in click-to-edit mode a click on the page opens the field that holds that text.

type Lang = "en" | "ur"
export type Pick = { path: string | null; text: string; lang: Lang }
const DESKTOP = 1280
const PHONE = 390

export function PreviewPanel({ path, saved, onPick, onClose }: { path: string; saved: number; onPick: (p: Pick) => void; onClose: () => void }) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop")
  const [lang, setLang] = useState<Lang>("en")
  const [edit, setEdit] = useState(true)
  const [ready, setReady] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [nonce, setNonce] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const editRef = useRef(edit)
  editRef.current = edit

  const post = (msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(msg, location.origin)
  const src = `/api/cms/preview?path=${encodeURIComponent(localePath(path, lang))}`

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Messages from the page in the frame.
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return
      if (e.data?.type === "cms:ready") {
        setReady(true)
        post({ type: "cms:mode", edit: editRef.current })
      } else if (e.data?.type === "cms:pick") pickRef.current({ path: e.data.path ?? null, text: String(e.data.text ?? ""), lang: e.data.lang === "ur" ? "ur" : "en" })
    }
    window.addEventListener("message", h)
    return () => window.removeEventListener("message", h)
  }, [])

  // Follow the block being edited.
  useEffect(() => {
    const h = (e: Event) => post({ type: "cms:scroll", path: (e as CustomEvent<string>).detail })
    window.addEventListener("cms:focus-block", h)
    return () => window.removeEventListener("cms:focus-block", h)
  }, [])

  // Show each save (the draft is on the server by then).
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    post({ type: "cms:refresh" })
  }, [saved])

  useEffect(() => post({ type: "cms:mode", edit }), [edit])
  useEffect(() => setReady(false), [src, nonce])

  const scale = device === "desktop" && size.w ? Math.min(1, size.w / DESKTOP) : 1
  const seg = (on: boolean) => cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition-colors", on ? "bg-foreground text-background" : "text-zinc-600 hover:text-foreground")

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2">
        <div className="inline-flex rounded-full border border-zinc-200 p-0.5">
          <button type="button" className={seg(device === "desktop")} onClick={() => setDevice("desktop")} title="Desktop width">
            <Monitor className="h-3.5 w-3.5" /> Desktop
          </button>
          <button type="button" className={seg(device === "phone")} onClick={() => setDevice("phone")} title="Phone width">
            <Smartphone className="h-3.5 w-3.5" /> Phone
          </button>
        </div>
        <div className="inline-flex rounded-full border border-zinc-200 p-0.5">
          <button type="button" className={seg(lang === "en")} onClick={() => setLang("en")}>
            English
          </button>
          <button type="button" className={seg(lang === "ur")} onClick={() => setLang("ur")}>
            اردو
          </button>
        </div>
        <button type="button" onClick={() => setEdit((x) => !x)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs", edit ? "border-brand bg-brand-soft text-brand-ink" : "border-zinc-200 text-zinc-600")} title="Click text on the page to edit it. Off: links and buttons work as normal.">
          <MousePointerClick className="h-3.5 w-3.5" /> Click to edit {edit ? "on" : "off"}
        </button>
        <span className="ms-auto flex items-center gap-0.5">
          <button type="button" onClick={() => setNonce((n) => n + 1)} className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-foreground" title="Reload" aria-label="Reload the preview">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <a href={src} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-foreground" title="Open in a new tab" aria-label="Open the preview in a new tab">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-foreground" title="Close the preview" aria-label="Close the preview">
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>
      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden bg-[#F4F4F2]">
        {!ready && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#F4F4F2]/70">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        )}
        {size.w > 0 &&
          (device === "desktop" ? (
            <iframe
              key={`${src}#${nonce}`}
              ref={frame}
              src={src}
              title="Live preview"
              className="absolute left-0 top-0 origin-top-left border-0 bg-white"
              style={{ width: DESKTOP, height: size.h / scale, transform: `scale(${scale})` }}
            />
          ) : (
            <div className="flex h-full justify-center overflow-hidden py-4">
              <iframe key={`${src}#${nonce}`} ref={frame} src={src} title="Live preview" className="h-full rounded-[1.75rem] border-[6px] border-foreground bg-white shadow-xl" style={{ width: PHONE + 12 }} />
            </div>
          ))}
      </div>
      <p className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500">{edit ? "Click any text on the page to jump to its field. The preview updates after each autosave." : "Click to edit is off: the page works as normal."}</p>
    </div>
  )
}
