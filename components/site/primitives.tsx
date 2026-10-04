"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, ArrowUpRight, type LucideIcon, Sparkles, Scissors, Palette, Hand, Flower2, User, SprayCan, Sofa, Droplets, Sun, Car, Bug, AirVent, WashingMachine, BatteryCharging, Zap, ShowerHead, Hammer, PaintRoller, Stethoscope, Baby, Truck, Wrench, CalendarCheck, Wallet, ShieldCheck, RefreshCw, BadgeCheck, UserCheck, PackageCheck, MapPin, PhoneCall, Users, GraduationCap, Clock, Star, Heart, Gift, Building2, Crown, MessageCircle } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { Status } from "@/lib/catalog"

export const EASE = [0.25, 0.46, 0.45, 0.94] as const

export const ICONS: Record<string, LucideIcon> = { Sparkles, Scissors, Palette, Hand, Flower2, User, SprayCan, Sofa, Droplets, Sun, Car, Bug, AirVent, WashingMachine, BatteryCharging, Zap, ShowerHead, Hammer, PaintRoller, Stethoscope, Baby, Truck, Wrench, CalendarCheck, Wallet, ShieldCheck, RefreshCw, BadgeCheck, UserCheck, PackageCheck, MapPin, PhoneCall, Users, GraduationCap, Clock, Star, Heart, Gift, Building2, Crown, MessageCircle }

// ---------------------------------------------------------------------------
// Icon by name (catalogue stores icon names as strings)
// ---------------------------------------------------------------------------
export function Icon({ name, className, strokeWidth = 1.5 }: { name: string; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? Sparkles
  return <C className={className} strokeWidth={strokeWidth} />
}

// ---------------------------------------------------------------------------
// Pill buttons: the template's signature button, fill-from-right + arrow swap
// ---------------------------------------------------------------------------
type PillProps = {
  href?: string
  children: ReactNode
  variant?: "solid" | "outline" | "brand" | "light"
  className?: string
  onClick?: () => void
  type?: "button" | "submit"
  disabled?: boolean
  size?: "md" | "lg"
}

export function Pill({ href, children, variant = "solid", className, onClick, type = "button", disabled, size = "md" }: PillProps) {
  const styles = {
    solid: { wrap: "bg-foreground text-background border-foreground", fill: "bg-brand", text: "group-hover:text-foreground", knob: "bg-background text-foreground" },
    brand: { wrap: "bg-brand text-foreground border-brand", fill: "bg-foreground", text: "group-hover:text-background", knob: "bg-foreground text-background" },
    outline: { wrap: "border-zinc-300 text-foreground", fill: "bg-foreground", text: "group-hover:text-background", knob: "text-foreground group-hover:text-background" },
    light: { wrap: "border-white/40 text-white", fill: "bg-white", text: "group-hover:text-foreground", knob: "text-white group-hover:text-foreground" },
  }[variant]
  const inner = (
    <>
      <span className={cn("absolute inset-0 rounded-full scale-x-0 origin-right group-hover:scale-x-100 transition-transform duration-300", styles.fill)} />
      <span className={cn("relative z-10 pr-3 transition-colors duration-300 whitespace-nowrap", size === "lg" ? "text-base" : "text-sm", styles.text)}>{children}</span>
      <span className={cn("relative z-10 rounded-full flex items-center justify-center transition-colors duration-300", size === "lg" ? "w-10 h-10" : "w-8 h-8", variant === "solid" || variant === "brand" ? styles.knob : "", variant !== "solid" && variant !== "brand" ? styles.knob : "")}>
        <ArrowRight className="w-4 h-4 absolute group-hover:opacity-0 transition-opacity duration-300" />
        <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </span>
    </>
  )
  const cls = cn(
    "relative inline-flex items-center border rounded-full pl-5 pr-1 py-1 group overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none",
    size === "lg" && "pl-6 pr-1.5 py-1.5",
    styles.wrap,
    className,
  )
  if (href) {
    const external = href.startsWith("http")
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>{inner}</a>
    ) : (
      <Link href={href} className={cls} onClick={onClick}>{inner}</Link>
    )
  }
  return <button type={type} className={cls} onClick={onClick} disabled={disabled}>{inner}</button>
}

// ---------------------------------------------------------------------------
// Reveal on scroll (600ms, standard ease, once)
// ---------------------------------------------------------------------------
export function Reveal({ children, delay = 0, y = 24, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "li" | "section" }) {
  const reduce = useReducedMotion()
  const M = motion[as]
  return (
    <M
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </M>
  )
}

// ---------------------------------------------------------------------------
// Letter-by-letter headline reveal (from the template): blur + rotateX, 40ms/char
// ---------------------------------------------------------------------------
export function SplitText({ text, delay = 0, className, inView = false }: { text: string; delay?: number; className?: string; inView?: boolean }) {
  const reduce = useReducedMotion()
  let i = 0
  const anim = inView ? { whileInView: "visible", viewport: { once: true } } : { animate: "visible" }
  return (
    <motion.span className={cn("inline-block", className)} initial="hidden" {...anim} style={{ perspective: 400 }} aria-label={text}>
      {text.split(" ").flatMap((word, wi, arr) =>
        // Long hyphenated words ("Gulistan-e-Jauhar") may wrap after each hyphen on small screens.
        word.split(/(?<=-)/).map((seg, si, segs) => (
        <span key={`${wi}-${si}`} aria-hidden className="inline-block whitespace-nowrap">
          {seg.split("").map((ch, ci) => {
            const idx = i++
            return (
              <motion.span
                key={ci}
                className="inline-block"
                style={{ transformStyle: "preserve-3d", transformOrigin: "center bottom" }}
                variants={{
                  hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 30, filter: "blur(12px)", rotateX: -45 },
                  visible: { opacity: 1, y: 0, filter: "blur(0px)", rotateX: 0, transition: { duration: 0.6, delay: delay + idx * 0.04, ease: EASE } },
                }}
              >
                {ch}
              </motion.span>
            )
          })}
          {si === segs.length - 1 && wi < arr.length - 1 && " "}
        </span>
      )))}
    </motion.span>
  )
}

// ---------------------------------------------------------------------------
// Giant pale background word behind sections
// ---------------------------------------------------------------------------
export function BgWord({ word, className }: { word: string; className?: string }) {
  return (
    <div aria-hidden className={cn("absolute left-0 right-0 flex justify-center z-0 overflow-hidden", className)}>
      <span className="bg-word text-[20vw] sm:text-[18vw] md:text-[16vw] lg:text-[14vw]">{word}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------
export function StatusChip({ status, className, liveLabel = "Available now" }: { status: Status; className?: string; liveLabel?: string }) {
  if (status === "live")
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand-ink", className)}>
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand" />
        {liveLabel}
      </span>
    )
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      Coming soon
    </span>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4", className)}>{children}</p>
}

export function SectionTitle({ eyebrow, title, sub, center, className }: { eyebrow?: string; title: string; sub?: string; center?: boolean; className?: string }) {
  return (
    <Reveal className={cn("mb-10 md:mb-16", center && "text-center", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className={cn("font-serif text-[clamp(2rem,8vw,3rem)] font-normal leading-[1.05] text-balance", center && "mx-auto max-w-3xl")}>{title}</h2>
      {sub && <p className={cn("mt-5 text-muted-foreground leading-relaxed max-w-2xl", center && "mx-auto")}>{sub}</p>}
    </Reveal>
  )
}

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("max-w-7xl 2xl:max-w-[1400px] mx-auto px-4 sm:px-6", className)} {...props} />
}
