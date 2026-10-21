"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Bell, CalendarDays, Home, LogOut, Phone, Play, ShieldAlert, ShieldCheck, Sparkles, Square, User, Wallet, type LucideIcon } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import type { Lang } from "@/lib/content"
import { locate, speak } from "@/lib/client/media"
import { cn } from "@/lib/utils"
import { usePartnerLang } from "@/components/partner/lang"
import { browserSupabase } from "@/components/admin/supabase-browser"
import { api, Btn, usePoll } from "../kit"
import { ProCopilot } from "./copilot"
import { T } from "./strings"
import { MeTab, MoneyTab, OffersTab, ScheduleTab } from "./tabs"
import { dayLabel, PaySheet, Sheet, urCls, VisitCard, type Schedule, type Visit } from "./visit"

// Mjazo Pro on the web (/pro): sign in with phone + PIN or an emailed link, then today's visits,
// the week ahead, offers, earnings and her profile. Everything goes through /api/v1/pro, the
// same API the phone app uses.

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

export function ProApp({ authed, enabled, emailSignIn, error }: { authed: boolean; enabled: boolean; emailSignIn: boolean; error?: string }) {
  const [lang, setLang] = usePartnerLang()
  const [isIn, setIn] = useState(authed)
  useEffect(() => {
    const out = () => setIn(false)
    window.addEventListener("mjazo:staff-logout", out)
    return () => window.removeEventListener("mjazo:staff-logout", out)
  }, [])
  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white">
      <div className="max-w-md mx-auto min-h-[100svh] flex flex-col">
        {isIn ? <Shell lang={lang} setLang={setLang} onLogout={() => setIn(false)} /> : <Login lang={lang} setLang={setLang} enabled={enabled} emailSignIn={emailSignIn} error={error} onIn={() => setIn(true)} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

function Login({ lang, setLang, enabled, emailSignIn, error: linkError, onIn }: { lang: Lang; setLang: (l: Lang) => void; enabled: boolean; emailSignIn: boolean; error?: string; onIn: () => void }) {
  const [mode, setMode] = useState<"pin" | "email">(linkError ? "email" : "pin")
  const [phone, setPhone] = useState("")
  const [pin, setPin] = useState("")
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(linkError === "no-pro" ? T.noPro[lang] : linkError ? T.linkError[lang] : "")
  const [sent, setSent] = useState(false)
  const ur = urCls(lang)
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      await api("/api/v1/pro/session", { phone, pin })
      onIn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      await api("/api/v1/pro/session/email", { email })
      // New sign-ups are off: the server made the account only if a pro has this email.
      await browserSupabase()?.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/pro/auth/callback`, shouldCreateUser: false } })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const field = "mt-2 w-full h-14 rounded-2xl bg-white/[0.07] border border-white/10 px-5 outline-none focus:border-[var(--brand)]"
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
          <p className="mt-10 rounded-3xl bg-white/[0.06] p-5 text-white/70">The pro app isn&apos;t switched on yet. Ops need to set it up first.</p>
        ) : mode === "pin" ? (
          <form onSubmit={signIn} className="mt-10 space-y-4">
            <label className="block">
              <span className={cn("text-sm text-white/60", ur)}>{T.phone[lang]}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="03xx xxxxxxx" className={cn(field, "text-[18px] tracking-wide")} />
            </label>
            <label className="block">
              <span className={cn("text-sm text-white/60", ur)}>{T.pin[lang]}</span>
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="current-password" placeholder="••••" className={cn(field, "text-[22px] tracking-[0.5em]")} />
            </label>
            {error && <p className={cn("text-sm text-red-300", ur)}>{error}</p>}
            <Btn variant="brand" size="lg" busy={busy} className="w-full" disabled={phone.length < 10 || pin.length < 4}>
              <span className={ur}>{T.login[lang]}</span>
            </Btn>
            <p className={cn("text-sm text-white/45 text-center", ur)}>{T.forgot[lang]}</p>
            {emailSignIn && (
              <button type="button" onClick={() => (setMode("email"), setError(""))} className={cn("block mx-auto text-sm underline text-white/70", ur)}>
                {T.orEmail[lang]}
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={sendLink} className="mt-10 space-y-4">
            {sent ? (
              <p className={cn("rounded-3xl bg-white/[0.06] p-5 text-white/80", ur)}>{T.linkSent[lang]}</p>
            ) : (
              <>
                <label className="block">
                  <span className={cn("text-sm text-white/60", ur)}>{T.email[lang]}</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" className={cn(field, "text-[17px]")} />
                </label>
                {error && <p className={cn("text-sm text-red-300", ur)}>{error}</p>}
                <Btn variant="brand" size="lg" busy={busy} className="w-full" disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}>
                  <span className={ur}>{T.sendLink[lang]}</span>
                </Btn>
              </>
            )}
            <button type="button" onClick={() => (setMode("pin"), setSent(false), setError(""))} className={cn("block mx-auto text-sm underline text-white/70", ur)}>
              {T.orPin[lang]}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The signed-in app
// ---------------------------------------------------------------------------

type Tab = "today" | "schedule" | "offers" | "money" | "me"

function Shell({ lang, setLang, onLogout }: { lang: Lang; setLang: (l: Lang) => void; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("today")
  const [data, setData] = useState<Schedule | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [paying, setPaying] = useState<Visit | null>(null)
  const [sos, setSos] = useState<"closed" | "confirm" | "sent">("closed")
  const [copilot, setCopilot] = useState(false)
  const [toast, setToast] = useState("")
  const ur = urCls(lang)

  const load = async () => {
    try {
      setData(await api<Schedule>("/api/v1/pro/jobs?days=7"))
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

  const today = data?.days[0]?.visits ?? []
  const act = async (visit: Visit | null, action: string) => {
    setBusy(`${visit?.id}:${action}`)
    try {
      const where = action === "check_in" || action === "sos" || action === "en_route" ? await locate() : {}
      if (action === "sos") {
        await api("/api/v1/pro/sos", { jobId: visit?.id, ...where })
        setSos("sent")
      } else await api(`/api/v1/pro/jobs/${encodeURIComponent(visit!.id)}`, { action, ...where })
      await load()
    } catch (e) {
      setToast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  const logout = async () => {
    await api("/api/v1/pro/session", undefined, "DELETE").catch(() => {})
    onLogout()
  }

  const alert = today.find((j) => ["overdue", "escalated"].includes(j.safety.level))
  const active = today.find((j) => ["en_route", "checked_in", "checked_out"].includes(j.status))
  const left = today.filter((j) => j.status !== "completed").length
  const TABS: { id: Tab; label: string; icon: LucideIcon; badge?: number }[] = [
    { id: "today", label: T.tabToday[lang], icon: Home },
    { id: "schedule", label: T.tabSchedule[lang], icon: CalendarDays },
    { id: "offers", label: T.tabOffers[lang], icon: Bell, badge: data?.openOffers },
    { id: "money", label: T.tabMoney[lang], icon: Wallet },
    { id: "me", label: T.tabMe[lang], icon: User },
  ]

  return (
    <>
      <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className={cn("text-white/50 text-sm", ur)}>{tab === "today" ? T.salaam[lang] : TABS.find((t) => t.id === tab)!.label}</p>
          <p className="font-serif text-2xl truncate">{data ? dayLabel(data.today, lang) : "…"}</p>
        </div>
        {tab === "today" && (
          <>
            <DarkLang lang={lang} set={setLang} />
            <button onClick={logout} aria-label={T.logout[lang]} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}
      </header>

      <div className="flex-1 px-5 pb-44 space-y-4">
        {error && <p className="text-sm text-red-300">{error}</p>}

        {tab === "today" && (
          <>
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
              <Stat value={data ? String(today.length) : "–"} label={T.visits[lang]} ur={ur} />
              <Stat value={data ? String(left) : "–"} label={T.stillToGo[lang]} ur={ur} />
              <Stat value={data ? formatPKR(data.week.earned).replace("PKR ", "") : "–"} label={T.earned[lang]} ur={ur} small />
            </div>

            {!!data?.openOffers && (
              <button onClick={() => setTab("offers")} className={cn("w-full rounded-[28px] bg-[var(--brand)] text-black px-5 py-4 text-left font-semibold flex items-center gap-3", ur)}>
                <Bell className="w-5 h-5" /> <span className="flex-1">{T.newOffers[lang]}</span>
                <span className="min-w-7 h-7 px-2 rounded-full bg-black text-[var(--brand)] text-sm flex items-center justify-center">{data.openOffers}</span>
              </button>
            )}

            {data?.ai && today.length > 0 && <Brief lang={lang} />}

            {data && !today.length && <p className={cn("rounded-[28px] bg-white/[0.05] p-6 text-white/60", ur)}>{T.noJobs[lang]}</p>}

            <ol className="space-y-3">
              {today.map((j, i) => (
                <VisitCard key={j.id} visit={j} n={i + 1} lang={lang} focus={active?.id === j.id} busy={busy} onAct={act} onPay={() => setPaying(j)} />
              ))}
            </ol>
          </>
        )}
        {tab === "schedule" && <ScheduleTab schedule={data} lang={lang} />}
        {tab === "offers" && <OffersTab lang={lang} toast={setToast} onAnswered={load} />}
        {tab === "money" && <MoneyTab lang={lang} />}
        {tab === "me" && <MeTab lang={lang} langSwitch={<DarkLang lang={lang} set={setLang} />} onLogout={logout} />}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
        <div className="max-w-md mx-auto">
          <div className="flex items-end justify-between px-5 pb-3">
            <button onClick={() => setSos("confirm")} className="pointer-events-auto w-14 h-14 rounded-full bg-red-600 text-white font-bold tracking-wider shadow-[0_10px_30px_-5px_rgba(220,38,38,0.6)] active:scale-95 transition-transform" aria-label="SOS">
              SOS
            </button>
            {data?.ai && (
              <button onClick={() => setCopilot(true)} className="pointer-events-auto h-12 pl-4 pr-5 rounded-full bg-[var(--brand)] text-black font-medium flex items-center gap-2 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] active:scale-95 transition-transform">
                <Sparkles className="w-5 h-5" />
                <span className={ur}>{T.copilot[lang]}</span>
              </button>
            )}
          </div>
          <nav aria-label="Pro app" className="pointer-events-auto grid grid-cols-5 bg-[#141414]/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className={cn("relative h-16 flex flex-col items-center justify-center gap-1 text-[11px]", tab === t.id ? "text-[var(--brand)]" : "text-white/55")}>
                <t.icon className="w-5 h-5" />
                <span className={cn("max-w-full px-1 whitespace-nowrap", lang === "ur" ? "font-urdu leading-tight" : "truncate")}>{t.label}</span>
                {!!t.badge && <span className="absolute top-2 right-[calc(50%-1.25rem)] min-w-5 h-5 px-1 rounded-full bg-[var(--brand)] text-black text-[11px] font-bold flex items-center justify-center">{t.badge}</span>}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed z-[60] left-4 right-4 bottom-40 max-w-md mx-auto rounded-2xl bg-white text-black px-5 py-4 text-sm shadow-xl" role="status">
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
            visit={paying}
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
  const ur = urCls(lang)
  const play = async () => {
    if (state === "playing") {
      window.speechSynthesis?.cancel()
      return setState("idle")
    }
    setState("loading")
    try {
      const t = cache.current[lang] ?? (await api<{ text: string }>("/api/v1/pro/copilot", { brief: true, lang })).text
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
