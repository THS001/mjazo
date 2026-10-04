"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"

// Marigold & rose petals drift down for ~6s on load, then settle (fade out).
const COLORS = ["#f4a437", "#f39c3d", "#e86f6f", "#f3c7c7", "#f7d36b"]
const rand = (i: number, s: number) => {
  const x = Math.sin(i * 9301 + s * 49297) * 233280
  return x - Math.floor(x)
}

export function Petals({ count = 48 }: { count?: number }) {
  const reduce = useReducedMotion()
  const [on, setOn] = useState(false)
  useEffect(() => setOn(true), [])
  if (!on || reduce) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const left = rand(i, 1) * 100
        const size = 10 + rand(i, 2) * 14
        const delay = rand(i, 3) * 2.5
        const dur = 3.5 + rand(i, 4) * 2.5
        const drift = (rand(i, 5) - 0.5) * 160
        return (
          <motion.span
            key={i}
            className="absolute -top-8 block"
            style={{ left: `${left}%`, width: size, height: size * 0.62, background: COLORS[i % COLORS.length], borderRadius: "70% 0 70% 0" }}
            initial={{ y: -40, x: 0, rotate: rand(i, 6) * 180, opacity: 0 }}
            animate={{ y: "110vh", x: drift, rotate: rand(i, 6) * 180 + 540, opacity: [0, 1, 1, 0] }}
            transition={{ duration: dur, delay, ease: "easeIn", times: [0, 0.1, 0.8, 1] }}
          />
        )
      })}
    </div>
  )
}
