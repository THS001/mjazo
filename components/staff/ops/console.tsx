"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Activity, Bot, CalendarHeart, Lock, LogOut, Route, ShieldAlert, UserPlus, Users, Wallet } from "lucide-react"
import type { Job, Pro, SafetyStatus } from "@/lib/ops/types"
import { cn } from "@/lib/utils"
import { api, ago, Btn, usePoll } from "../kit"
import { LiveBoard } from "./live"
import { Dispatch } from "./dispatch"
import { ProsTab } from "./pros"
import { Recruiting } from "./recruiting"
import { TrustDesk } from "./trust"
import { AskOps } from "./ask"
import { Weddings } from "./weddings"

export type OpsJob = Job & { safety: SafetyStatus }
export type OpsPro = Omit<Pro, "pinHash"> & { hasPin: boolean }
export type OpsData = {
  today: string
  date: string
  jobs: OpsJob[]
  alerts: OpsJob[]
  sos: { id: string; proId: string; at: string; lat?: number; lng?: number }[]
  pros: OpsPro[]
  stats: { jobs: number; unassigned: number; live: number; done: number; revenue: number; perProDay: number; unreconciled: number; openComplaints: number; weddingsPending: number }
  days: { date: string; count: number }[]
  ai: boolean
}

const TABS = [
  { id: "live", label: "Live board", icon: Activity },
  { id: "dispatch", label: "Route Brain", icon: Route },
  { id: "pros", label: "Pros", icon: Users },
  { id: "recruiting", label: "Recruiting", icon: UserPlus },
  { id: "weddings", label: "Weddings", icon: CalendarHeart },
  { id: "trust", label: "Trust Desk", icon: Wallet },
  { id: "ask", label: "Ask AI", icon: Bot },
] as const
type Tab = (typeof TABS)[number]["id"]

export function OpsConsole({ authed, enabled }: { authed: boolean; enabled: boolean }) {
  const [isIn, setIn] = useState(authed)
  useEffect(() => {
    const out = () => setIn(false)
    window.addEventListener("mjazo:staff-logout", out)
    return () => window.removeEventListener("mjazo:staff-logout", out)
  }, [])
  return isIn ? <Shell onLogout={() => setIn(false)} /> : <Login enabled={enabled} onIn={() => setIn(true)} />
}

