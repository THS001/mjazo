"use client"

// Home hero, on one centre axis: live chip → headline → search bar slot → phone.
// Timing: headline letters from 0.3s; the phone rises 400px and fades in over 1.5s
// after 0.5s (template); the search bar rises into its reserved slot once the phone
// has landed and 5s have passed. The phone holds a real, tappable mini Mjazo app.

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion"
import { MapPin, Search } from "lucide-react"
import { useLocation } from "@/lib/store"
import { EASE, SplitText } from "@/components/site/primitives"
import { PhoneDevice } from "./phone-device"
import { useCatalog } from "@/components/cms/provider"
import type { HomeContent } from "@/lib/cms/types/pages/home"

// Template hero video (coastal sunset). TODO: self-host a compressed copy + poster, or
// swap for real Mjazo footage once it's shot.
const HERO_VIDEO = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/af7687fd-f2ad-4f2a-96f0-b56fa7d3769c-08wERpo5U1sktxs1vcRsJW9ueslNZv.mp4"

const TIMING = { phoneDelay: 0.5, phoneDuration: 1.5, phoneRise: 400, searchAt: 5 }

const easeOutQuad = (t: number) => t * (2 - t)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function phoneWidth(vw: number) {
  if (vw >= 1024) return 340
  if (vw >= 768) return 320
  return Math.min(300, vw - 48)
}

