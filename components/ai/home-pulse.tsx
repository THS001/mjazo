"use client"

import Link from "@/components/site/locale-link"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CalendarPlus, Check, Loader2, Minus, MessageCircle, Plus, Sparkles, X } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { getBookings } from "@/lib/bookings"
import { karachiNow } from "@/lib/time"
import { DEFAULT_PROFILE, buildPlan, daysBetween, planIcs, type PulseItem, type PulseProfile, type WeatherDay } from "@/lib/pulse"
import { submit, track } from "@/lib/site"
import { useCart } from "@/lib/store"
import { cn } from "@/lib/utils"
import { PK_PHONE, normalisePhone } from "@/components/site/notify-form"
import { inputCls } from "@/components/site/forms"
import { EASE } from "@/components/site/primitives"
import { fill, useCatalog, useLocale } from "@/components/cms/provider"
import { localePath, type Locale } from "@/lib/i18n"
import type { HomePulseText } from "@/lib/cms/types/tool-text/home-pulse"

type Lang = "en" | "ur" | "ro"
const DATE_LOCALE: Record<Locale, string> = { en: "en-GB", ur: "ur-PK" }
const fmtDay = (iso: string, l: Locale) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(DATE_LOCALE[l], { weekday: "short", timeZone: "UTC" })
const fmtMonth = (iso: string, l: Locale) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(DATE_LOCALE[l], { month: "long", year: "numeric", timeZone: "UTC" })

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center justify-between gap-3 w-full py-2.5 text-sm">
      <span>{label}</span>
      <span className={cn("relative w-11 h-6 rounded-full transition-colors", on ? "bg-[#2f6f5e]" : "bg-zinc-300")}>
        <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", on ? "start-[22px]" : "start-0.5")} />
      </span>
    </button>
  )
}

function Rhythm({ label, value, options, onChange, t }: { label: string; value: number; options: number[]; onChange: (v: number) => void; t: HomePulseText["profile"] }) {
  return (
    <div className="py-2">
      <p className="text-sm mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {[0, ...options].map((w) => (
          <button key={w} type="button" aria-pressed={value === w} onClick={() => onChange(w)} className={cn("h-8 px-3 rounded-full text-xs border transition-colors", value === w ? "bg-[#2f6f5e] text-white border-[#2f6f5e]" : "border-zinc-300 bg-white hover:border-zinc-500")}>
            {w === 0 ? t.notForMe : fill(t.every, { weeks: w })}
          </button>
        ))}
      </div>
    </div>
  )
}