function Login({ enabled, onIn }: { enabled: boolean; onIn: () => void }) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div aria-hidden className="absolute -top-40 -right-40 w-[34rem] h-[34rem] rounded-full bg-[var(--brand)] opacity-20 blur-[120px]" />
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError("")
          try {
            await api("/api/ops/login", { passcode: code })
            onIn()
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
        className="relative w-full max-w-sm"
      >
        <span className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-[var(--brand)]" />
        </span>
        <h1 className="font-serif text-5xl mt-8">
          Mjazo <span className="italic text-[var(--brand)]">Ops</span>
        </h1>
        <p className="text-white/55 mt-3">Live board, Route Brain, Safety Guardian, recruiting and Trust Desk.</p>
        {enabled ? (
          <>
            <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ops passcode" autoComplete="current-password" className="mt-10 w-full h-14 rounded-2xl bg-white/[0.07] border border-white/10 px-5 text-[16px] outline-none focus:border-[var(--brand)]" />
            {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
            <Btn variant="brand" size="lg" busy={busy} disabled={!code} className="w-full mt-4">
              Enter console
            </Btn>
          </>
        ) : (
          <p className="mt-10 rounded-2xl bg-white/[0.06] p-5 text-sm text-white/70 leading-relaxed">
            The console is switched off. Set <code className="text-[var(--brand)]">OPS_PASSCODE</code> and <code className="text-[var(--brand)]">SESSION_SECRET</code> in the deployment's environment variables, then reload.
          </p>
        )}
      </form>
    </div>
  )
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("live")
  const [date, setDate] = useState<string>("")
  const [data, setData] = useState<OpsData | null>(null)
  const [updated, setUpdated] = useState(0)
  const [error, setError] = useState("")
  const [, tick] = useState(0)

  const load = async () => {
    try {
      const d = await api<OpsData>(`/api/ops/data${date ? `?date=${date}` : ""}`)
      setData(d)
      if (!date) setDate(d.date)
      setUpdated(Date.now())
      setError("")
    } catch (e) {
      setError((e as Error).message)
    }
  }
  usePoll(load, 15000, [date])
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [])

  const logout = async () => {
    await api("/api/staff/logout", {}).catch(() => {})
    onLogout()
  }
  const sosCount = (data?.sos.length ?? 0) + (data?.alerts.filter((a) => a.safety.level === "sos" || a.safety.level === "escalated").length ?? 0)

  return (
    <div className="min-h-[100svh] bg-[oklch(0.975_0.008_80)] text-black">
      <header className="sticky top-0 z-40 bg-[#0b0b0b] text-white">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <p className="font-serif text-2xl shrink-0">
            Mjazo <span className="italic text-[var(--brand)]">Ops</span>
          </p>
          <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar" data-lenis-prevent>
            <div className="flex gap-1.5 w-max mx-auto">
              {data?.days.map((d, i) => {
                const dt = new Date(`${d.date}T12:00:00Z`)
                return (
                  <button key={d.date} onClick={() => setDate(d.date)} className={cn("h-10 px-3 rounded-xl text-left leading-none transition-colors", date === d.date ? "bg-[var(--brand)] text-black" : "bg-white/[0.06] text-white/70 hover:bg-white/10")}>
                    <span className="block text-[10px] uppercase tracking-wider opacity-70">{i === 0 ? "Today" : dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
                    <span className="block text-sm font-semibold mt-0.5">
                      {dt.getUTCDate()} <span className="font-normal opacity-60">· {d.count}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <span className="hidden md:flex items-center gap-2 text-xs text-white/50 shrink-0">
            <span className={cn("w-2 h-2 rounded-full", error ? "bg-red-500" : "bg-emerald-400 animate-pulse")} />
            {error ? "Offline" : updated ? `Live · ${ago(new Date(updated).toISOString())}` : "Connecting"}
          </span>
          <button onClick={logout} aria-label="Log out" className="w-10 h-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <nav className="max-w-[1500px] mx-auto px-2 sm:px-4 overflow-x-auto no-scrollbar" data-lenis-prevent>
          <div className="flex gap-1 w-max">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("relative h-12 px-4 flex items-center gap-2 text-sm transition-colors", tab === t.id ? "text-white" : "text-white/50 hover:text-white/80")}>
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.id === "live" && sosCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-red-600 text-[11px] font-bold flex items-center justify-center">{sosCount}</span>}
                {t.id === "weddings" && !!data?.stats.weddingsPending && <span className="min-w-5 h-5 px-1 rounded-full bg-[var(--brand)] text-black text-[11px] font-bold flex items-center justify-center">{data.stats.weddingsPending}</span>}
                {t.id === "trust" && !!data?.stats.openComplaints && <span className="min-w-5 h-5 px-1 rounded-full bg-[var(--brand)] text-black text-[11px] font-bold flex items-center justify-center">{data.stats.openComplaints}</span>}
                {tab === t.id && <motion.span layoutId="ops-tab" className="absolute left-3 right-3 bottom-0 h-0.5 bg-[var(--brand)]" />}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {data && (data.sos.length > 0 || data.alerts.length > 0) && <SafetyStrip data={data} reload={load} />}
      </AnimatePresence>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {error && !data && <p className="text-sm text-red-600">{error}</p>}
        {!data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-24 rounded-3xl bg-black/[0.04] animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {tab === "live" && <LiveBoard data={data} reload={load} />}
            {tab === "dispatch" && <Dispatch date={data.date} reload={load} />}
            {tab === "pros" && <ProsTab pros={data.pros} reload={load} />}
            {tab === "recruiting" && <Recruiting />}
            {tab === "weddings" && <Weddings reload={load} />}
            {tab === "trust" && <TrustDesk reload={load} />}
            {tab === "ask" && <AskOps ai={data.ai} />}
          </motion.div>
        )}
      </div>
    </div>
  )
}

function SafetyStrip({ data, reload }: { data: OpsData; reload: () => void }) {
  const [busy, setBusy] = useState("")
  const pro = (id?: string) => data.pros.find((p) => p.id === id)
  const run = async (key: string, body: unknown) => {
    setBusy(key)
    await api("/api/ops/jobs", body).catch((e) => alert((e as Error).message))
    setBusy("")
    reload()
  }
  const urgent = data.sos.length > 0 || data.alerts.some((a) => a.safety.level === "sos" || a.safety.level === "escalated")
  return (
    <motion.section initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={cn("overflow-hidden", urgent ? "bg-red-600 text-white" : "bg-amber-300 text-black")} aria-live="assertive">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-3 space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="w-4 h-4" /> Safety Guardian
        </p>
        {data.sos.map((s) => {
          const p = pro(s.proId)
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold">SOS</span> {p?.name ?? s.proId} · {ago(s.at)}
              {s.lat && (
                <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}>
                  location
                </a>
              )}
              <span className="flex-1" />
              {p && (
                <a href={`tel:${p.phone}`} className="h-8 px-3 rounded-full bg-white text-black inline-flex items-center font-medium">
                  Call {p.name.split(" ")[0]}
                </a>
              )}
              <Btn size="sm" variant="dark" busy={busy === s.id} onClick={() => run(s.id, { action: "resolve_sos", id: s.id })}>
                Resolved
              </Btn>
            </div>
          )
        })}
        {data.alerts.map((j) => {
          const p = pro(j.proId)
          return (
            <div key={j.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold uppercase">{j.safety.level}</span>
              <span>
                {j.safety.message} · {j.id} · {p?.name ?? "unassigned"} · {j.subArea ?? j.area}
              </span>
              <span className="flex-1" />
              {p && (
                <a href={`tel:${p.phone}`} className="h-8 px-3 rounded-full bg-white text-black inline-flex items-center font-medium">
                  Call {p.name.split(" ")[0]}
                </a>
              )}
              <a href={`tel:${j.customer.phone}`} className="h-8 px-3 rounded-full bg-black/20 inline-flex items-center font-medium">
                Call customer
              </a>
              {j.safety.level !== "late" && (
                <Btn size="sm" variant="dark" busy={busy === j.id} onClick={() => run(j.id, { action: "event", jobId: j.id, type: "safe", note: "Confirmed safe by ops" })}>
                  Confirmed safe
                </Btn>
              )}
            </div>
          )
        })}
      </div>
    </motion.section>
  )
}
