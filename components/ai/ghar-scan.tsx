"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, Camera, Check, ClipboardCheck, ImagePlus, Loader2, MessageCircle, RotateCcw, Send, Sparkles, Video, Wrench, X } from "lucide-react"
import { formatDuration, formatPKR } from "@/lib/catalog"
import { track } from "@/lib/site"
import { useCart } from "@/lib/store"
import { saveBrief, thumb } from "@/lib/client/brief"
import { cn } from "@/lib/utils"
import { EASE } from "@/components/site/primitives"

type Rec = { category: string; categoryName: string; service: string; name: string; why: string; options: string[]; price: number; range: { min: number; max: number; label: string } | null; duration: number; hasOptions: boolean; url: string; history: { jobs: number; low: number; high: number } | null }
type Pin = { photo: number; x: number; y: number; label: string }
type Result = {
  mode: "home" | "beauty"
  summary: string
  title: string
  confidence: "high" | "medium" | "low"
  score: number
  videoCheck: boolean
  pins: Pin[]
  techBrief: string
  checkNow: string[]
  causes: string[]
  urgent: boolean
  safety: string
  parts: string[]
  brief: string
  questions: string[]
  recommendations: Rec[]
  whatsapp: string
}

const EXAMPLES = {
  home: ["AC dripping water", "Damp or peeling wall", "Termite trail on wood", "Fridge, AC or washing-machine error code", "Leaking pipe or tap", "Sparking switch or tripping breaker", "Stained sofa or carpet"],
  beauty: ["A party makeup look", "A mehndi design", "A hair colour or cut", "Nail art", "Brows you love"],
}
const MAX_ROUNDS = 2

