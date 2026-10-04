"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, Check, Download, Eye, Hand, ImagePlus, Loader2, RotateCw, ShoppingBag, Sparkles, Video, VideoOff } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { track } from "@/lib/site"
import { useCart } from "@/lib/store"
import { saveBrief, thumb } from "@/lib/client/brief"
import { DESIGNS, HENNA, drawDesignOn, renderMehndi, templateHand, type DesignId, type HandPts, type Pt } from "@/lib/glam/mehndi"
import { BLUSH, HAIR, KAJAL, LIPS, NO_MAKEUP, drawHair, drawMakeup, type MakeupChoice } from "@/lib/glam/makeup"
import type { LookService } from "@/lib/glam/look"
import { cn } from "@/lib/utils"

type Mode = "mehndi" | "makeup"
type Card = { title: string; brief: string; services: LookService[]; ai: boolean }
const ROSE = "linear-gradient(135deg,#f3c6b3 0%,#b97c66 45%,#f6d7c8 70%,#a86c58 100%)"

export function GlamMirror() {
  const [mode, setMode] = useState<Mode>("mehndi")
  const [design, setDesign] = useState<DesignId>("arabic-trail")
  const [stain, setStain] = useState<"fresh" | "dark">("dark")
  const [coverage, setCoverage] = useState<"front" | "front-back">("front")
  const [makeup, setMakeup] = useState<MakeupChoice & { hairLength: "Short" | "Medium" | "Long" }>({ ...NO_MAKEUP, hairLength: "Medium" })
  const [usedMehndi, setUsedMehndi] = useState(false)
  const [usedMakeup, setUsedMakeup] = useState(false)
  const mehndiPreview = useRef<HTMLCanvasElement | null>(null)

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#fbeee6 0%,#f6e4e6 45%,#fdf7f1 100%)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-32 sm:pt-40 pb-10">
        <p className="text-sm tracking-[0.2em] uppercase text-[#a86c58]">Glam Mirror · on your phone</p>
        <h1 className="font-serif text-[clamp(2.6rem,7vw,5.5rem)] leading-[0.95] mt-4 max-w-4xl">
          See the look <span className="italic text-[#a86c58]">before</span> you book it.
        </h1>
        <p className="text-lg text-black/60 mt-6 max-w-2xl">Try mehndi designs on a photo of your own hand, and lip colours, blush, kajal and hair colour live on your face. Pick the one you love and it becomes a Look Card for the pro who comes to you.</p>
        <div className="mt-8 inline-flex rounded-full bg-white/70 backdrop-blur p-1 border border-black/5" role="tablist">
          {(
            [
              ["mehndi", "Mehndi on my hand", Hand],
              ["makeup", "Makeup & hair, live", Sparkles],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={cn("h-11 px-5 rounded-full text-sm flex items-center gap-2 transition-colors", mode === id ? "bg-black text-white" : "text-black/60 hover:text-black")}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {mode === "mehndi" ? (
          <MehndiStudio design={design} setDesign={setDesign} stain={stain} setStain={setStain} coverage={coverage} setCoverage={setCoverage} onUse={() => setUsedMehndi(true)} previewRef={mehndiPreview} />
        ) : (
          <MakeupStudio makeup={makeup} setMakeup={setMakeup} onUse={() => setUsedMakeup(true)} />
        )}
        <LookCardPanel
          mehndi={usedMehndi ? { design, coverage, stain } : undefined}
          makeup={usedMakeup ? makeup : undefined}
          previewRef={mehndiPreview}
          onClear={(k) => (k === "mehndi" ? setUsedMehndi(false) : setUsedMakeup(false))}
        />
        <p className="mt-8 text-xs text-black/45 max-w-3xl">Everything here runs on your phone: your selfie and hand photo are never uploaded. A hand preview only goes to your pro if you choose to send it with a booking, and it&apos;s deleted after the visit. Colour try-on only: no skin smoothing or lightening, ever.</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Mehndi
// ---------------------------------------------------------------------------------------------

function MehndiStudio({
  design,
  setDesign,
  stain,
  setStain,
  coverage,
  setCoverage,
  onUse,
  previewRef,
}: {
  design: DesignId
  setDesign: (d: DesignId) => void
  stain: "fresh" | "dark"
  setStain: (s: "fresh" | "dark") => void
  coverage: "front" | "front-back"
  setCoverage: (c: "front" | "front-back") => void
  onUse: () => void
  previewRef: React.MutableRefObject<HTMLCanvasElement | null>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<{ img: HTMLImageElement; w: number; h: number } | null>(null)
  const [hands, setHands] = useState<HandPts[]>([])
  const [manual, setManual] = useState<{ c: Pt; size: number; rot: number } | null>(null)
  const [status, setStatus] = useState<"sample" | "loading" | "found" | "manual" | "error">("sample")
  const [compare, setCompare] = useState(false)
  const drag = useRef<{ x: number; y: number; c: Pt } | null>(null)

  useEffect(() => {
    previewRef.current = canvas.current
  }, [previewRef])

  // Render whenever anything changes.
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const color = HENNA[stain]
    if (!photo) {
      // A sample hand so the page is never empty.
      const w = 900
      const h = 1100
      c.width = w
      c.height = h
      const ctx = c.getContext("2d")!
      ctx.fillStyle = "#f4e3d7"
      ctx.fillRect(0, 0, w, h)
      const L = templateHand({ x: w / 2, y: h * 0.56 }, 300, 0)
      drawHandSilhouette(ctx, L, 300)
      drawDesignOn(ctx, L, design, color)
      return
    }
    const list = status === "manual" && manual ? [templateHand(manual.c, manual.size, manual.rot)] : hands
    renderMehndi(c, photo.img, photo.w, photo.h, list, design, color, !compare)
  }, [photo, hands, manual, design, stain, compare, status])

  const pick = async (f: File) => {
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = async () => {
      const s = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.round(img.naturalWidth * s)
      const h = Math.round(img.naturalHeight * s)
      setPhoto({ img, w, h })
      setHands([])
      setStatus("loading")
      onUse()
      track("glam_mehndi_photo", {})
      try {
        const { handLandmarker } = await import("@/lib/glam/vision")
        const hl = await handLandmarker()
        const res = hl.detect(img)
        const found = (res.landmarks ?? []).map((l) => l.map((p) => ({ x: p.x * w, y: p.y * h })))
        if (found.length) {
          setHands(found)
          setStatus("found")
        } else {
          setManual({ c: { x: w / 2, y: h / 2 }, size: Math.min(w, h) * 0.3, rot: 0 })
          setStatus("manual")
        }
      } catch (e) {
        console.error("[glam] hand tracker failed", e)
        setManual({ c: { x: w / 2, y: h / 2 }, size: Math.min(w, h) * 0.3, rot: 0 })
        setStatus("manual")
      }
    }
    img.src = url
  }

  const toCanvas = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * canvas.current!.width, y: ((e.clientY - r.top) / r.height) * canvas.current!.height }
  }
  const save = () => {
    const c = canvas.current
    if (!c) return
    const a = document.createElement("a")
    a.download = "mjazo-mehndi.jpg"
    a.href = c.toDataURL("image/jpeg", 0.9)
    a.click()
    track("glam_save_image", { mode: "mehndi" })
  }

  return (
    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
      <div className="min-w-0">
        <Mirror>
          <canvas
            ref={canvas}
            className={cn("w-full h-auto block rounded-[1.7rem] touch-none select-none", status === "manual" && "cursor-move")}
            onPointerDown={(e) => {
              if (status !== "manual" || !manual) return
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              drag.current = { ...toCanvas(e), c: manual.c }
            }}
            onPointerMove={(e) => {
              if (!drag.current || !manual) return
              const p = toCanvas(e)
              setManual({ ...manual, c: { x: drag.current.c.x + p.x - drag.current.x, y: drag.current.c.y + p.y - drag.current.y } })
            }}
            onPointerUp={() => (drag.current = null)}
            onWheel={(e) => manual && status === "manual" && setManual({ ...manual, size: Math.max(40, manual.size * (e.deltaY > 0 ? 0.95 : 1.05)) })}
          />
          <AnimatePresence>
            {status === "loading" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 rounded-[1.7rem] bg-black/45 flex flex-col items-center justify-center text-white gap-3">
                <Loader2 className="w-7 h-7 animate-spin" />
                <p className="text-sm text-center px-8">Finding your hand… The tracker runs on your phone, so the first time takes a few seconds.</p>
              </motion.div>
            )}
          </AnimatePresence>
          {status === "sample" && <span className="absolute top-4 left-4 rounded-full bg-black/70 text-white text-xs px-3 py-1.5">Sample hand: add yours</span>}
        </Mirror>
        <div className="flex flex-wrap gap-2 mt-4">
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) pick(e.target.files[0])
              e.target.value = ""
            }}
          />
          <button onClick={() => file.current?.click()} className="h-12 px-5 rounded-full bg-black text-white text-sm flex items-center gap-2">
            {photo ? <ImagePlus className="w-4 h-4" /> : <Camera className="w-4 h-4" />} {photo ? "Use another photo" : "Add a photo of your hand"}
          </button>
          {photo && (
            <>
              <button onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)} className="h-12 px-5 rounded-full border border-black/15 bg-white text-sm flex items-center gap-2 select-none">
                <Eye className="w-4 h-4" /> Hold to compare
              </button>
              <button onClick={save} className="h-12 px-5 rounded-full border border-black/15 bg-white text-sm flex items-center gap-2">
                <Download className="w-4 h-4" /> Save image
              </button>
            </>
          )}
        </div>
        {status === "found" && <p className="text-sm text-emerald-700 mt-3">Found {hands.length === 2 ? "both hands" : "your hand"}: the design follows your fingers.</p>}
        {status === "manual" && manual && (
          <div className="mt-4 rounded-3xl bg-white/80 border border-black/5 p-4 space-y-3">
            <p className="text-sm">We couldn&apos;t find a hand in this photo, so place the design yourself: drag it, then size and turn it. A flat, open hand in good light works best.</p>
            <label className="flex items-center gap-3 text-sm">
              <span className="w-12 text-black/50">Size</span>
              <input type="range" min={40} max={Math.max(photo!.w, photo!.h) * 0.6} value={manual.size} onChange={(e) => setManual({ ...manual, size: +e.target.value })} className="flex-1 accent-black" />
            </label>
            <label className="flex items-center gap-3 text-sm">
              <span className="w-12 text-black/50">
                <RotateCw className="w-4 h-4" />
              </span>
              <input type="range" min={-180} max={180} value={Math.round((manual.rot * 180) / Math.PI)} onChange={(e) => setManual({ ...manual, rot: (+e.target.value * Math.PI) / 180 })} className="flex-1 accent-black" />
            </label>
          </div>
        )}
      </div>

      <div className="space-y-5 min-w-0">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-black/50 mb-3">Designs</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2">
            {DESIGNS.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setDesign(d.id)
                  onUse()
                  track("glam_design", { design: d.id })
                }}
                aria-pressed={design === d.id}
                className={cn("rounded-2xl bg-white p-1.5 border-2 transition-all text-left", design === d.id ? "border-[#a86c58] shadow-lg -translate-y-0.5" : "border-transparent hover:border-black/10")}
              >
                <DesignThumb id={d.id} color={HENNA[stain]} />
                <p className="text-[12px] font-medium mt-1 px-1 leading-tight">{d.name}</p>
                <p className="text-[10px] text-black/45 px-1 pb-0.5">{d.style}</p>
              </button>
            ))}
          </div>
          <p className="text-sm text-black/60 mt-3">{DESIGNS.find((d) => d.id === design)?.note}</p>
        </div>
        <Seg label="Stain" value={stain} onChange={setStain} options={[["fresh", "Fresh (day 1)"], ["dark", "Deep (day 2–3)"]]} />
        <Seg label="Coverage" value={coverage} onChange={setCoverage} options={[["front", "Front of hands"], ["front-back", "Front + back"]]} />
      </div>
    </div>
  )
}

