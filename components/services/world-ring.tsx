"use client"

// All-services hero: the 8 service worlds on a CSS-3D carousel ring.
// Auto-rotates (one turn per 48s), drag or swipe to spin with inertia (0.92 friction),
// the card facing you scales up; click any card to open that world.

import Link from "@/components/site/locale-link"
import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Icon } from "@/components/site/primitives"
import { cn } from "@/lib/utils"
import { useCatalog } from "@/components/cms/provider"

export function WorldRing() {
  const { worlds, worldStatus } = useCatalog()
  const STEP = 360 / worlds.length
  const reduce = useReducedMotion()
  const [angle, setAngle] = useState(0)
  const [radius, setRadius] = useState(420)
  const st = useRef({ angle: 0, vel: 0, dragging: false, lastX: 0, moved: 0, idle: 0 })

  useEffect(() => {
    const onResize = () => setRadius(window.innerWidth < 400 ? 190 : window.innerWidth < 640 ? 230 : window.innerWidth < 1024 ? 330 : 430)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05)
      last = t
      const s = st.current
      if (!s.dragging) {
        s.angle += s.vel
        s.vel *= 0.92
        if (Math.abs(s.vel) < 0.01) {
          s.vel = 0
          s.idle += dt
          if (!reduce && s.idle > 1.5) s.angle -= dt * (360 / 48)
        }
      }
      setAngle(s.angle)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce])

  const front = ((Math.round(-angle / STEP) % worlds.length) + worlds.length) % worlds.length
  const nudge = (dir: 1 | -1) => {
    const s = st.current
    s.idle = 0
    s.angle = Math.round(s.angle / STEP) * STEP - dir * STEP
    s.vel = 0
  }

  return (
    <div className="relative select-none overflow-hidden [contain:paint]">
      <div
        className="relative h-[300px] min-[400px]:h-[340px] sm:h-[400px] cursor-grab active:cursor-grabbing touch-pan-y max-[399px]:scale-[0.86]"
        style={{ perspective: 1600 }}
        onPointerDown={(e) => {
          const s = st.current
          s.dragging = true
          s.lastX = e.clientX
          s.moved = 0
          s.vel = 0
          s.idle = 0
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const s = st.current
          if (!s.dragging) return
          const dx = e.clientX - s.lastX
          s.lastX = e.clientX
          s.moved += Math.abs(dx)
          s.angle += dx * 0.25
          s.vel = dx * 0.25
        }}
        onPointerUp={() => {
          st.current.dragging = false
        }}
        onPointerCancel={() => {
          st.current.dragging = false
        }}
        onClickCapture={(e) => {
          if (st.current.moved > 6) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        <div className="absolute left-1/2 top-1/2 w-0 h-0" style={{ transformStyle: "preserve-3d", transform: `translateZ(${-radius}px) rotateY(${angle}deg)` }}>
          {worlds.map((w, i) => {
            const live = worldStatus(w.slug) === "live"
            const isFront = i === front
            return (
              <Link
                key={w.slug}
                href={`/services/w/${w.slug}`}
                draggable={false}
                className="absolute -start-[110px] -top-[150px] sm:-start-[130px] sm:-top-[170px] w-[220px] h-[300px] sm:w-[260px] sm:h-[340px] rounded-[2rem] p-6 flex flex-col justify-between overflow-hidden shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)] transition-[box-shadow] duration-300"
                style={{ background: w.tint, transform: `rotateY(${i * STEP}deg) translateZ(${radius}px) scale(${isFront ? 1.06 : 0.94})`, backfaceVisibility: "hidden", transition: "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)" }}
                aria-label={w.name}
                tabIndex={isFront ? 0 : -1}
              >
                <div className="flex justify-between items-start">
                  <span className={cn("text-[11px] rounded-full px-2.5 py-1", live ? "bg-white text-brand-ink" : "bg-white/60 text-zinc-600")}>{live ? "● Live now" : "Coming soon"}</span>
                  <span className="text-xs text-black/40">0{i + 1}</span>
                </div>
                <div className="w-24 h-24 rounded-full bg-white/50 flex items-center justify-center self-center">
                  <Icon name={w.icon} className="w-12 h-12" strokeWidth={1} />
                </div>
                <div>
                  <p className="font-serif text-3xl leading-none">{w.name}</p>
                  <p className="text-sm text-black/60 mt-2">{w.short}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 mt-4">
        <button onClick={() => nudge(-1)} className="w-11 h-11 rounded-full border border-zinc-300 flex items-center justify-center hover:bg-foreground hover:text-background transition-colors" aria-label="Previous world"><ChevronLeft className="w-4 h-4 rtl:-scale-x-100" /></button>
        <Link href={`/services/w/${worlds[front].slug}`} className="min-w-48 text-center text-sm py-3">
          <span className="text-zinc-500">Open </span><span className="font-medium underline underline-offset-4">{worlds[front].name}</span>
        </Link>
        <button onClick={() => nudge(1)} className="w-11 h-11 rounded-full border border-zinc-300 flex items-center justify-center hover:bg-foreground hover:text-background transition-colors" aria-label="Next world"><ChevronRight className="w-4 h-4 rtl:-scale-x-100" /></button>
      </div>
    </div>
  )
}