async function shrink(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const s = Math.min(1, 1280 / Math.max(img.width, img.height))
    const c = document.createElement("canvas")
    c.width = Math.round(img.width * s)
    c.height = Math.round(img.height * s)
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL("image/jpeg", 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

const CONF = { high: { label: "Confident", cls: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" }, medium: { label: "Fairly sure", cls: "bg-amber-100 text-amber-800", bar: "bg-amber-500" }, low: { label: "Not sure", cls: "bg-zinc-200 text-zinc-700", bar: "bg-zinc-400" } }

export function GharScan() {
  const [mode, setMode] = useState<"home" | "beauty">("home")
  const [photos, setPhotos] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<{ text: string; whatsapp?: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<{ q: string; a: string }[]>([])
  const [round, setRound] = useState(0)
  const [activePin, setActivePin] = useState<number | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const add = useCart((s) => s.add)

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    const shrunk = await Promise.all(Array.from(files).slice(0, 3 - photos.length).map(shrink))
    setPhotos((p) => [...p, ...shrunk].slice(0, 3))
    setResult(null)
    setError(null)
    setHistory([])
    setRound(0)
  }

  const scan = async (followUp = false) => {
    if (!photos.length || busy) return
    const qa = followUp && result ? [...history, ...result.questions.map((q) => ({ q, a: (answers[q] ?? "").trim() })).filter((x) => x.a)] : []
    setBusy(true)
    setError(null)
    if (!followUp) setResult(null)
    track(followUp ? "ghar_scan_followup" : "ghar_scan", { mode, photos: photos.length, answers: qa.length })
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, note, answers: qa, images: photos.map((p) => p.split(",")[1]) }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError({ text: data.error === "ai_unavailable" ? "Ghar Scan is taking a break right now. Send the photos to our team on WhatsApp and they'll quote you." : data.error ?? "Something went wrong. Please try again.", whatsapp: data.whatsapp })
        return
      }
      setResult(data)
      setHistory(qa)
      setAnswers({})
      setRound(followUp ? round + 1 : 0)
      setSaved(false)
      track("ghar_scan_result", { mode, confidence: data.confidence, score: data.score, recs: data.recommendations.length })
    } catch {
      setError({ text: "We couldn't reach the server. Check your connection and try again." })
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPhotos([])
    setNote("")
    setResult(null)
    setError(null)
    setSaved(false)
    setAdded([])
    setAnswers({})
    setHistory([])
    setRound(0)
  }

  /** The brief travels with the next booking: text in the booking, photos to the pro until the visit is done. */
  const keepBrief = async (r: Result) => {
    const small = await Promise.all(photos.map((p) => thumb(p)))
    const ok = saveBrief({
      kind: r.mode === "home" ? "scan" : "look",
      title: r.title,
      text: r.mode === "home" ? [r.summary, r.techBrief].filter(Boolean).join(" ") : r.brief || r.summary,
      causes: r.causes,
      parts: r.parts,
      pins: r.pins,
      photos: small,
      categories: [...new Set(r.recommendations.map((x) => x.category))],
    })
    if (ok) {
      setSaved(true)
      track("brief_saved", { kind: r.mode })
    }
  }

  const answeredCount = result ? result.questions.filter((q) => (answers[q] ?? "").trim()).length : 0
  const pinsFor = (i: number) => (result?.pins ?? []).map((p, k) => ({ ...p, n: k + 1 })).filter((p) => p.photo === i)

  return (
    <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 items-start">
      {/* Viewfinder */}
      <div className="space-y-4 min-w-0">
        <div className="inline-flex rounded-full bg-white/10 p-1" role="group" aria-label="What are you scanning?">
          {(["home", "beauty"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setResult(null)
                setHistory([])
                setRound(0)
              }}
              aria-pressed={mode === m}
              className={cn("h-10 px-5 rounded-full text-sm transition-colors", mode === m ? "bg-brand text-black" : "text-white/70 hover:text-white")}
            >
              {m === "home" ? "A problem at home" : "A beauty look"}
            </button>
          ))}
        </div>

        <div
          className="relative aspect-[4/3] rounded-[2rem] bg-white/[0.04] border border-white/10 overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pick(e.dataTransfer.files)
          }}
        >
          {["top-4 left-4 border-l-2 border-t-2 rounded-tl-xl", "top-4 right-4 border-r-2 border-t-2 rounded-tr-xl", "bottom-4 left-4 border-l-2 border-b-2 rounded-bl-xl", "bottom-4 right-4 border-r-2 border-b-2 rounded-br-xl"].map((c) => (
            <span key={c} aria-hidden className={cn("absolute w-8 h-8 border-brand z-10 pointer-events-none", c)} />
          ))}
          {photos.length ? (
            <div className={cn("absolute inset-0 grid gap-1 p-1", photos.length === 1 ? "grid-cols-1" : photos.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
              {photos.map((p, i) => (
                <div key={i} className="relative overflow-hidden rounded-[1.6rem]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  {/* Problem pins (positions are the AI's estimate) */}
                  {!busy &&
                    pinsFor(i).map((pin) => (
                      <motion.button
                        key={pin.n}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 + pin.n * 0.12, type: "spring", damping: 12 }}
                        onClick={() => setActivePin(activePin === pin.n ? null : pin.n)}
                        className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                        aria-label={`Marker ${pin.n}: ${pin.label}`}
                      >
                        <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-60" />
                        <span className="relative w-7 h-7 rounded-full bg-brand text-black text-xs font-bold flex items-center justify-center ring-2 ring-black/40">{pin.n}</span>
                        {activePin === pin.n && <span className="absolute left-1/2 -translate-x-1/2 top-9 whitespace-nowrap rounded-full bg-black/85 text-white text-xs px-3 py-1">{pin.label}</span>}
                      </motion.button>
                    ))}
                  {!busy && (
                    <button onClick={() => setPhotos((ph) => ph.filter((_, j) => j !== i))} className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center" aria-label="Remove photo">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => file.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80 hover:text-white">
              <span className="w-16 h-16 rounded-full bg-brand text-black flex items-center justify-center">
                <Camera className="w-7 h-7" />
              </span>
              <span className="font-medium px-6 text-center">{mode === "home" ? "Take or upload 2–3 photos of the problem" : "Upload a photo of the look you want"}</span>
              <span className="text-xs text-white/50">{mode === "home" ? "A close-up, a wider shot, and any label or error code" : "Up to 3 photos · drag and drop works too"}</span>
            </button>
          )}
          <AnimatePresence>
            {busy && (
              <motion.div className="absolute inset-0 z-10 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black/30" />
                <motion.div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-brand/45 to-transparent" initial={{ top: "-20%" }} animate={{ top: ["-20%", "100%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
                <p className="absolute bottom-5 inset-x-0 text-center text-sm text-white flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {round > 0 || answeredCount ? "Updating the diagnosis…" : "Reading your photos…"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={file}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            pick(e.target.files)
            e.target.value = ""
          }}
        />
        <div className="flex flex-wrap gap-2">
          {photos.length > 0 && photos.length < 3 && !busy && (
            <button onClick={() => file.current?.click()} className="h-10 px-4 rounded-full border border-white/20 text-white/80 text-sm flex items-center gap-2 hover:border-white">
              <ImagePlus className="w-4 h-4" />
              Add another angle
            </button>
          )}
          {(photos.length > 0 || result) && !busy && (
            <button onClick={reset} className="h-10 px-4 rounded-full border border-white/20 text-white/80 text-sm flex items-center gap-2 hover:border-white">
              <RotateCcw className="w-4 h-4" />
              Start over
            </button>
          )}
        </div>

        <label className="block">
          <span className="sr-only">Anything we should know?</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            dir="auto"
            placeholder={mode === "home" ? "Anything to add? e.g. ‘AC 2 din se pani gira raha hai, Haier inverter’" : "Anything to add? e.g. ‘for my cousin's mehndi, softer colours’"}
            className="w-full rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder:text-white/40 px-4 py-3 text-[16px] sm:text-sm outline-none focus:border-brand"
          />
        </label>
        <button onClick={() => scan(false)} disabled={!photos.length || busy} className="w-full h-14 rounded-full bg-brand text-black font-medium flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-white transition-colors">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {busy ? "Scanning" : result ? "Scan again" : mode === "home" ? "Scan the problem" : "Read the look"}
        </button>
        <p className="text-xs text-white/50">AI suggestion, not a final quote: your pro confirms the price before any work starts. Photos aren&apos;t stored unless you send them to your technician with a booking, and those are deleted after the visit.</p>
      </div>

      {/* Result */}
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div key="err" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[2rem] bg-white p-7 text-foreground">
              <p className="font-serif text-2xl">We couldn&apos;t scan that one</p>
              <p className="text-zinc-600 mt-2">{error.text}</p>
              {error.whatsapp && (
                <a href={error.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex mt-5 h-11 items-center gap-2 rounded-full bg-[#25D366] text-foreground px-5 text-sm">
                  <MessageCircle className="w-4 h-4" />
                  Send photos on WhatsApp
                </a>
              )}
            </motion.div>
          ) : result ? (
            <motion.div key={`res-${round}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="space-y-4">
              <div className="rounded-[2rem] bg-white p-6 sm:p-7 text-foreground">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={cn("text-xs rounded-full px-2.5 py-1 font-medium", CONF[result.confidence].cls)}>{CONF[result.confidence].label}</span>
                  {result.urgent && <span className="text-xs rounded-full px-2.5 py-1 font-medium bg-red-100 text-red-700">See to it soon</span>}
                  {round > 0 && <span className="text-xs rounded-full px-2.5 py-1 font-medium bg-brand-soft text-brand-ink">Updated with your answers</span>}
                </div>
                <h2 className="font-serif text-3xl leading-tight" dir="auto">
                  {result.title}
                </h2>
                <div className="mt-3 flex items-center gap-3" aria-label={`Confidence ${result.score} out of 100`}>
                  <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <motion.div className={cn("h-full rounded-full", CONF[result.confidence].bar)} initial={{ width: 0 }} animate={{ width: `${result.score}%` }} transition={{ duration: 0.8, ease: EASE }} />
                  </div>
                  <span className="text-xs text-zinc-500 tabular-nums">{result.score}% sure</span>
                </div>
                <p className="text-zinc-600 mt-3" dir="auto">
                  {result.summary}
                </p>
                {result.safety && (
                  <p className="mt-4 flex gap-2 rounded-2xl bg-red-50 text-red-800 p-3 text-sm" dir="auto">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {result.safety}
                  </p>
                )}
                {result.pins.length > 0 && (
                  <ol className="mt-4 flex flex-wrap gap-2">
                    {result.pins.map((p, i) => (
                      <li key={i}>
                        <button onClick={() => setActivePin(activePin === i + 1 ? null : i + 1)} className={cn("text-xs rounded-full px-3 py-1.5 flex items-center gap-1.5 border", activePin === i + 1 ? "bg-black text-white border-black" : "border-zinc-200")}>
                          <span className="w-4 h-4 rounded-full bg-brand text-black text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          {p.label}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                {result.causes.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-500 mb-2">Likely causes</p>
                    <ol className="space-y-1.5 text-sm list-decimal pl-5" dir="auto">
                      {result.causes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {result.checkNow.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-500 mb-2">Worth checking now</p>
                    <ul className="space-y-1.5 text-sm" dir="auto">
                      {result.checkNow.map((c) => (
                        <li key={c} className="flex gap-2">
                          <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.mode === "beauty" && result.brief && (
                  <div className="mt-5 rounded-2xl bg-brand-soft p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-brand-ink mb-1">Look Card · for your pro</p>
                    <p className="text-sm" dir="auto">
                      {result.brief}
                    </p>
                    <button onClick={() => keepBrief(result)} className="mt-3 h-9 px-4 rounded-full bg-foreground text-background text-sm flex items-center gap-1.5">
                      {saved ? (
                        <>
                          <Check className="w-4 h-4" />
                          Saved to your next booking
                        </>
                      ) : (
                        "Save for my booking"
                      )}
                    </button>
                  </div>
                )}
              </div>

              {result.videoCheck && (
                <div className="rounded-[2rem] bg-[#25D366] text-foreground p-6 sm:p-7">
                  <p className="flex items-center gap-2 font-medium">
                    <Video className="w-5 h-5" /> Photos aren&apos;t enough for this one
                  </p>
                  <p className="text-foreground/75 text-sm mt-1.5">Show it to a Mjazo technician on a free 2-minute WhatsApp video call. They&apos;ll tell you the fix and the price, so nobody makes a wasted trip.</p>
                  <a href={result.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { placement: "ghar_scan_video_check" })} className="inline-flex mt-4 h-11 items-center gap-2 rounded-full bg-white text-black px-5 text-sm font-medium">
                    <MessageCircle className="w-4 h-4" />
                    Start a free video check
                  </a>
                </div>
              )}

              {result.mode === "home" && (result.techBrief || result.parts.length > 0) && (
                <div className="rounded-[2rem] bg-white p-6 sm:p-7 text-foreground">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" /> Brief for your technician
                  </p>
                  {result.techBrief && (
                    <p className="text-sm mt-2" dir="auto">
                      {result.techBrief}
                    </p>
                  )}
                  {result.parts.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-zinc-500 mb-2">Parts to bring, just in case (priced separately, only if needed)</p>
                      <div className="flex flex-wrap gap-2">
                        {result.parts.map((p) => (
                          <span key={p} className="text-xs rounded-full bg-zinc-100 px-3 py-1.5 flex items-center gap-1.5">
                            <Wrench className="w-3 h-3" />
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => keepBrief(result)} className={cn("mt-5 h-10 px-4 rounded-full text-sm flex items-center gap-2", saved ? "bg-brand text-black" : "bg-foreground text-background")}>
                    {saved ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {saved ? "Your technician will get this with your booking" : "Send this to my technician when I book"}
                  </button>
                </div>
              )}

              {result.recommendations.length > 0 && (
                <div className="rounded-[2rem] bg-white p-6 sm:p-7 text-foreground space-y-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">The fix, from the Mjazo menu</p>
                  {result.recommendations.map((r) => (
                    <div key={r.service} className="rounded-2xl border border-zinc-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-500">{r.categoryName}</p>
                        <Link href={r.url} className="font-medium hover:underline">
                          {r.name}
                        </Link>
                        <p className="text-sm text-zinc-600 mt-0.5" dir="auto">
                          {r.why}
                        </p>
                        <p className="text-sm mt-1">
                          <span className="font-medium">{r.range ? r.range.label : "Free inspection + quote"}</span>
                          <span className="text-zinc-500"> · {formatDuration(r.duration)}</span>
                        </p>
                        {r.history && (
                          <p className="text-xs text-emerald-700 mt-1">
                            From {r.history.jobs} recent Mjazo jobs: most paid {r.history.low === r.history.high ? formatPKR(r.history.low) : `${formatPKR(r.history.low)} – ${formatPKR(r.history.high)}`}
                          </p>
                        )}
                      </div>
                      {r.price > 0 && !r.hasOptions ? (
                        <button
                          onClick={() => {
                            add({ category: r.category, categoryName: r.categoryName, service: r.service, name: r.name, options: [], addOns: [], unitPrice: r.price, duration: r.duration })
                            setAdded((a) => [...a, r.service])
                            if (!saved) keepBrief(result)
                            track("add_to_cart", { source: "ghar_scan", service: r.service })
                          }}
                          className={cn("h-10 px-4 rounded-full text-sm shrink-0", added.includes(r.service) ? "bg-brand text-black" : "bg-foreground text-background")}
                        >
                          {added.includes(r.service) ? "Added" : `Add · ${formatPKR(r.price)}`}
                        </button>
                      ) : (
                        <Link href={r.url} onClick={() => !saved && keepBrief(result)} className="h-10 px-4 rounded-full bg-foreground text-background text-sm flex items-center shrink-0">
                          Choose options
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {result.questions.length > 0 && round < MAX_ROUNDS && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    scan(true)
                  }}
                  className="rounded-[2rem] bg-white/[0.06] border border-white/10 p-5 sm:p-6 space-y-3"
                >
                  <p className="text-sm text-white font-medium">Answer to sharpen the diagnosis</p>
                  {result.questions.map((q) => (
                    <label key={q} className="block">
                      <span className="block text-sm text-white/75 mb-1.5" dir="auto">
                        {q}
                      </span>
                      <input
                        value={answers[q] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
                        dir="auto"
                        className="w-full h-11 rounded-2xl bg-white/[0.08] border border-white/15 text-white placeholder:text-white/35 px-4 text-[16px] sm:text-sm outline-none focus:border-brand"
                        placeholder="Your answer"
                      />
                    </label>
                  ))}
                  <button disabled={!answeredCount || busy} className="h-11 px-5 rounded-full bg-brand text-black text-sm font-medium flex items-center gap-2 disabled:opacity-40">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Update diagnosis
                  </button>
                </form>
              )}

              {!result.videoCheck && (
                <a href={result.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] text-foreground px-4 text-sm" onClick={() => track("whatsapp_click", { placement: "ghar_scan" })}>
                  <MessageCircle className="w-4 h-4" />
                  Ask a person to confirm
                </a>
              )}
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-[2rem] bg-white/[0.04] border border-white/10 p-7">
              <p className="text-white/50 text-xs uppercase tracking-[0.15em] mb-4">Works well for</p>
              <ul className="grid sm:grid-cols-2 gap-2">
                {EXAMPLES[mode].map((x) => (
                  <li key={x} className="flex items-center gap-2 text-white/85 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                    {x}
                  </li>
                ))}
              </ul>
              <p className="text-white/50 text-sm mt-6">
                {mode === "home"
                  ? "You'll get the likely issue marked on your photo, the causes, parts and the right service, priced from the Mjazo menu. It asks a question or two when it isn't sure, and your technician arrives already briefed."
                  : "You'll get the look, a brief for your pro and the right services, priced from the Mjazo menu."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