/** A soft hand shape under the design for the sample and the thumbnails. */
function drawHandSilhouette(ctx: CanvasRenderingContext2D, L: HandPts, palm: number) {
  ctx.save()
  ctx.fillStyle = "#e9c6ad"
  ctx.strokeStyle = "#e9c6ad"
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.beginPath()
  ;[L[0], L[1], L[2], L[5], L[9], L[13], L[17]].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = palm * 0.36
  ctx.stroke()
  for (const f of [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ]) {
    ctx.lineWidth = palm * (f[0] === 17 ? 0.19 : f[0] === 1 ? 0.25 : 0.22)
    ctx.beginPath()
    f.forEach((i, k) => (k ? ctx.lineTo(L[i].x, L[i].y) : ctx.moveTo(L[i].x, L[i].y)))
    ctx.stroke()
  }
  ctx.lineWidth = palm * 0.75
  ctx.beginPath()
  ctx.moveTo(L[0].x, L[0].y)
  ctx.lineTo(L[0].x + (L[0].x - L[9].x) * 0.45, L[0].y + (L[0].y - L[9].y) * 0.45)
  ctx.stroke()
  ctx.restore()
}

function DesignThumb({ id, color }: { id: DesignId; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const w = 220
    const h = 260
    c.width = w
    c.height = h
    const ctx = c.getContext("2d")!
    ctx.fillStyle = "#fbf3ec"
    ctx.fillRect(0, 0, w, h)
    const L = templateHand({ x: w / 2, y: h * 0.58 }, 72, 0)
    drawHandSilhouette(ctx, L, 72)
    drawDesignOn(ctx, L, id, color)
  }, [id, color])
  return <canvas ref={ref} className="w-full h-auto rounded-xl block" aria-hidden />
}