export function HomePulse({ t }: { t: HomePulseText }) {
  const { getService } = useCatalog()
  const locale = useLocale()
  const p = t.profile
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<PulseProfile>(DEFAULT_PROFILE)
  const [done, setDone] = useState<string[]>([])
  const [weather, setWeather] = useState<WeatherDay[]>([])
  const [lang, setLang] = useState<Lang>(locale)
  const [ai, setAi] = useState<{ intro: string; lines: Record<string, string> } | null>(null)
  const [aiState, setAiState] = useState<"idle" | "loading" | "off">("idle")
  const [today, setToday] = useState("")
  const [evName, setEvName] = useState("")
  const [evDate, setEvDate] = useState("")
  const [remind, setRemind] = useState({ name: "", phone: "", state: "idle" as "idle" | "loading" | "done", error: "" })
  const [added, setAdded] = useState<string[]>([])
  const add = useCart((s) => s.add)
  const bookings = useRef<{ date: string; items: { category: string; service: string }[] }[]>([])

  useEffect(() => {
    setToday(karachiNow().date)
    bookings.current = getBookings().map((b) => ({ date: b.date, items: b.items.map((i) => ({ category: i.category, service: i.service })) }))
    try {
      const p = JSON.parse(localStorage.getItem("mjazo-pulse") ?? "null")
      if (p) setProfile({ ...DEFAULT_PROFILE, ...p })
      setDone(JSON.parse(localStorage.getItem("mjazo-pulse-done") ?? "[]"))
      const c = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
      setRemind((r) => ({ ...r, name: c.name ?? "", phone: c.phone ?? "" }))
    } catch {}
    fetch("/api/pulse/weather").then((r) => r.json()).then((j) => setWeather(j.days ?? [])).catch(() => {})
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem("mjazo-pulse", JSON.stringify(profile))
      localStorage.setItem("mjazo-pulse-done", JSON.stringify(done))
    } catch {}
  }, [profile, done, ready])

  const plan = useMemo(() => (today ? buildPlan({ profile, bookings: bookings.current, today, weather, text: t.rules }).filter((i) => !done.includes(i.id)) : []), [profile, today, weather, done, t.rules])

  // Personalise the wording with AI (debounced); fall back silently to the rule copy.
  useEffect(() => {
    if (!plan.length || aiState === "off") return
    const timer = setTimeout(async () => {
      setAiState("loading")
      try {
        const res = await fetch("/api/pulse/copy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang, name: remind.name || undefined, items: plan.map(({ id, date, title, why }) => ({ id, date, title, why })) }) })
        if (res.status === 503) return setAiState("off")
        const j = await res.json()
        if (res.ok) setAi({ intro: j.intro, lines: j.lines ?? {} })
        setAiState("idle")
      } catch {
        setAiState("idle")
      }
    }, 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.map((p) => p.id).join(","), lang])

  const set = <K extends keyof PulseProfile>(k: K, v: PulseProfile[K]) => setProfile((p) => ({ ...p, [k]: v }))
  const next = plan[0]
  const soon = plan.filter((p) => p.priority === 1).length
  const months = plan.reduce<Record<string, PulseItem[]>>((acc, it) => {
    ;(acc[it.date.slice(0, 7)] ??= []).push(it)
    return acc
  }, {})

  const book = (it: PulseItem) => {
    const f = getService(it.category, it.service)
    if (!f) return
    if (f.service.price > 0 && !f.service.variants?.length) {
      add({ category: f.category.slug, categoryName: f.category.name, service: f.service.slug, name: f.service.name, options: [], addOns: [], unitPrice: f.service.price, duration: f.service.duration })
      setAdded((a) => [...a, it.id])
    } else window.location.href = localePath(`/services/${f.category.slug}/${f.service.slug}`, locale)
    track("pulse_book", { service: it.service, kind: it.kind })
  }

  const sendRemind = async (e: React.FormEvent) => {
    e.preventDefault()
    if (remind.name.trim().length < 2) return setRemind((r) => ({ ...r, error: t.remind.errName }))
    if (!PK_PHONE.test(normalisePhone(remind.phone))) return setRemind((r) => ({ ...r, error: t.remind.errPhone }))
    setRemind((r) => ({ ...r, state: "loading", error: "" }))
    try {
      await submit("enquiry", {
        kind: "pulse",
        name: remind.name.trim(),
        phone: normalisePhone(remind.phone),
        message: `Home Pulse reminders (${lang})`,
        details: { lang, plan: plan.map((p) => `${p.date} · ${p.title}`), profile },
      })
      setRemind((r) => ({ ...r, state: "done" }))
      track("pulse_whatsapp_optin", { items: plan.length })
    } catch (err) {
      setRemind((r) => ({ ...r, state: "idle", error: (err as Error).message }))
    }
  }

  if (!ready) return <div className="h-96" />

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-8 items-start">
      {/* Profile */}
      <aside className="lg:sticky lg:top-28 rounded-[2rem] bg-white border border-[#d7e7df] p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[#2f6f5e] mb-1">{p.title}</p>
          <p className="text-sm text-zinc-500">{p.sub}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">{p.acs}</span>
          <div className="flex items-center rounded-full border border-zinc-300">
            <button type="button" onClick={() => set("acs", Math.max(0, profile.acs - 1))} className="w-9 h-9 flex items-center justify-center" aria-label={p.fewerAcs}><Minus className="w-4 h-4" /></button>
            <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">{profile.acs}</span>
            <button type="button" onClick={() => set("acs", Math.min(10, profile.acs + 1))} className="w-9 h-9 flex items-center justify-center" aria-label={p.moreAcs}><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="divide-y divide-zinc-100">
          <Toggle label={p.tankUnderground} on={profile.tankUnderground} onChange={(v) => set("tankUnderground", v)} />
          <Toggle label={p.tankOverhead} on={profile.tankOverhead} onChange={(v) => set("tankOverhead", v)} />
          <Toggle label={p.solar} on={profile.solar} onChange={(v) => set("solar", v)} />
          <Toggle label={p.pets} on={profile.pets} onChange={(v) => set("pets", v)} />
        </div>
        <div>
          <p className="text-sm mb-2">{p.geyser}</p>
          <div className="flex gap-1.5">
            {(["gas", "electric", "none"] as const).map((g) => (
              <button key={g} type="button" aria-pressed={profile.geyser === g} onClick={() => set("geyser", g)} className={cn("h-8 px-3 rounded-full text-xs border", profile.geyser === g ? "bg-[#2f6f5e] text-white border-[#2f6f5e]" : "border-zinc-300 bg-white")}>{p[g]}</button>
            ))}
          </div>
        </div>
        <div className="pt-2 border-t border-zinc-100">
          <p className="text-xs uppercase tracking-[0.15em] text-[#2f6f5e] mt-3 mb-1">{p.rhythm}</p>
          <Rhythm t={p} label={t.rules.groups.wax} value={profile.waxWeeks} options={[3, 4, 5, 6]} onChange={(v) => set("waxWeeks", v)} />
          <Rhythm t={p} label={t.rules.groups.thread} value={profile.threadWeeks} options={[2, 3, 4]} onChange={(v) => set("threadWeeks", v)} />
          <Rhythm t={p} label={t.rules.groups.facial} value={profile.facialWeeks} options={[4, 6, 8]} onChange={(v) => set("facialWeeks", v)} />
          <Rhythm t={p} label={t.rules.groups.mani} value={profile.maniWeeks} options={[3, 4, 6]} onChange={(v) => set("maniWeeks", v)} />
        </div>
        <div className="pt-2 border-t border-zinc-100">
          <p className="text-xs uppercase tracking-[0.15em] text-[#2f6f5e] mt-3 mb-2">{p.events}</p>
          <ul className="space-y-1.5 mb-3">
            {profile.events.map((ev, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm rounded-xl bg-[#eef6f2] px-3 py-2">
                <span className="min-w-0 truncate">{ev.name} · {ev.date}</span>
                <button type="button" onClick={() => set("events", profile.events.filter((_, j) => j !== i))} aria-label={fill(p.remove, { name: ev.name })}><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder={p.eventPlaceholder} aria-label={p.eventName} className={cn(inputCls, "h-10")} />
            <input type="date" value={evDate} min={today} onChange={(e) => setEvDate(e.target.value)} aria-label={p.eventDate} className={cn(inputCls, "h-10 w-[150px]")} />
          </div>
          <button
            type="button"
            disabled={!evName.trim() || !evDate}
            onClick={() => {
              set("events", [...profile.events, { name: evName.trim(), date: evDate }].slice(0, 6))
              setEvName("")
              setEvDate("")
              track("pulse_event_added", {})
            }}
            className="mt-2 h-10 w-full rounded-full border border-[#2f6f5e] text-[#2f6f5e] text-sm disabled:opacity-40"
          >
            {p.addEvent}
          </button>
        </div>
      </aside>

      {/* Plan */}
      <div className="min-w-0 space-y-5">
        <div className="rounded-[2rem] bg-[#15372f] text-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[#9fd8c4]">{t.plan.title}</p>
            <div className="inline-flex rounded-full bg-white/10 p-1" role="group" aria-label={t.plan.language}>
              {([["en", "English"], ["ur", "اردو"], ["ro", "Roman Urdu"]] as const).map(([l, label]) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={cn("h-8 px-3 rounded-full text-xs", lang === l ? "bg-white text-[#15372f]" : "text-white/70", l === "ur" && "font-urdu")}>{label}</button>
              ))}
            </div>
          </div>
          {next ? (
            <>
              <p className="font-serif text-3xl sm:text-4xl leading-tight" dir="auto">
                {ai?.intro && aiState !== "loading" ? ai.intro : fill(daysBetween(today, next.date) <= 1 ? t.plan.nextTomorrow : t.plan.nextIn, { title: locale === "en" ? next.title.toLowerCase() : next.title, days: daysBetween(today, next.date) })}
              </p>
              <p className="text-white/60 mt-3 text-sm">{[fill(t.plan.planned, { count: plan.length }), soon ? fill(t.plan.soonCount, { count: soon }) : "", weather.length ? fill(t.plan.heat, { temp: Math.round(Math.max(...weather.map((w) => w.max))) }) : ""].filter(Boolean).join(" · ")}</p>
            </>
          ) : (
            <p className="font-serif text-3xl">{t.plan.caughtUp}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-5">
            <button type="button" disabled={!plan.length} onClick={() => { download("mjazo-home-pulse.ics", planIcs(plan, "Mjazo", t.rules.calendarBook)); track("pulse_calendar", { items: plan.length }) }} className="h-10 px-4 rounded-full bg-white text-[#15372f] text-sm flex items-center gap-2 disabled:opacity-40"><CalendarPlus className="w-4 h-4" />{t.plan.calendarAll}</button>
            <a href="#remind" className="h-10 px-4 rounded-full border border-white/30 text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4" />{t.plan.whatsapp}</a>
            {aiState === "loading" ? <span className="h-10 px-2 flex items-center gap-2 text-xs text-white/60"><Loader2 className="w-3.5 h-3.5 animate-spin" />{t.plan.personalising}</span> : ai ? <span className="h-10 px-2 flex items-center gap-1.5 text-xs text-[#9fd8c4]"><Sparkles className="w-3.5 h-3.5" />{t.plan.byAi}</span> : null}
          </div>
        </div>

        {Object.entries(months).map(([month, its]) => (
          <div key={month}>
            <p className="font-serif text-2xl mb-3">{fmtMonth(`${month}-01`, locale)}</p>
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {its.map((it) => {
                  const f = getService(it.category, it.service)
                  const line = ai?.lines[it.id]
                  return (
                    <motion.li key={it.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.3, ease: EASE }} className="rounded-3xl bg-white border border-[#d7e7df] p-4 sm:p-5 flex gap-4">
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-[11px] uppercase text-zinc-500">{fmtDay(it.date, locale)}</p>
                        <p className="font-serif text-3xl leading-none mt-0.5">{Number(it.date.slice(8))}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-[11px] rounded-full bg-[#eef6f2] text-[#2f6f5e] px-2 py-0.5">{t.kinds[it.kind]}</span>
                          {it.priority === 1 && <span className="text-[11px] rounded-full bg-brand-soft text-brand-ink px-2 py-0.5">{t.item.soon}</span>}
                          {it.approx && <span className="text-[11px] text-zinc-500">{t.item.approx}</span>}
                        </div>
                        <p className="font-medium" dir="auto">{line && lang !== "en" ? line : it.title}</p>
                        <p className="text-sm text-zinc-500 mt-0.5" dir="auto">{line && lang === "en" ? line : it.why}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {f && (
                            <button type="button" onClick={() => book(it)} className={cn("h-9 px-4 rounded-full text-sm", added.includes(it.id) ? "bg-brand text-black" : "bg-foreground text-background")}>
                              {added.includes(it.id) ? <span className="flex items-center gap-1"><Check className="w-4 h-4" />{t.item.inCart}</span> : f.service.price > 0 && !f.service.variants?.length ? fill(t.item.bookPrice, { price: formatPKR(f.service.price) }) : t.item.book}
                            </button>
                          )}
                          <button type="button" onClick={() => download(`mjazo-${it.service}.ics`, planIcs([it], "Mjazo", t.rules.calendarBook))} className="h-9 px-3 rounded-full border border-zinc-300 text-sm flex items-center gap-1.5"><CalendarPlus className="w-4 h-4" />{t.item.calendar}</button>
                          <button type="button" onClick={() => setDone((d) => [...d, it.id])} className="h-9 px-3 rounded-full text-sm text-zinc-500 hover:text-black">{t.item.done}</button>
                        </div>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </div>
        ))}
        {added.length > 0 && <p className="text-sm text-[#2f6f5e]">{t.item.added} <Link href="/checkout" className="underline">{t.item.chooseTime}</Link></p>}

        <form id="remind" onSubmit={sendRemind} className="scroll-mt-28 rounded-[2rem] bg-[#eef6f2] p-6 sm:p-8 grid gap-4" noValidate>
          <div>
            <p className="font-serif text-3xl">{t.remind.title}</p>
            <p className="text-sm text-zinc-600 mt-1">{t.remind.sub}</p>
          </div>
          {remind.state === "done" ? (
            <p className="flex items-center gap-2 text-[#2f6f5e]"><Check className="w-5 h-5" />{fill(t.remind.done, { title: next ? (locale === "en" ? next.title.toLowerCase() : next.title) : t.remind.nextItem })}</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={remind.name} onChange={(e) => setRemind((r) => ({ ...r, name: e.target.value }))} placeholder={t.remind.name} aria-label={t.remind.name} className={inputCls} autoComplete="name" />
                <input value={remind.phone} onChange={(e) => setRemind((r) => ({ ...r, phone: e.target.value }))} placeholder={t.remind.phone} aria-label={t.remind.phone} className={inputCls} inputMode="tel" autoComplete="tel" />
              </div>
              {remind.error && <p className="text-xs text-destructive">{remind.error}</p>}
              <button disabled={remind.state === "loading" || !plan.length} className="h-12 rounded-full bg-[#2f6f5e] text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                {remind.state === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}{t.remind.send}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
