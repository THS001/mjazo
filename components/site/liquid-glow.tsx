"use client"

// Liquid light for dark cards: soft saffron / amber / rose blobs drifting on independent,
// unsynchronised loops (no visible repeat), blended with `screen` so overlaps brighten like
// light through liquid. Blobs are irregular shapes that rotate + stretch, so they appear to
// morph while only `transform` animates (GPU-cheap, the blur is rasterised once). A fifth blob
// eases toward the pointer. Animations pause offscreen and stop for reduced-motion users.

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

const BLOBS = [
  // [size (% of card width), top %, right %, colour, opacity, blur px, animation]
  { size: 78, top: -28, right: -26, color: "radial-gradient(circle at 35% 35%, #ffd27a 0%, #f4a437 45%, #c97d1c 100%)", opacity: 0.62, blur: 42, anim: "liquid-a 16s ease-in-out infinite" },
  { size: 62, top: -2, right: 6, color: "radial-gradient(circle at 60% 40%, #f3a35a 0%, #e8914a 50%, #b85a24 100%)", opacity: 0.45, blur: 52, anim: "liquid-b 21s ease-in-out infinite" },
  { size: 52, top: 26, right: -14, color: "radial-gradient(circle at 50% 50%, #f08a8a 0%, #e86f6f 55%, #a8414d 100%)", opacity: 0.28, blur: 56, anim: "liquid-c 26s ease-in-out infinite" },
  { size: 30, top: -4, right: 4, color: "radial-gradient(circle at 40% 40%, #fff5d6 0%, #f7d9a0 60%, #f4a437 100%)", opacity: 0.42, blur: 26, anim: "liquid-a 12s ease-in-out -5s infinite reverse" },
]

const SHAPES = ["42% 58% 63% 37% / 41% 44% 56% 59%", "58% 42% 35% 65% / 52% 61% 39% 48%", "37% 63% 51% 49% / 63% 35% 65% 37%", "50% 50% 40% 60% / 45% 55% 45% 55%"]

export function LiquidGlow({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  // Pointer-following blob (rests near the top-right corner).
  const mx = useMotionValue(0.82)
  const my = useMotionValue(0.12)
  const sx = useSpring(mx, { stiffness: 35, damping: 14 })
  const sy = useSpring(my, { stiffness: 35, damping: 14 })
  const left = useTransform(sx, (v) => `${v * 100}%`)
  const top = useTransform(sy, (v) => `${v * 100}%`)

  useEffect(() => {
    const el = ref.current
    const card = el?.parentElement
    if (!el || !card) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" })
    io.observe(el)
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      const r = card.getBoundingClientRect()
      mx.set((e.clientX - r.left) / r.width)
      my.set((e.clientY - r.top) / r.height)
    }
    const leave = () => {
      mx.set(0.82)
      my.set(0.12)
    }
    card.addEventListener("pointermove", move)
    card.addEventListener("pointerleave", leave)
    return () => {
      io.disconnect()
      card.removeEventListener("pointermove", move)
      card.removeEventListener("pointerleave", leave)
    }
  }, [mx, my])

  return (
    <div ref={ref} aria-hidden className={cn("liquid-glow pointer-events-none absolute inset-0 overflow-hidden", !visible && "liquid-paused", className)}>
      {BLOBS.map((b, i) => (
        <span
          key={i}
          className="absolute aspect-square mix-blend-screen"
          style={{
            width: `${b.size}%`,
            top: `${b.top}%`,
            right: `${b.right}%`,
            background: b.color,
            opacity: b.opacity,
            filter: `blur(${b.blur}px)`,
            borderRadius: SHAPES[i % SHAPES.length],
            animation: b.anim,
            willChange: "transform",
          }}
        />
      ))}
      <motion.span
        className="absolute aspect-square w-[42%] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
        style={{ left, top, background: "radial-gradient(circle, #f4a437 0%, rgba(244,164,55,0) 70%)", opacity: 0.5, filter: "blur(30px)", borderRadius: SHAPES[1], willChange: "transform" }}
      />
      {/* Fine grain for a printed, premium finish */}
      <span className="absolute inset-0 opacity-[0.09] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
    </div>
  )
}