// ---------------------------------------------------------------------------------------------
// Makeup & hair (live)
// ---------------------------------------------------------------------------------------------

function MakeupStudio({ makeup, setMakeup, onUse }: { makeup: MakeupChoice & { hairLength: "Short" | "Medium" | "Long" }; setMakeup: (m: MakeupChoice & { hairLength: "Short" | "Medium" | "Long" }) => void; onUse: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const still = useRef<HTMLImageElement | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const raf = useRef(0)
  const choice = useRef(makeup)
  const scratch = useRef<{ mask?: HTMLCanvasElement; tint?: HTMLCanvasElement }>({})
  const lastHair = useRef<{ mask: Float32Array; w: number; h: number } | null>(null)
  const [state, setState] = useState<"idle" | "loading" | "live" | "photo" | "error">("idle")
  const [error, setError] = useState("")
  const [noFace, setNoFace] = useState(false)
  const noFaceRef = useRef(false)
  choice.current = makeup

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    const s = video.current?.srcObject as MediaStream | null
    s?.getTracks().forEach((t) => t.stop())
    if (video.current) video.current.srcObject = null
  }, [])
  useEffect(() => stop, [stop])

  const run = useCallback(async (source: HTMLVideoElement | HTMLImageElement, mirror: boolean) => {
    const { faceLandmarker, hairSegmenter } = await import("@/lib/glam/vision")
    const [face, hairSeg] = await Promise.all([faceLandmarker(), hairSegmenter().catch(() => null)])
    let frame = 0
    let t = performance.now()
    const draw = () => {
      const c = canvas.current
      const isVideo = source instanceof HTMLVideoElement
      const w = isVideo ? source.videoWidth : source.naturalWidth
      const h = isVideo ? source.videoHeight : source.naturalHeight
      if (c && w && h) {
        const s = Math.min(1, 960 / Math.max(w, h))
        const cw = Math.round(w * s)
        const ch = Math.round(h * s)
        if (c.width !== cw || c.height !== ch) {
          c.width = cw
          c.height = ch
        }
        const ctx = c.getContext("2d")!
        t = Math.max(t + 1, performance.now())
        ctx.save()
        if (mirror) {
          ctx.translate(cw, 0)
          ctx.scale(-1, 1)
        }
        ctx.drawImage(source, 0, 0, cw, ch)
        const m = choice.current
        if (hairSeg && m.hair !== "none" && (frame % 2 === 0 || !lastHair.current)) {
          const r = hairSeg.segmentForVideo(source, t)
          const mask = r.confidenceMasks?.[1] ?? r.confidenceMasks?.[0]
          if (mask) lastHair.current = { mask: mask.getAsFloat32Array().slice(), w: mask.width, h: mask.height }
          r.close()
        }
        if (m.hair !== "none" && lastHair.current) drawHair(ctx, lastHair.current.mask, lastHair.current.w, lastHair.current.h, cw, ch, m.hair, scratch.current)
        const res = face.detectForVideo(source, t)
        const lm = res.faceLandmarks?.[0]
        if (noFaceRef.current !== !lm) {
          noFaceRef.current = !lm
          setNoFace(!lm)
        }
        if (lm) drawMakeup(ctx, lm, cw, ch, m)
        ctx.restore()
        frame++
      }
      if (source instanceof HTMLVideoElement) raf.current = requestAnimationFrame(draw)
    }
    draw()
    return draw
  }, [])
  const redrawStill = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (state === "photo") redrawStill.current?.()
  }, [makeup, state])

  const startCamera = async () => {
    setError("")
    setState("loading")
    onUse()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false })
      const v = document.createElement("video")
      v.playsInline = true
      v.muted = true
      v.srcObject = stream
      await v.play()
      video.current = v
      setState("live")
      track("glam_camera", {})
      await run(v, true)
    } catch (e) {
      console.error("[glam] camera", e)
      setError("We couldn't open the camera. You can use a selfie photo instead.")
      setState("error")
    }
  }

  const usePhoto = (f: File) => {
    stop()
    const img = new Image()
    img.onload = async () => {
      still.current = img
      setState("loading")
      onUse()
      try {
        redrawStill.current = await run(img, false)
        setState("photo")
      } catch (e) {
        console.error("[glam] face tracker", e)
        setError("We couldn't load the face tracker on this device.")
        setState("error")
      }
    }
    img.src = URL.createObjectURL(f)
  }

  const set = (k: keyof MakeupChoice, v: string) => {
    setMakeup({ ...makeup, [k]: v })
    onUse()
  }

  return (
    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
      <div className="min-w-0">
        <Mirror>
          <canvas ref={canvas} className={cn("w-full h-auto block rounded-[1.7rem]", state === "idle" || state === "error" || state === "loading" ? "hidden" : "")} />
          {(state === "idle" || state === "error" || state === "loading") && (
            <div className="aspect-[3/4] rounded-[1.7rem] bg-[#1d1513] flex flex-col items-center justify-center text-white gap-4 p-8 text-center">
              {state === "loading" ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <p className="text-sm text-white/70">Loading the on-device face tracker… first time only.</p>
                </>
              ) : (
                <>
                  <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: ROSE }}>
                    <Video className="w-7 h-7 text-black" />
                  </span>
                  <p className="font-serif text-2xl">Your mirror, with makeup</p>
                  <p className="text-sm text-white/60 max-w-xs">Lips, blush, kajal and hair colour follow your face live. The video never leaves your phone.</p>
                  {error && <p className="text-sm text-amber-300">{error}</p>}
                </>
              )}
            </div>
          )}
          {state === "live" && noFace && <span className="absolute top-4 left-4 rounded-full bg-black/70 text-white text-xs px-3 py-1.5">Looking for your face…</span>}
        </Mirror>
        <div className="flex flex-wrap gap-2 mt-4">
          {state === "live" ? (
            <button
              onClick={() => {
                stop()
                setState("idle")
              }}
              className="h-12 px-5 rounded-full border border-black/15 bg-white text-sm flex items-center gap-2"
            >
              <VideoOff className="w-4 h-4" /> Stop camera
            </button>
          ) : (
            <button onClick={startCamera} disabled={state === "loading"} className="h-12 px-5 rounded-full bg-black text-white text-sm flex items-center gap-2 disabled:opacity-50">
              <Video className="w-4 h-4" /> Start live mirror
            </button>
          )}
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) usePhoto(e.target.files[0])
              e.target.value = ""
            }}
          />
          <button onClick={() => file.current?.click()} className="h-12 px-5 rounded-full border border-black/15 bg-white text-sm flex items-center gap-2">
            <ImagePlus className="w-4 h-4" /> Use a selfie photo
          </button>
        </div>
      </div>

      <div className="space-y-6 min-w-0">
        <Swatches label="Lips" items={LIPS} value={makeup.lips} onChange={(v) => set("lips", v)} />
        <Swatches label="Blush" items={BLUSH} value={makeup.blush} onChange={(v) => set("blush", v)} />
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-black/50 mb-2">Eyes</p>
          <div className="flex flex-wrap gap-2">
            {KAJAL.map((k) => (
              <button key={k.id} onClick={() => set("kajal", k.id)} aria-pressed={makeup.kajal === k.id} className={cn("h-10 px-4 rounded-full text-sm border", makeup.kajal === k.id ? "bg-black text-white border-black" : "bg-white border-black/10")}>
                {k.name}
              </button>
            ))}
          </div>
        </div>
        <Swatches label="Hair colour" items={HAIR} value={makeup.hair} onChange={(v) => set("hair", v)} />
        {makeup.hair !== "none" && <Seg label="Hair length" value={makeup.hairLength} onChange={(v) => setMakeup({ ...makeup, hairLength: v })} options={[["Short", "Short"], ["Medium", "Medium"], ["Long", "Long"]]} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Look Card
// ---------------------------------------------------------------------------------------------

function LookCardPanel({ mehndi, makeup, previewRef, onClear }: { mehndi?: { design: DesignId; coverage: "front" | "front-back"; stain: "fresh" | "dark" }; makeup?: MakeupChoice & { hairLength: "Short" | "Medium" | "Long" }; previewRef: React.MutableRefObject<HTMLCanvasElement | null>; onClear: (k: "mehndi" | "makeup") => void }) {
  const [card, setCard] = useState<Card | null>(null)
  const [occasion, setOccasion] = useState("")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [added, setAdded] = useState(false)
  const [withPreview, setWithPreview] = useState(true)
  const add = useCart((s) => s.add)
  const hasMakeup = makeup && (makeup.lips !== "none" || makeup.blush !== "none" || makeup.kajal !== "none" || makeup.hair !== "none")
  const any = Boolean(mehndi) || Boolean(hasMakeup)
  useEffect(() => {
    setCard(null)
    setSaved(false)
    setAdded(false)
  }, [mehndi?.design, mehndi?.coverage, mehndi?.stain, makeup?.lips, makeup?.blush, makeup?.kajal, makeup?.hair, makeup?.hairLength])

  const create = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/glam/look-card", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mehndi, makeup: hasMakeup ? makeup : undefined, occasion: occasion || undefined }) })
      const data = await res.json()
      if (res.ok) setCard(data)
      track("glam_look_card", { ai: data.ai, services: data.services?.length })
    } finally {
      setBusy(false)
    }
  }
  const keep = async () => {
    if (!card) return
    const photos: string[] = []
    // Only the mehndi preview (a hand) can travel to the pro, and only if the customer wants it.
    if (mehndi && withPreview && previewRef.current) photos.push(await thumb(previewRef.current.toDataURL("image/jpeg", 0.85), 720))
    if (saveBrief({ kind: "look", title: card.title, text: card.brief, photos, categories: [...new Set(card.services.map((s) => s.category))] })) setSaved(true)
  }
  const toCart = () => {
    if (!card) return
    for (const s of card.services) add({ category: s.category, categoryName: s.categoryName, service: s.service, name: s.name, options: s.options, addOns: [], unitPrice: s.unitPrice, duration: s.duration })
    setAdded(true)
    if (!saved) keep()
    track("add_to_cart", { source: "glam_mirror", services: card.services.length })
  }

  return (
    <section className="mt-12 rounded-[32px] bg-[#1d1513] text-white p-6 sm:p-10 relative overflow-hidden">
      <div aria-hidden className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-25 blur-[90px]" style={{ background: ROSE }} />
      <div className="relative grid lg:grid-cols-[0.8fr_1.2fr] gap-8">
        <div>
          <p className="text-sm tracking-[0.2em] uppercase text-[#f3c6b3]">Look Card</p>
          <p className="font-serif text-4xl mt-2">Love it? Send it to your pro.</p>
          <p className="text-white/60 mt-3">We turn what you tried on into a brief and the right services from the Mjazo menu. Your pro arrives knowing exactly what you want.</p>
          <div className="flex flex-wrap gap-2 mt-5">
            {mehndi && (
              <Chip onClear={() => onClear("mehndi")}>
                Mehndi: {DESIGNS.find((d) => d.id === mehndi.design)?.name}
              </Chip>
            )}
            {hasMakeup && (
              <Chip onClear={() => onClear("makeup")}>
                Makeup{makeup!.hair !== "none" ? " + hair colour" : ""}
              </Chip>
            )}
            {!any && <p className="text-sm text-white/45">Try a design or a shade above first.</p>}
          </div>
        </div>
        <div className="min-w-0">
          {!card ? (
            <div className="space-y-3">
              <input value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Occasion (optional), e.g. my cousin's mehndi" className="w-full h-12 rounded-2xl bg-white/[0.07] border border-white/15 px-4 text-[16px] sm:text-sm outline-none focus:border-[#f3c6b3] placeholder:text-white/35" />
              <button onClick={create} disabled={!any || busy} className="h-14 px-7 rounded-full text-black font-medium inline-flex items-center gap-2 disabled:opacity-40" style={{ background: ROSE }}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Create my Look Card
              </button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-white text-black p-6">
              <p className="text-xs uppercase tracking-[0.15em] text-[#a86c58]">Look Card{card.ai ? " · written by AI" : ""}</p>
              <p className="font-serif text-3xl mt-1">{card.title}</p>
              <p className="text-sm text-black/70 mt-3 leading-relaxed" dir="auto">
                {card.brief}
              </p>
              {card.services.length > 0 && (
                <ul className="mt-5 divide-y divide-black/[0.06]">
                  {card.services.map((s) => (
                    <li key={s.service} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <span>
                        <Link href={`/services/${s.category}/${s.service}`} className="font-medium hover:underline">
                          {s.name}
                        </Link>
                        {s.options.length > 0 && <span className="text-black/50"> · {s.options.join(", ")}</span>}
                      </span>
                      <span className="font-medium shrink-0">{formatPKR(s.unitPrice)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {mehndi && (
                <label className="mt-4 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={withPreview} onChange={(e) => setWithPreview(e.target.checked)} className="w-4 h-4 accent-black" /> Include my mehndi preview for the pro
                </label>
              )}
              <div className="flex flex-wrap gap-2 mt-5">
                {card.services.length > 0 && (
                  <button onClick={toCart} className={cn("h-12 px-5 rounded-full text-sm flex items-center gap-2", added ? "bg-[#f3c6b3] text-black" : "bg-black text-white")}>
                    {added ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />} {added ? "Added to your cart" : "Book this look"}
                  </button>
                )}
                <button onClick={keep} className="h-12 px-5 rounded-full border border-black/15 text-sm flex items-center gap-2">
                  {saved ? <Check className="w-4 h-4" /> : null} {saved ? "Saved for your booking" : "Save for my booking"}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------

function Mirror({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-[2rem] p-[6px] shadow-[0_30px_80px_-30px_rgba(90,40,30,0.45)]" style={{ background: ROSE }}>
      <div className="relative rounded-[1.7rem] overflow-hidden bg-[#1d1513]">{children}</div>
    </div>
  )
}
function Seg<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.15em] text-black/50 mb-2">{label}</p>
      <div className="inline-flex rounded-full bg-white p-1 border border-black/5">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)} aria-pressed={value === v} className={cn("h-9 px-4 rounded-full text-sm", value === v ? "bg-black text-white" : "text-black/60")}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
function Swatches({ label, items, value, onChange }: { label: string; items: { id: string; name: string; hex: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.15em] text-black/50 mb-2">
        {label}: <span className="normal-case tracking-normal text-black">{items.find((i) => i.id === value)?.name}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button key={i.id} onClick={() => onChange(i.id)} aria-label={i.name} aria-pressed={value === i.id} className={cn("w-11 h-11 rounded-full border-2 transition-transform", value === i.id ? "border-black scale-110" : "border-white shadow")} style={{ background: i.hex || "repeating-linear-gradient(45deg,#fff 0 6px,#eee 6px 12px)" }} />
        ))}
      </div>
    </div>
  )
}
function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="h-9 pl-4 pr-1 rounded-full bg-white/10 text-sm inline-flex items-center gap-2">
      {children}
      <button onClick={onClear} aria-label="Remove" className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center">
        ×
      </button>
    </span>
  )
}
