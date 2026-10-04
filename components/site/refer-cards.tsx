"use client"

import { motion } from "framer-motion"
import { formatPKR } from "@/lib/catalog"
import { EASE } from "./primitives"
import { useSite } from "@/components/cms/provider"

/** Two overlapping invite cards that fan apart on load and on hover. */
export function ReferCards() {
  const { referral } = useSite()
  return (
    <motion.div className="relative h-[320px] sm:h-[380px] flex items-center justify-center" initial="rest" animate="in" whileHover="hover">
      <motion.div
        className="absolute w-60 sm:w-72 aspect-[0.7] rounded-3xl bg-white border border-zinc-200 p-6 shadow-xl flex flex-col justify-between"
        variants={{ rest: { rotate: 0, x: 0, opacity: 0 }, in: { rotate: -8, x: -60, opacity: 1, transition: { delay: 0.6, duration: 0.8, ease: EASE } }, hover: { rotate: -12, x: -80 } }}
      >
        <span className="text-xs tracking-[0.3em] text-zinc-400">FOR YOU</span>
        <div>
          <p className="font-serif text-4xl">{formatPKR(referral.youGet)} credit</p>
          <p className="text-sm text-zinc-500">when your friend books</p>
        </div>
        <span className="font-mono text-sm rounded-full bg-zinc-100 px-3 py-1.5 self-start">AYESHA-GLOW</span>
      </motion.div>
      <motion.div
        className="absolute w-60 sm:w-72 aspect-[0.7] rounded-3xl p-6 shadow-2xl flex flex-col justify-between bg-brand"
        variants={{ rest: { rotate: 0, x: 0, opacity: 0 }, in: { rotate: 6, x: 60, opacity: 1, transition: { delay: 0.8, duration: 0.8, ease: EASE } }, hover: { rotate: 10, x: 80 } }}
      >
        <span className="text-xs tracking-[0.3em] text-black/50">FOR YOUR FRIEND</span>
        <div>
          <p className="font-serif text-4xl">{formatPKR(referral.friendOff)} off</p>
          <p className="text-sm text-black/60">on their first booking</p>
        </div>
        <span className="text-sm">Opens with your link</span>
      </motion.div>
    </motion.div>
  )
}
