"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, Check, ChevronRight, Clock, LogOut, MapPin, Navigation, Phone, Play, ShieldAlert, ShieldCheck, Sparkles, Square, Wallet } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import type { Lang } from "@/lib/content"
import type { Job, JobBrief, JobItem, JobStatus, SafetyStatus } from "@/lib/ops/types"
import { locate, shrink, speak } from "@/lib/client/media"
import { to12h } from "@/lib/shaadi"
import { cn } from "@/lib/utils"
import { usePartnerLang } from "@/components/partner/lang"
import { api, Btn, mapsLink, useNow, usePoll } from "../kit"
import { ProCopilot } from "./copilot"
import { T } from "./strings"

type ProJob = {
  id: string
  window: string
  eta?: string
  status: JobStatus
  area: string
  subArea?: string
  address: string
  landmark?: string
  customer: { name: string; phone: string }
  items: JobItem[]
  total: number
  payment: string
  notes?: string
  minutes: number
  checkedInAt?: string
  safety: SafetyStatus
  paid: { status: string; amount: number; method: string } | null
  lastNotes: string[]
  brief: JobBrief | null
  photos: string[]
  event: Job["event"] | null
}
type Today = { pro: { id: string; name: string; area: string }; today: string; jobs: ProJob[]; upcoming: number; earnings: { visits: number; earned: number }; ai: boolean }

const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "ur", label: "اردو" },
  { id: "ro", label: "Roman" },
]

function DarkLang({ lang, set }: { lang: Lang; set: (l: Lang) => void }) {
  return (
    <div role="group" aria-label="Language" className="inline-flex rounded-full bg-white/10 p-1">
      {LANGS.map((l) => (
        <button key={l.id} onClick={() => set(l.id)} aria-pressed={lang === l.id} className={cn("h-8 px-3 rounded-full text-xs", l.id === "ur" && "font-urdu", lang === l.id ? "bg-white text-black" : "text-white/70")}>
          {l.label}
        </button>
      ))}
    </div>
  )
}

export function ProApp({ authed, enabled }: { authed: boolean; enabled: boolean }) {
  const [lang, setLang] = usePartnerLang()
  const [isIn, setIn] = useState(authed)
  useEffect(() => {
    const out = () => setIn(false)
    window.addEventListener("mjazo:staff-logout", out)
    return () => window.removeEventListener("mjazo:staff-logout", out)
  }, [])
  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white">
      <div className="max-w-md mx-auto min-h-[100svh] flex flex-col">{isIn ? <Home lang={lang} setLang={setLang} onLogout={() => setIn(false)} /> : <Login lang={lang} setLang={setLang} enabled={enabled} onIn={() => setIn(true)} />}</div>
    </div>
  )
}

function Login({ lang, setLang, enabled, onIn }: { lang: Lang; setLang: (l: Lang) => void; enabled: boolean; onIn: () => void }) {
  const [phone, setPhone] = useState("")
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const ur = lang === "ur" ? "font-urdu leading-[2]" : ""
  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      await api("/api/pro/login", { phone, pin })
      onIn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex-1 flex flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <div className="flex justify-end">
        <DarkLang lang={lang} set={setLang} />
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 16 }} className="w-16 h-16 rounded-[22px] bg-[var(--brand)] text-black flex items-center justify-center font-serif text-3xl">
          m
        </motion.div>
        <h1 className="font-serif text-5xl mt-8">
          Mjazo <span className="italic text-[var(--brand)]">Pro</span>
        </h1>
        <p className={cn("text-white/60 mt-3 text-lg", ur)}>{T.appSub[lang]}</p>
        {!enabled ? (
          <p className="mt-10 rounded-3xl bg-white/[0.06] p-5 text-white/70">The pro app isn't switched on yet. Ops need to set it up first.</p>
        ) : (
          <form onSubmit={go} className="mt-10 space-y-4">
            <label className="block">
              <span className={cn("text-sm text-white/60", ur)}>{T.phone[lang]}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="03xx xxxxxxx" className="mt-2 w-full h-14 rounded-2xl bg-white/[0.07] border border-white/10 px-5 text-[18px] tracking-wide outline-none focus:border-[var(--brand)]" />
            </label>
            <label className="block">
              <span className={cn("text-sm text-white/60", ur)}>{T.pin[lang]}</span>
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="current-password" placeholder="••••" className="mt-2 w-full h-14 rounded-2xl bg-white/[0.07] border border-white/10 px-5 text-[22px] tracking-[0.5em] outline-none focus:border-[var(--brand)]" />
            </label>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Btn variant="brand" size="lg" busy={busy} className="w-full" disabled={phone.length < 10 || pin.length < 4}>
              <span className={ur}>{T.login[lang]}</span>
            </Btn>
            <p className={cn("text-sm text-white/45 text-center", ur)}>{T.forgot[lang]}</p>
          </form>
        )}
      </div>
    </div>
  )
}

