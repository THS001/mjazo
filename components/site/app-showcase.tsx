"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { PhoneDevice } from "@/components/home/phone-device"
import { EASE } from "./primitives"

/** The live, tappable phone (same app as the home hero), rising in with a soft glow. */
export function AppShowcase() {
  const [w, setW] = useState(320)
  useEffect(() => {
    const f = () => setW(window.innerWidth < 640 ? Math.min(300, window.innerWidth - 48) : 330)
    f()
    window.addEventListener("resize", f)
    return () => window.removeEventListener("resize", f)
  }, [])
  return (
    <motion.div className="relative flex justify-center" initial={{ opacity: 0, y: 120 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.3, ease: EASE }}>
      <div className="absolute inset-x-10 top-1/4 bottom-0 rounded-full bg-brand/40 blur-3xl" />
      <div className="relative">
        <PhoneDevice width={w} />
      </div>
    </motion.div>
  )
}