export function Hero({ content }: { content: HomeContent["hero"] }) {
  const { getArea } = useCatalog()
  const reduce = useReducedMotion()
  const [p, setP] = useState(0)
  const [width, setWidth] = useState(340)
  const [videoReady, setVideoReady] = useState(false)
  const [landed, setLanded] = useState(false)
  const [fiveSeconds, setFiveSeconds] = useState(false)
  const { area, subArea } = useLocation()
  const [mounted, setMounted] = useState(false)
  const section = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)

  // Gentle 3D tilt toward the pointer; settles flat while the pointer is on the phone.
  const rx = useSpring(useMotionValue(0), { stiffness: 120, damping: 20 })
  const ry = useSpring(useMotionValue(0), { stiffness: 120, damping: 20 })

  // The 10MB video loads only after hydration (better first paint on phones) and never on
  // Data Saver. React doesn't reliably emit the muted attribute, so set it and play by hand.
  useEffect(() => {
    const v = video.current
    if (!v) return
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (saveData) return
    v.muted = true
    v.src = content.video?.url || HERO_VIDEO
    const start = () => {
      setVideoReady(true)
      v.play().catch(() => {})
    }
    if (v.readyState >= 3) start()
    else v.addEventListener("canplay", start, { once: true })
    return () => v.removeEventListener("canplay", start)
  }, [])

  useEffect(() => {
    setMounted(true)
    const onResize = () => setWidth(phoneWidth(window.innerWidth))
    onResize()
    window.addEventListener("resize", onResize)
    const five = setTimeout(() => setFiveSeconds(true), TIMING.searchAt * 1000)
    return () => {
      window.removeEventListener("resize", onResize)
      clearTimeout(five)
    }
  }, [])
  useEffect(() => {
    if (reduce) setLanded(true)
  }, [reduce])
  const showSearch = !!reduce || (landed && fiveSeconds)

  // Template behaviour: scroll 0→400px scales the frame 1→0.85, rounds it 0→48px, height 100→62.5vh (lerp 0.1)
  useEffect(() => {
    let raf = 0
    let current = 0
    const tick = () => {
      const target = Math.min(window.scrollY / 400, 1)
      current += (target - current) * 0.1
      setP(current)
      if (Math.abs(target - current) > 0.001) raf = requestAnimationFrame(tick)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !section.current) return
    if ((e.target as HTMLElement).closest("[data-phone]")) {
      rx.set(0)
      ry.set(0)
      return
    }
    const r = section.current.getBoundingClientRect()
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 10)
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 6)
  }

  const areaLabel = mounted && area ? `${getArea(area)?.name}${subArea ? `, ${subArea}` : ""}` : "Choose area"

  return (
    <section
      ref={section}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
      className="relative overflow-hidden pb-20"
    >
      {/* Shrinking video frame (template) */}
      <div className="absolute inset-x-0 top-0">
        <div
          className="w-full will-change-transform overflow-hidden relative"
          style={{ transform: `scale(${1 - easeOutQuad(p) * 0.15})`, borderRadius: `${easeOutCubic(p) * 48}px`, height: `${100 - easeOutQuad(p) * 37.5}svh` }}
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, oklch(0.88 0.03 280) 0%, oklch(0.9 0.06 45) 55%, oklch(0.7 0.07 150) 100%)" }} />
          <video
            ref={video}
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${videoReady ? "opacity-100" : "opacity-0"}`}
          />
        </div>
      </div>

      {/* Giant wordmark at the foot of the first screen, behind the phone */}
      <div
        className="absolute inset-x-0 top-0 h-[100svh] flex items-end justify-center pointer-events-none"
        style={{ transform: `translateY(${p * 150}px)`, opacity: 1 - p * 0.8 }}
        aria-hidden
      >
        <span className="block text-white font-bold text-[28vw] sm:text-[25vw] md:text-[22vw] lg:text-[20vw] 2xl:text-[18vw] tracking-tighter leading-[0.8] select-none">MJAZO</span>
      </div>

      {/* One centred column */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 pt-28 sm:pt-32">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: EASE }}
          className="inline-flex items-center gap-2 rounded-full bg-white/75 backdrop-blur px-3 py-1.5 text-xs text-zinc-700 border border-white/80"
        >
          <span className="live-dot w-1.5 h-1.5 rounded-full bg-brand" /> {content.badge}
        </motion.p>

        <h1 className="mt-5 font-serif font-normal text-center text-[3.25rem] sm:text-[4.5rem] md:text-[5.5rem] lg:text-[6.25rem] leading-[0.95] tracking-tight max-w-5xl text-balance">
          <SplitText text={content.title} delay={0.3} />
        </h1>

        {/* Search slot: space is reserved from the start so nothing shifts when it appears */}
        <motion.div
          initial={false}
          animate={showSearch ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 24, filter: "blur(8px)" }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mt-7 w-full max-w-xl"
          style={{ pointerEvents: showSearch ? "auto" : "none" }}
          aria-hidden={!showSearch}
        >
          <div className="flex items-center gap-1 h-14 rounded-full bg-white/95 backdrop-blur-xl p-1.5 border border-white shadow-[0_24px_50px_-20px_rgba(0,0,0,0.35)]">
            <button
              tabIndex={showSearch ? 0 : -1}
              onClick={() => window.dispatchEvent(new Event("mjazo:location"))}
              className="flex items-center gap-1.5 rounded-full px-3 sm:px-4 h-full text-sm max-w-[42%] hover:bg-zinc-100 transition-colors"
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{areaLabel}</span>
            </button>
            <span className="w-px h-6 bg-zinc-200" />
            <button
              tabIndex={showSearch ? 0 : -1}
              onClick={() => window.dispatchEvent(new Event("mjazo:search"))}
              className="flex-1 min-w-0 flex items-center gap-2 rounded-full px-3 sm:px-4 h-full text-sm text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="truncate">{content.search}</span>
            </button>
            <button
              tabIndex={showSearch ? 0 : -1}
              onClick={() => window.dispatchEvent(new Event("mjazo:search"))}
              className="hidden sm:flex h-full items-center rounded-full bg-foreground text-background px-5 text-sm hover:bg-brand hover:text-foreground transition-colors"
            >
              {content.find}
            </button>
          </div>
        </motion.div>

        {/* The phone: rises 400px + fades in (template timing), then tilts gently with the pointer */}
        <motion.div
          className="mt-14 sm:mt-12"
          initial={reduce ? false : { opacity: 0, y: TIMING.phoneRise }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: TIMING.phoneDuration, delay: TIMING.phoneDelay, ease: [0, 0, 0.58, 1] }}
          onAnimationComplete={() => setLanded(true)}
          style={{ perspective: 1400 }}
        >
          <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}>
            <PhoneDevice width={width} />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: landed ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-5 text-center text-xs text-zinc-500"
          >
            It's live. Tap around, add a service, try the search.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
