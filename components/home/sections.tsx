"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion"
import { ArrowUpRight, BadgeCheck, CalendarClock, Check, Clock, Lock, MapPin, ShieldCheck, Sparkles, Star, UserCheck } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { BgWord, Container, EASE, Icon, Pill, Reveal, SectionTitle, StatusChip } from "@/components/site/primitives"
import { ServiceCard } from "@/components/site/service-card"
import { LiquidGlow } from "@/components/site/liquid-glow"
import { MapCanvas } from "@/components/three"
import { cn } from "@/lib/utils"
import { useCatalog } from "@/components/cms/provider"
import type { HomeContent } from "@/lib/cms/types/pages/home"
import { CmsImage, isImage } from "@/components/cms/image"

// ---------------------------------------------------------------------------
// Stats: count-up, true numbers only
// ---------------------------------------------------------------------------
function useCountUp(end: number, run: boolean, duration = 2000) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) return
    let raf = 0
    let start = 0
    const step = (t: number) => {
      if (!start) start = t
      const p = Math.min((t - start) / duration, 1)
      setV(Math.floor((1 - Math.pow(1 - p, 4)) * end))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [end, run, duration])
  return v
}

export function Stats({ labels }: { labels: HomeContent["stats"] }) {
  const { areas, serviceCount, visibleCategories } = useCatalog()
  const ref = useRef<HTMLDivElement>(null)
  const [run, setRun] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setRun(true), { threshold: 0.3 })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  const stats = [
    { n: useCountUp(areas.length, run), s: "", label: labels.areas },
    { n: useCountUp(visibleCategories.length, run), s: "", label: labels.categories },
    { n: useCountUp(Math.floor(serviceCount / 10) * 10, run), s: "+", label: labels.services },
    { n: useCountUp(100, run), s: "%", label: labels.verified },
  ]
  return (
    <section ref={ref} className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 sm:gap-10">
        {stats.map((s, i) => (
          <div key={i} className={cn("text-center transition-all duration-1000", run ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")} style={{ transitionDelay: `${200 + i * 100}ms` }}>
            <p className="font-light text-5xl sm:text-6xl md:text-7xl leading-none mb-2">{s.n}{s.s}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Worlds grid
// ---------------------------------------------------------------------------
export function WorldsGrid({ content: c }: { content: HomeContent["worlds"] }) {
  const { categories, categoriesOf, worlds, worldStatus } = useCatalog()
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden" id="services">
      <BgWord word="SERVICES" className="top-0" />
      <Container className="relative z-10">
        <SectionTitle eyebrow={c.eyebrow} title={c.title} sub={c.sub} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {worlds.map((w, i) => {
            const live = worldStatus(w.slug) === "live"
            return (
              <Reveal key={w.slug} delay={i * 0.06}>
                <Link href={`/services/w/${w.slug}`} className={cn("group relative block rounded-3xl p-5 sm:p-6 overflow-hidden h-full min-h-44 sm:min-h-56 transition-all duration-500 hover:-translate-y-1")} style={{ background: w.tint }}>
                  {isImage(w.image) ? (
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden transition-transform duration-700 group-hover:scale-110">
                      <CmsImage img={w.image} sizes="160px" />
                    </div>
                  ) : (
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-white/40 flex items-center justify-center transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12">
                      <Icon name={w.icon} className="w-14 h-14 sm:w-16 sm:h-16 text-black/70" strokeWidth={1} />
                    </div>
                  )}
                  <div className="relative">
                    {live ? <StatusChip status="live" liveLabel={c.live} className="mb-3 bg-white/80" /> : <span className="inline-block mb-3 text-[11px] rounded-full bg-white/60 px-2.5 py-1 text-zinc-600">{c.soon}</span>}
                    <h3 className="text-lg sm:text-xl font-medium leading-tight">{w.name}</h3>
                    <p className="text-xs sm:text-sm text-black/60 mt-1 max-w-[70%]">{w.short}</p>
                    <p className="text-[11px] text-black/50 mt-3">{categoriesOf(w.slug).length} categories</p>
                  </div>
                  <ArrowUpRight className="absolute top-5 right-5 w-5 h-5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Link>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Most-booked: auto-scroll row at 35px/s, pauses on hover (template behaviour)
// ---------------------------------------------------------------------------
export function MostBooked({ content: c }: { content: HomeContent["mostBooked"] }) {
  const { allServices } = useCatalog()
  const items = allServices.filter((x) => x.category.status === "live" && x.category.world === "beauty-wellness" && x.service.popular).slice(0, 12)
  const track = useRef<HTMLDivElement>(null)
  const paused = useRef(false)
  const [touch, setTouch] = useState(false)
  useEffect(() => setTouch(window.matchMedia("(hover: none) and (pointer: coarse)").matches), [])

  // Desktop: auto-scroll at 35px/s, pausing on hover without losing its place.
  useEffect(() => {
    if (touch || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    let last = 0
    let x = 0
    const step = (t: number) => {
      const el = track.current
      if (el && !paused.current) {
        const dt = last ? Math.min((t - last) / 1000, 0.05) : 0
        x += dt * 35
        const half = el.scrollWidth / 2
        if (x >= half) x -= half
        el.style.transform = `translateX(${-x}px)`
      }
      last = t
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [touch])

  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <BgWord word="GLOW" className="top-6" />
      <Container className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
        <SectionTitle eyebrow={c.eyebrow} title={c.title} sub={c.sub || undefined} className="mb-0 md:mb-0" />
        <Pill href={c.cta.href} variant="outline" className="self-start md:self-auto">{c.cta.label}</Pill>
      </Container>
      {touch ? (
        // Touch: a native swipeable row that snaps card by card.
        <div className="relative z-10 flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar px-4 scroll-px-4 pb-2">
          {items.map(({ category, service }) => (
            <ServiceCard key={service.slug} category={category} service={service} className="w-[78vw] max-w-[290px] shrink-0 snap-start" />
          ))}
        </div>
      ) : (
        <div className="relative z-10" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
          <div ref={track} className="flex gap-4 w-max will-change-transform px-4">
            {[...items, ...items].map(({ category, service }, i) => (
              <ServiceCard key={`${service.slug}-${i}`} category={category} service={service} className="w-[260px] sm:w-[290px] shrink-0" />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// How it works: sticky scroll scene (4 steps scrubbed by scroll)
// ---------------------------------------------------------------------------
const STEP_ICONS = [Sparkles, CalendarClock, UserCheck, Star]

export function HowItWorks({ content: c }: { content: HomeContent["how"] }) {
  const STEPS = c.steps.slice(0, 4).map((s, i) => ({ ...s, icon: STEP_ICONS[i] ?? Sparkles }))
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const [step, setStep] = useState(0)
  const [short, setShort] = useState(false)
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.min(3, Math.floor(v * 4))))
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])
  // Very short screens (landscape phones) get a plain stacked layout instead of the pinned scene.
  useEffect(() => {
    const f = () => setShort(window.innerHeight < 560)
    f()
    window.addEventListener("resize", f)
    return () => window.removeEventListener("resize", f)
  }, [])

  if (short)
    return (
      <section className="py-16" id="how-it-works">
        <Container>
          <SectionTitle eyebrow={c.eyebrow} title={c.title} sub={c.sub || undefined} />
          <ol className="grid sm:grid-cols-2 gap-4">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-4 rounded-3xl border border-zinc-200 p-5">
                <span className="font-serif text-3xl text-brand-ink leading-none">0{i + 1}</span>
                <span><span className="block font-medium">{s.title}</span><span className="block text-sm text-zinc-500 mt-1">{s.body}</span></span>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    )

  return (
    <section ref={ref} className="relative h-[300svh]" id="how-it-works">
      <div className="sticky top-0 h-[100svh] flex items-center overflow-hidden pt-20 pb-6 lg:pt-0 lg:pb-0">
        <BgWord word="EASY" className="top-1/2 -translate-y-1/2" />
        <Container className="relative z-10 grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-20 items-center w-full">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 sm:mb-4">{c.eyebrow}</p>
            <div className="grid">
              {STEPS.map((s, i) => (
                <motion.div key={i} className="col-start-1 row-start-1" animate={{ opacity: step === i ? 1 : 0, y: step === i ? 0 : step > i ? -24 : 24 }} transition={{ duration: 0.4, ease: EASE }} aria-hidden={step !== i}>
                  <p className="font-serif text-brand-ink text-xl sm:text-2xl mb-2">0{i + 1}</p>
                  <h2 className="font-serif text-[clamp(2.25rem,9vw,3.75rem)] leading-[1.02] mb-3 sm:mb-4">{s.title}</h2>
                  <p className="text-muted-foreground text-base sm:text-lg max-w-md">{s.body}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 sm:mt-8 h-1 w-full max-w-md rounded-full bg-zinc-100 overflow-hidden"><motion.div className="h-full bg-foreground" style={{ width: bar }} /></div>
          </div>
          <div className="relative aspect-square w-full max-w-[min(28rem,34svh)] lg:max-w-md mx-auto">
            {/* Cut-away "home" diorama: rooms light up per step */}
            <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-cream border border-zinc-200 p-3 sm:p-6 grid grid-cols-2 grid-rows-2 gap-2.5 sm:gap-4">
              {STEPS.map((s, i) => (
                <motion.div
                  key={i}
                  className="rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center gap-2 sm:gap-3 border"
                  animate={{
                    backgroundColor: step >= i ? "oklch(0.95 0.06 80)" : "oklch(0.98 0 0)",
                    borderColor: step === i ? "oklch(0.78 0.15 70)" : "oklch(0.9 0 0)",
                    scale: step === i ? 1.04 : 1,
                  }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <s.icon className={cn("w-7 h-7 sm:w-10 sm:h-10 transition-colors", step >= i ? "text-black" : "text-zinc-300")} strokeWidth={1.2} />
                  <span className={cn("text-[11px] sm:text-xs transition-colors", step >= i ? "text-black" : "text-zinc-400")}>Step {i + 1}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </Container>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Live booking tracker card (replaces the template's realtime dashboard)
// ---------------------------------------------------------------------------
function TrackerCard({ t }: { t: HomeContent["trust"]["tracker"] }) {
  const CHECKS = t.checks
  const [eta, setEta] = useState(14)
  const [done, setDone] = useState(2)
  useEffect(() => {
    const a = setInterval(() => setEta((e) => (e <= 1 ? 14 : e - 1)), 1500)
    const b = setInterval(() => setDone((d) => (d >= CHECKS.length ? 1 : d + 1)), 1500)
    return () => {
      clearInterval(a)
      clearInterval(b)
    }
  }, [])
  return (
    <div className="rounded-[2rem] bg-white border border-zinc-200 p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)] max-w-md w-full mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-zinc-500">{t.when}</p>
          <p className="font-medium">{t.booking}</p>
        </div>
        <span className="rounded-full bg-brand-soft text-brand-ink text-xs px-3 py-1 flex items-center gap-1.5"><span className="live-dot w-1.5 h-1.5 rounded-full bg-brand" />{t.live}</span>
      </div>
      <div className="rounded-2xl bg-zinc-50 p-4 flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-[#f6d9cf] flex items-center justify-center"><BadgeCheck className="w-6 h-6" strokeWidth={1.5} /></div>
        <div className="flex-1">
          <p className="text-sm font-medium">{t.pro}</p>
          <p className="text-xs text-zinc-500">{t.proLine}</p>
        </div>
        <div className="text-right">
          <motion.p key={eta} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-light">{eta}</motion.p>
          <p className="text-[11px] text-zinc-500 uppercase">min away</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden mb-5"><div className="h-full bg-brand transition-all duration-1000" style={{ width: `${((14 - eta) / 14) * 100}%` }} /></div>
      <ul className="space-y-2.5">
        {CHECKS.map((c, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm">
            <span className={cn("w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-500", i < done ? "bg-foreground text-background" : "bg-zinc-100 text-transparent")}><Check className="w-3 h-3" strokeWidth={3} /></span>
            <span className={cn("transition-colors duration-500", i < done ? "text-black" : "text-zinc-400")}>{c}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TrustTracker({ content: c }: { content: HomeContent["trust"] }) {
  return (
    <section className="relative py-20 sm:py-32 overflow-hidden">
      <BgWord word="TRUST" className="top-1/2 -translate-y-1/2" />
      <Container className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
        <div className="order-2 lg:order-1"><TrackerCard t={c.tracker} /></div>
        <div className="order-1 lg:order-2 space-y-8">
          <Reveal>
            <h2 className="font-serif text-4xl md:text-5xl text-balance mb-6">{c.title}</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">{c.body}</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-3">
            {c.features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }} className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5" strokeWidth={2.5} /></span>
                <span className="text-sm">{f}</span>
              </motion.div>
            ))}
          </div>
          <Pill href={c.cta.href} variant="outline">{c.cta.label}</Pill>
        </div>
      </Container>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Bundles bento
// ---------------------------------------------------------------------------
export function BundlesBento({ content: c }: { content: HomeContent["bundles"] }) {
  const { bundles, getService } = useCatalog()
  const live = bundles.filter((b) => b.status === "live")
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <SectionTitle eyebrow={c.eyebrow} title={c.title} sub={c.sub || undefined} />
        <div className="grid md:grid-cols-3 md:grid-rows-2 gap-4">
          {live.map((b, i) => {
            const hero = b.slug === "full-glow"
            const full = b.items.reduce((s, it) => s + (getService(it.category, it.service)?.service.price ?? 0), 0)
            return (
              <Reveal key={b.slug} delay={i * 0.08} className={cn(hero && "md:row-span-2")}>
                <Link href={`/offers#${b.slug}`} className={cn("group relative flex flex-col justify-between h-full rounded-3xl p-7 overflow-hidden transition-transform duration-500 hover:-translate-y-1", hero ? "bg-foreground text-background min-h-80" : "bg-cream border border-zinc-200 min-h-56")}>
                  {hero && <LiquidGlow />}
                  <div className="relative">
                    {hero && <span className="inline-block mb-4 text-[11px] rounded-full bg-brand text-foreground px-2.5 py-1">{c.heroBadge}</span>}
                    <h3 className={cn("font-serif", hero ? "text-4xl md:text-5xl" : "text-2xl")}>{b.name}</h3>
                    <p className={cn("mt-2 text-sm", hero ? "text-white/70" : "text-zinc-500")}>{b.note}</p>
                  </div>
                  <div className="relative flex items-end justify-between mt-6">
                    <div>
                      {full > b.price && <p className={cn("text-xs line-through", hero ? "text-white/50" : "text-zinc-400")}>{formatPKR(full)}</p>}
                      <p className={cn(hero ? "text-2xl" : "text-lg", "font-medium")}>{formatPKR(b.price)}</p>
                    </div>
                    <ArrowUpRight className="w-5 h-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Areas with the 3D map
// ---------------------------------------------------------------------------
export function AreasTeaser({ content: c }: { content: HomeContent["areas"] }) {
  const { liveAreas } = useCatalog()
  return (
    <section className="py-16 sm:py-24">
      <Container className="grid lg:grid-cols-5 gap-10 items-center">
        <div className="lg:col-span-2">
          <SectionTitle eyebrow={c.eyebrow} title={c.title} sub={c.sub} className="mb-8 md:mb-8" />
          <div className="flex flex-wrap gap-2 mb-8">
            {liveAreas.map((a) => (
              <Link key={a.slug} href={`/karachi/${a.slug}`} className="flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-sm"><MapPin className="w-3.5 h-3.5" />{a.name}</Link>
            ))}
            <Link href="/karachi" className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:border-black">{c.allAreas}</Link>
          </div>
          <Pill onClick={() => window.dispatchEvent(new Event("mjazo:location"))}>{c.checkArea}</Pill>
        </div>
        <MapCanvas
          className="lg:col-span-3 h-[380px] sm:h-[460px] rounded-[2.5rem] bg-cream border border-zinc-200 overflow-hidden"
          fallback={<div className="w-full h-full flex items-center justify-center text-zinc-400"><MapPin className="w-12 h-12" strokeWidth={1} /></div>}
        />
      </Container>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Promises marquee (two rows, opposite directions).
// ---------------------------------------------------------------------------
function Row({ items, reverse }: { items: string[]; reverse?: boolean }) {
  return (
    <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <motion.div className="flex gap-3 pr-3 shrink-0" animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }} transition={{ duration: 40, ease: "linear", repeat: Infinity }}>
        {[...items, ...items].map((t, i) => (
          <span key={i} className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-ink" strokeWidth={1.5} />{t}</span>
        ))}
      </motion.div>
    </div>
  )
}

export function Promises({ content: c }: { content: HomeContent["promises"] }) {
  return (
    <section className="py-16 sm:py-24 overflow-hidden">
      <Container>
        <SectionTitle eyebrow={c.eyebrow} title={c.title} sub={c.sub} center />
      </Container>
      <div className="space-y-3">
        <Row items={c.rowA} />
        <Row items={c.rowB} reverse />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------------
export function FinalCTA({ content: c }: { content: HomeContent["final"] }) {
  return (
    <section className="relative py-20 sm:py-32 overflow-hidden">
      <BgWord word="RELAX" className="top-1/2 -translate-y-1/2" />
      <Container className="relative z-10 text-center">
        <Reveal>
          <h2 className="font-serif text-5xl md:text-7xl max-w-4xl mx-auto text-balance mb-6">{c.title}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-10">{c.sub}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Pill href={c.primary.href} size="lg">{c.primary.label}</Pill>
            <Pill href={c.secondary.href} variant="outline" size="lg">{c.secondary.label}</Pill>
          </div>
          <div className="flex justify-center gap-6 mt-12 text-xs text-zinc-500">
            {c.notes.slice(0, 3).map((n, i) => {
              const NoteIcon = [Lock, Clock, BadgeCheck][i]
              return <span key={i} className="flex items-center gap-1.5"><NoteIcon className="w-3.5 h-3.5" />{n}</span>
            })}
          </div>
        </Reveal>
      </Container>
    </section>
  )
}

