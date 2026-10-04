"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { EASE } from "./primitives"

/** Fade-up on mount (for hero content, which is already in view). */
export function HeroReveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} initial={{ opacity: 0, y: reduce ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay, ease: EASE }}>
      {children}
    </motion.div>
  )
}
