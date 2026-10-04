"use client"

import { motion, useReducedMotion } from "framer-motion"

/** A heartbeat line that draws itself across the hero, then keeps a gentle travelling pulse. */
export function PulseLine() {
  const reduce = useReducedMotion()
  const d = "M0 60 H260 L285 60 L300 20 L318 100 L336 40 L350 60 H620 L640 60 L652 35 L666 85 L678 60 H1000 L1022 60 L1036 10 L1054 110 L1072 30 L1086 60 H1440"
  return (
    <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute left-0 right-0 top-24 sm:top-28 w-full h-24 sm:h-28 opacity-70">
      <path d={d} fill="none" stroke="#cfe6dc" strokeWidth="2" />
      <motion.path
        d={d}
        fill="none"
        stroke="#2f6f5e"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
      {!reduce && (
        <motion.path
          d={d}
          fill="none"
          stroke="#f4a437"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0.06, pathOffset: 0 }}
          animate={{ pathOffset: [0, 1] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "linear", delay: 2.2 }}
        />
      )}
    </svg>
  )
}
