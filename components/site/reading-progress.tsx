"use client"

import { motion, useScroll, useSpring } from "framer-motion"

export function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  return <motion.div aria-hidden className="fixed top-0 inset-x-0 h-1 bg-brand origin-left z-[60]" style={{ scaleX: x }} />
}
