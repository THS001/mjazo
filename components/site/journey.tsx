"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"
import { EASE } from "./primitives"

/**
 * Pinned scroll journey: the section pins for (steps × 70vh); a progress line fills and
 * each step lights up in turn. Falls back to a plain list on small screens.
 */
export function Journey({ steps, dark, label }: { steps: { title: string; body: string }[]; dark?: boolean; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(steps.length - 1, Math.floor(v * steps.length))))
  const fill = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])
  // Pin only where there is room (tablet/desktop with enough height); otherwise a plain list.
  const [pin, setPin] = useState(false)
  useEffect(() => {
    const f = () => setPin(window.innerWidth >= 768 && window.innerHeight >= 600)
    f()
    window.addEventListener("resize", f)
    return () => window.removeEventListener("resize", f)
  }, [])

  return (
    <>
      {/* Desktop: pinned */}
      <div ref={ref} className={cn("relative", pin ? "block" : "hidden")} style={{ height: `${steps.length * 70 + 30}svh` }}>
        <div className="sticky top-0 h-[100svh] flex items-center">
          <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-[1fr_1.2fr] gap-16 items-center">
            <div>
              <p className={cn("text-xs uppercase tracking-[0.2em] mb-4", dark ? "text-white/50" : "text-zinc-500")}>{label}</p>
              <motion.p key={active} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className="font-serif text-[clamp(6rem,14vw,9rem)] leading-none text-brand">
                0{active + 1}
              </motion.p>
              <motion.h3 key={`t${active}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05, ease: EASE }} className="font-serif text-5xl mt-4">
                {steps[active].title}
              </motion.h3>
              <motion.p key={`b${active}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.1 }} className={cn("mt-4 text-lg max-w-md", dark ? "text-white/65" : "text-zinc-600")}>
                {steps[active].body}
              </motion.p>
            </div>
            <div className="relative ps-10">
              <div className={cn("absolute start-3 top-2 bottom-2 w-px", dark ? "bg-white/15" : "bg-zinc-200")}>
                <motion.div className="w-full bg-brand origin-top" style={{ height: fill }} />
              </div>
              <ol className="space-y-6">
                {steps.map((s, i) => (
                  <li key={s.title} className="relative">
                    <span className={cn("absolute -start-[34px] top-1.5 w-4 h-4 rounded-full border-2 transition-colors duration-300", i <= active ? "bg-brand border-brand" : dark ? "bg-transparent border-white/30" : "bg-white border-zinc-300")} />
                    <p className={cn("text-2xl transition-colors duration-300", i === active ? (dark ? "text-white" : "text-black") : dark ? "text-white/30" : "text-zinc-300")}>{s.title}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: simple list */}
      <ol className={cn("px-4 space-y-8 max-w-3xl mx-auto", pin ? "hidden" : "block")}>
        {steps.map((s, i) => (
          <motion.li key={s.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="flex gap-5">
            <span className="font-serif text-5xl text-brand leading-none">0{i + 1}</span>
            <span>
              <span className="block font-serif text-3xl">{s.title}</span>
              <span className={cn("block mt-2", dark ? "text-white/65" : "text-zinc-600")}>{s.body}</span>
            </span>
          </motion.li>
        ))}
      </ol>
    </>
  )
}