function Home({ lang, setLang, onLogout }: { lang: Lang; setLang: (l: Lang) => void; onLogout: () => void }) {
  const [data, setData] = useState<Today | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [paying, setPaying] = useState<ProJob | null>(null)
  const [sos, setSos] = useState<"closed" | "confirm" | "sent">("closed")
  const [copilot, setCopilot] = useState(false)
  const [toast, setToast] = useState("")
  const ur = lang === "ur" ? "font-urdu leading-[2]" : ""

  const load = async () => {
    try {
      setData(await api<Today>("/api/pro/today"))
      setError("")
    } catch (e) {
      setError((e as Error).message)
    }
  }
  usePoll(load, 30000)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(""), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const act = async (job: ProJob | null, action: string) => {
    setBusy(`${job?.id}:${action}`)
    try {
      const where = action === "check_in" || action === "sos" || action === "en_route" ? await locate() : {}
      await api("/api/pro/job", { action, jobId: job?.id, ...where })
      if (action === "sos") setSos("sent")
      await load()
    } catch (e) {
      setToast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const logout = async () => {
    await api("/api/staff/logout", {}).catch(() => {})
    onLogout()
  }

  const alert = data?.jobs.find((j) => ["overdue", "escalated"].includes(j.safety.level))
  const active = data?.jobs.find((j) => ["en_route", "checked_in", "checked_out"].includes(j.status))
  const first = data?.pro.name.split(" ")[0]
  const left = data?.jobs.filter((j) => j.status !== "completed").length ?? 0

  return (
    <>
      <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className={cn("text-white/50 text-sm", ur)}>
            {T.salaam[lang]}
            {first ? `, ${first}` : ""}
          </p>
          <p className="font-serif text-2xl truncate">{data ? new Date(`${data.today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "…"}</p>
        </div>
        <DarkLang lang={lang} set={setLang} />
        <button onClick={logout} aria-label={T.logout[lang]} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 px-5 pb-36 space-y-4">
        {error && <p className="text-sm text-red-300">{error}</p>}

        <AnimatePresence>
          {alert && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[28px] bg-amber-400 text-black p-5">
              <p className={cn("text-xl font-semibold", ur)}>{T.safeQ[lang]}</p>
              <p className={cn("text-sm mt-1 text-black/75", ur)}>{T.safeBody[lang]}</p>
              <div className="flex gap-2 mt-4">
                <Btn size="lg" className="flex-1" busy={busy === `${alert.id}:safe`} onClick={() => act(alert, "safe")}>
                  <ShieldCheck className="w-5 h-5" />
                  <span className={ur}>{T.safe[lang]}</span>
                </Btn>
                <Btn size="lg" variant="danger" onClick={() => setSos("confirm")}>
                  SOS
                </Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-2.5">
          <Stat value={data ? String(data.jobs.length) : "–"} label={T.visits[lang]} ur={ur} />
          <Stat value={data ? String(left) : "–"} label={lang === "en" ? "still to go" : lang === "ur" ? "باقی" : "baqi"} ur={ur} />
          <Stat value={data ? formatPKR(data.earnings.earned).replace("PKR ", "") : "–"} label={T.earned[lang]} ur={ur} small />
        </div>

        {data?.ai && data.jobs.length > 0 && <Brief lang={lang} />}

        {data && !data.jobs.length && <p className={cn("rounded-[28px] bg-white/[0.05] p-6 text-white/60", ur)}>{T.noJobs[lang]}</p>}

        <ol className="space-y-3">
          {data?.jobs.map((j, i) => (
            <JobCard key={j.id} job={j} n={i + 1} lang={lang} focus={active?.id === j.id} busy={busy} onAct={act} onPay={() => setPaying(j)} />
          ))}
        </ol>

        {data && data.upcoming > 0 && (
          <p className={cn("text-center text-sm text-white/45 pt-2", ur)}>
            {data.upcoming} {T.upcoming[lang]}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
        <div className="max-w-md mx-auto flex items-end justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setSos("confirm")} className="pointer-events-auto w-16 h-16 rounded-full bg-red-600 text-white font-bold tracking-wider shadow-[0_10px_30px_-5px_rgba(220,38,38,0.6)] active:scale-95 transition-transform" aria-label="SOS">
            SOS
          </button>
          {data?.ai && (
            <button onClick={() => setCopilot(true)} className="pointer-events-auto h-14 pl-4 pr-5 rounded-full bg-[var(--brand)] text-black font-medium flex items-center gap-2 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] active:scale-95 transition-transform">
              <Sparkles className="w-5 h-5" />
              <span className={ur}>{T.copilot[lang]}</span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed z-[60] left-4 right-4 bottom-28 max-w-md mx-auto rounded-2xl bg-white text-black px-5 py-4 text-sm shadow-xl" role="status">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={sos !== "closed"} onClose={() => setSos("closed")}>
        {sos === "sent" ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-red-600 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <p className={cn("text-xl font-semibold mt-5", ur)}>{T.sosSent[lang]}</p>
            <a href="tel:15" className="mt-6 inline-flex h-14 px-8 rounded-full bg-white text-black items-center gap-2 font-medium">
              <Phone className="w-5 h-5" /> 15
            </a>
            <Btn variant="ghost" className="w-full mt-3" onClick={() => setSos("closed")}>
              {T.close[lang]}
            </Btn>
          </div>
        ) : (
          <div>
            <p className={cn("text-2xl font-semibold", ur)}>{T.sosQ[lang]}</p>
            <p className={cn("text-white/65 mt-2", ur)}>{T.sosBody[lang]}</p>
            <Btn variant="danger" size="lg" className="w-full mt-6 h-16 text-lg" busy={busy === `${active?.id}:sos`} onClick={() => act(active ?? null, "sos")}>
              <ShieldAlert className="w-6 h-6" />
              <span className={ur}>{T.sosSend[lang]}</span>
            </Btn>
            <Btn variant="ghost" className="w-full mt-2" onClick={() => setSos("closed")}>
              <span className={ur}>{T.cancel[lang]}</span>
            </Btn>
          </div>
        )}
      </Sheet>

      <Sheet open={!!paying} onClose={() => setPaying(null)}>
        {paying && (
          <PaySheet
            job={paying}
            lang={lang}
            onDone={async (msg) => {
              setPaying(null)
              setToast(msg)
              await load()
            }}
          />
        )}
      </Sheet>

      <ProCopilot open={copilot} onClose={() => setCopilot(false)} lang={lang} />
    </>
  )
}

function Stat({ value, label, ur, small }: { value: string; label: string; ur: string; small?: boolean }) {
  return (
    <div className="rounded-3xl bg-white/[0.06] px-4 py-3.5 min-w-0">
      <p className={cn("font-serif leading-none truncate", small ? "text-2xl" : "text-3xl")}>{value}</p>
      <p className={cn("text-[11px] text-white/50 mt-1.5 leading-tight", ur)}>{label}</p>
    </div>
  )
}

function Brief({ lang }: { lang: Lang }) {
  const [text, setText] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle")
  const cache = useRef<Record<string, string>>({})
  const ur = lang === "ur" ? "font-urdu leading-[2]" : ""
  const play = async () => {
    if (state === "playing") {
      window.speechSynthesis?.cancel()
      return setState("idle")
    }
    setState("loading")
    try {
      const t = cache.current[lang] ?? (await api<{ text: string }>("/api/pro/copilot", { brief: true, lang })).text
      cache.current[lang] = t
      setText(t)
      if (speak(t, lang === "en" ? "en-PK" : "ur-PK")) {
        setState("playing")
        const poll = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(poll)
            setState("idle")
          }
        }, 500)
      } else setState("idle")
    } catch {
      setState("idle")
    }
  }
  return (
    <div className="rounded-[28px] bg-gradient-to-br from-[var(--brand)] to-[oklch(0.7_0.16_55)] text-black p-5">
      <div className="flex items-center gap-4">
        <button onClick={play} aria-label={T.play[lang]} className="w-14 h-14 shrink-0 rounded-full bg-black text-[var(--brand)] flex items-center justify-center active:scale-95 transition-transform">
          {state === "playing" ? <Square className="w-5 h-5 fill-current" /> : state === "loading" ? <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
        </button>
        <div className="min-w-0">
          <p className={cn("font-semibold text-lg leading-tight", ur)}>{T.brief[lang]}</p>
          <p className={cn("text-sm text-black/65 leading-snug", ur)}>{T.briefSub[lang]}</p>
        </div>
      </div>
      {text && (
        <p dir="auto" className={cn("mt-4 text-[15px] leading-relaxed text-black/85", lang === "ur" && "font-urdu leading-[2.1]")}>
          {text}
        </p>
      )}
    </div>
  )
}

function JobCard({ job: j, n, lang, focus, busy, onAct, onPay }: { job: ProJob; n: number; lang: Lang; focus: boolean; busy: string | null; onAct: (j: ProJob, a: string) => void; onPay: () => void }) {
  const now = useNow(30000)
  const ur = lang === "ur" ? "font-urdu leading-[2]" : ""
  const done = j.status === "completed"
  const place = [j.address, j.landmark && `near ${j.landmark}`, j.subArea, j.area, "Karachi"].filter(Boolean).join(", ")
  const checkedIn = j.status === "checked_in"
  const elapsed = checkedIn && j.checkedInAt ? Math.max(0, Math.round((now - new Date(j.checkedInAt).getTime()) / 60000)) : 0
  return (
    <motion.li layout className={cn("rounded-[28px] p-5 transition-colors", done ? "bg-white/[0.03] text-white/50" : focus ? "bg-white text-black" : "bg-white/[0.06]")}>
      <div className="flex items-start gap-3">
        <span className={cn("w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-semibold text-sm", done ? "bg-emerald-500/20 text-emerald-300" : focus ? "bg-black text-[var(--brand)]" : "bg-[var(--brand)] text-black")}>{done ? <Check className="w-4 h-4" /> : n}</span>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-2 text-sm opacity-70">
            <Clock className="w-3.5 h-3.5" /> {j.window}
            {j.eta && !done && <span>· ETA {j.eta}</span>}
          </p>
          <p className="text-lg font-semibold leading-snug mt-0.5">
            {j.customer.name.split(" ")[0]} · {j.subArea ?? j.area}
          </p>
          <p className="text-sm opacity-70 mt-0.5 leading-snug">{place}</p>
        </div>
      </div>

      {!done && (
        <>
          <ul className="mt-4 space-y-1 text-[15px]">
            {j.items.map((i, k) => (
              <li key={k} className="flex gap-2">
                <ChevronRight className="w-4 h-4 mt-1 shrink-0 opacity-50" />
                <span>
                  {i.name}
                  {i.options.length > 0 && <span className="opacity-60"> · {i.options.join(", ")}</span>}
                  {i.addOns.length > 0 && <span className="opacity-60"> + {i.addOns.join(", ")}</span>}
                  {i.qty > 1 && <span className="opacity-60"> ×{i.qty}</span>}
                </span>
              </li>
            ))}
          </ul>
          {j.event && (
            <div className={cn("mt-4 rounded-2xl p-3.5 text-sm", focus ? "bg-[var(--brand-soft)]" : "bg-[var(--brand)]/15")}>
              <p className="font-semibold">
                {j.event.name} · photos at {to12h(j.event.readyBy)} · {j.event.track}
              </p>
              <ol className="mt-2 space-y-1">
                {j.event.people.map((p, k) => (
                  <li key={k} className="flex gap-2">
                    <span className="font-mono text-xs opacity-70 mt-0.5 shrink-0">
                      {to12h(p.start)}–{to12h(p.end)}
                    </span>
                    <span>
                      {p.name}: <span className="opacity-70">{p.services.join(", ")}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {j.brief && <BriefCard brief={j.brief} photos={j.photos} focus={focus} />}
          {(j.notes || j.lastNotes.length > 0) && (
            <div className={cn("mt-4 rounded-2xl p-3.5 text-sm space-y-2", focus ? "bg-black/[0.05]" : "bg-white/[0.05]")}>
              {j.notes && (
                <p>
                  <span className={cn("font-semibold", ur)}>{T.notes[lang]}: </span>
                  {j.notes}
                </p>
              )}
              {j.lastNotes.length > 0 && (
                <div>
                  <p className={cn("font-semibold", ur)}>{T.last[lang]}</p>
                  {j.lastNotes.map((x, k) => (
                    <p key={k} className="opacity-75">
                      {x}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 opacity-60" />
            <span className="font-semibold">{formatPKR(j.total)}</span>
            <span className="opacity-60">· {j.payment} after service</span>
          </p>
          {checkedIn && (
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div className="h-full bg-[var(--brand)] transition-[width] duration-700" style={{ width: `${Math.min(100, (elapsed / j.minutes) * 100)}%` }} />
              </div>
              <p className="text-xs opacity-60 mt-1.5">
                {elapsed} {T.of[lang]} ~{j.minutes} {T.min[lang]}
              </p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {j.status === "assigned" && (
              <Btn variant={focus ? "dark" : "brand"} size="lg" className="flex-1" busy={busy === `${j.id}:en_route`} onClick={() => onAct(j, "en_route")}>
                <Navigation className="w-5 h-5" />
                <span className={ur}>{T.onWay[lang]}</span>
              </Btn>
            )}
            {(j.status === "en_route" || j.status === "assigned") && (
              <Btn variant={j.status === "en_route" ? "dark" : "light"} size="lg" className={cn("flex-1", j.status === "assigned" && "bg-white/10 text-white border-white/15")} busy={busy === `${j.id}:check_in`} onClick={() => onAct(j, "check_in")}>
                <MapPin className="w-5 h-5" />
                <span className={ur}>{T.checkIn[lang]}</span>
              </Btn>
            )}
            {(j.status === "checked_in" || j.status === "checked_out") && (
              <Btn variant="dark" size="lg" className="flex-1" onClick={onPay}>
                <Wallet className="w-5 h-5" />
                <span className={ur}>{T.finish[lang]}</span>
              </Btn>
            )}
            <div className="flex gap-2 w-full">
              <a href={mapsLink(place)} target="_blank" rel="noreferrer" className={cn("flex-1 h-11 rounded-full inline-flex items-center justify-center gap-2 text-sm font-medium", focus ? "bg-black/[0.06]" : "bg-white/10")}>
                <MapPin className="w-4 h-4" /> {T.map[lang]}
              </a>
              <a href={`tel:${j.customer.phone}`} className={cn("flex-1 h-11 rounded-full inline-flex items-center justify-center gap-2 text-sm font-medium", focus ? "bg-black/[0.06]" : "bg-white/10")}>
                <Phone className="w-4 h-4" /> {T.call[lang]}
              </a>
            </div>
          </div>
        </>
      )}
      {done && j.paid && (
        <p className="mt-3 text-sm">
          {T.done[lang]} · {formatPKR(j.paid.amount)} {j.paid.method}
          {j.paid.status === "matched" && " · ✓"}
          {["mismatch", "unreadable", "pending"].includes(j.paid.status) && " · ops checking"}
        </p>
      )}
    </motion.li>
  )
}

const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "jazzcash", label: "JazzCash" },
  { id: "easypaisa", label: "Easypaisa" },
  { id: "raast", label: "Raast / Bank" },
] as const

function PaySheet({ job, lang, onDone }: { job: ProJob; lang: Lang; onDone: (msg: string) => void }) {
  const initial = METHODS.find((m) => m.id === job.payment)?.id ?? "cash"
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>(initial)
  const [amount, setAmount] = useState(String(job.total))
  const [shot, setShot] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const file = useRef<HTMLInputElement>(null)
  const ur = lang === "ur" ? "font-urdu leading-[2]" : ""
  const save = async () => {
    setBusy(true)
    setError("")
    try {
      const where = await locate(4000)
      const r = await api<{ message: string }>("/api/pro/job", { action: "complete", jobId: job.id, ...where, payment: { method, amount: Number(amount) || 0, screenshot: method === "cash" ? undefined : shot } })
      onDone(r.message)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <div>
      <p className={cn("text-2xl font-semibold", ur)}>{T.pay[lang]}</p>
      <p className="text-white/55 mt-1">
        {T.total[lang]}: <span className="text-white font-semibold">{formatPKR(job.total)}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 mt-5">
        {METHODS.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} aria-pressed={method === m.id} className={cn("h-14 rounded-2xl border text-[15px] font-medium transition-colors", method === m.id ? "bg-[var(--brand)] text-black border-transparent" : "border-white/15 text-white/80")}>
            {m.label}
          </button>
        ))}
      </div>
      <label className="block mt-5">
        <span className={cn("text-sm text-white/60", ur)}>{T.amount[lang]}</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-2 w-full h-14 rounded-2xl bg-white/[0.07] border border-white/10 px-5 text-[20px] outline-none focus:border-[var(--brand)]" />
      </label>
      {method !== "cash" && (
        <div className="mt-5">
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => e.target.files?.[0] && setShot(await shrink(e.target.files[0], 1100, 0.8))} />
          <button onClick={() => file.current?.click()} className="w-full rounded-2xl border border-dashed border-white/25 p-4 flex items-center gap-4 text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {shot ? <img src={shot} alt="Payment screenshot" className="w-14 h-20 object-cover rounded-lg" /> : <span className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center"><Camera className="w-6 h-6" /></span>}
            <span>
              <span className={cn("block font-medium", ur)}>{T.shot[lang]}</span>
              <span className={cn("block text-sm text-white/50", ur)}>{T.shotHint[lang]}</span>
            </span>
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
      <Btn variant="brand" size="lg" className="w-full mt-6" busy={busy} disabled={method !== "cash" && !shot} onClick={save}>
        <Check className="w-5 h-5" />
        <span className={ur}>{T.saveFinish[lang]}</span>
      </Btn>
    </div>
  )
}

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[65] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-lenis-prevent>
          <button aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: "spring", damping: 28, stiffness: 320 }} className="relative w-full max-w-md max-h-[92svh] overflow-y-auto rounded-t-[32px] bg-[#161616] text-white px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" role="dialog">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-2 mb-5" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Ghar Scan diagnosis or Look Card sent by the customer, with their photos and the parts checklist. */
function BriefCard({ brief, photos, focus }: { brief: JobBrief; photos: string[]; focus: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const [have, setHave] = useState<string[]>([])
  return (
    <div className={cn("mt-4 rounded-2xl p-3.5 text-sm", focus ? "bg-black/[0.05]" : "bg-white/[0.05]")}>
      <p className="text-[11px] uppercase tracking-wider opacity-60">{brief.kind === "scan" ? "Ghar Scan brief from the customer" : "Look Card from the customer"}</p>
      <p className="font-semibold mt-1" dir="auto">
        {brief.title}
      </p>
      <p className="opacity-80 mt-1 leading-relaxed" dir="auto">
        {brief.text}
      </p>
      {photos.length > 0 && (
        <div className="flex gap-2 mt-3">
          {photos.map((p, i) => (
            <button key={i} onClick={() => setOpen(open === i ? null : i)} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0" aria-label={`Photo ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="w-full h-full object-cover" />
              {(brief.pins ?? [])
                .filter((x) => x.photo === i)
                .map((x, k) => (
                  <span key={k} className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-[var(--brand)] ring-2 ring-black/50" style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%` }} />
                ))}
            </button>
          ))}
        </div>
      )}
      {open !== null && photos[open] && (
        <div className="relative mt-3 rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open]} alt="Customer photo" className="w-full" />
          {(brief.pins ?? [])
            .filter((x) => x.photo === open)
            .map((x, k) => (
              <span key={k} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%` }}>
                <span className="w-6 h-6 rounded-full bg-[var(--brand)] text-black text-xs font-bold flex items-center justify-center ring-2 ring-black/50">{k + 1}</span>
                <span className="mt-1 rounded-full bg-black/80 text-white text-[11px] px-2 py-0.5 whitespace-nowrap">{x.label}</span>
              </span>
            ))}
        </div>
      )}
      {(brief.causes?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="font-semibold text-xs opacity-70">Likely causes</p>
          <ol className="list-decimal pl-5 mt-1 space-y-0.5" dir="auto">
            {brief.causes!.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </div>
      )}
      {(brief.parts?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="font-semibold text-xs opacity-70">Parts to carry</p>
          <ul className="mt-1.5 space-y-1.5">
            {brief.parts!.map((p) => (
              <li key={p}>
                <label className="flex items-center gap-2.5">
                  <input type="checkbox" checked={have.includes(p)} onChange={() => setHave((h) => (h.includes(p) ? h.filter((x) => x !== p) : [...h, p]))} className="w-5 h-5 accent-[var(--brand)]" />
                  <span className={cn(have.includes(p) && "line-through opacity-60")}>{p}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
