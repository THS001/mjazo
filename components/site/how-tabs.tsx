"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BadgeCheck, CalendarClock, ClipboardCheck, GraduationCap, MapPin, Search, Sparkles, Star, UserCheck, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { EASE, Pill } from "./primitives"

const ICONS = {
  customers: [MapPin, Search, CalendarClock, UserCheck, Star],
  pros: [ClipboardCheck, BadgeCheck, GraduationCap, Sparkles, Wallet],
}

type Step = { title: string; body: string }
type Props = { tabs: { customers: string; pros: string }; customers: Step[]; pros: Step[]; customersCta: { label: string; href: string }; prosCta: { label: string; href: string } }

export function HowTabs({ tabs, customers, pros, customersCta, prosCta }: Props) {
  const [tab, setTab] = useState<"customers" | "pros">("customers")
  const flows = { customers, pros }
  return (
    <div>
      <div className="flex justify-center mb-14">
        <div className="relative inline-flex rounded-full bg-zinc-100 p-1">
          {(["customers", "pros"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("relative z-10 h-11 px-6 rounded-full text-sm transition-colors", tab === t ? "text-background" : "text-zinc-600")}>
              {tab === t && <motion.span layoutId="how-pill" className="absolute inset-0 -z-10 rounded-full bg-foreground" transition={{ duration: 0.35, ease: EASE }} />}
              {tabs[t]}
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.ol key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35, ease: EASE }} className="grid md:grid-cols-5 gap-4">
          {flows[tab].map((s, i) => {
            const StepIcon = ICONS[tab][i] ?? Sparkles
            return (
            <li key={i} className="relative rounded-3xl border border-zinc-200 p-6 pt-20 overflow-hidden">
              <span className="absolute top-3 right-4 font-serif text-7xl text-black/[0.06] leading-none">{i + 1}</span>
              <span className="absolute top-6 left-6 w-11 h-11 rounded-2xl bg-brand-soft flex items-center justify-center"><StepIcon className="w-5 h-5" strokeWidth={1.5} /></span>
              <p className="font-medium text-lg">{s.title}</p>
              <p className="text-sm text-zinc-500 mt-2">{s.body}</p>
            </li>
            )
          })}
        </motion.ol>
      </AnimatePresence>
      <div className="flex justify-center mt-12">
        {tab === "customers" ? <Pill href={customersCta.href}>{customersCta.label}</Pill> : <Pill href={prosCta.href}>{prosCta.label}</Pill>}
      </div>
    </div>
  )
}
