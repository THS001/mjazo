"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Activity, BarChart3, Bot, CalendarHeart, Banknote, Inbox, Lock, LogOut, Route, ScrollText, ShieldAlert, Tag, UserPlus, Users, Wallet, Zap, Gift } from "lucide-react"
import type { Job, Pro, SafetyStatus } from "@/lib/ops/types"
import type { OpsPerm } from "@/lib/ops/access"
import { ROLES, ROLE_INFO } from "@/lib/cms/roles"
import { cn } from "@/lib/utils"
import { api, ago, Btn, usePoll } from "../kit"
import { OpsContext, type OpsMe } from "./context"
import { LiveBoard } from "./live"
import { Dispatch } from "./dispatch"
import { ProsTab } from "./pros"
import { Recruiting } from "./recruiting"
import { TrustDesk } from "./trust"
import { AskOps } from "./ask"
import { Weddings } from "./weddings"
import { BookingPage } from "./booking"
import { RequestsInbox } from "./requests"
import { MoneyTab } from "./money"
import { PromosTab } from "./promos"
import { KpiTab } from "./kpi"
import { AuditTab } from "./audit"
import { AutomationsTab } from "./automations"
import { GrowthTab } from "./growth"

export type OpsJob = Job & { safety: SafetyStatus }
export type OpsPro = Omit<Pro, "pinHash"> & { hasPin: boolean }
export type OpsOffer = { id: string; jobId: string; proId: string; expiresAt: string }
export type OpsData = {
  today: string
  date: string
  jobs: OpsJob[]
  alerts: OpsJob[]
  sos: { id: string; proId: string; at: string; lat?: number; lng?: number }[]
  /** Visits offered to a pro and waiting for her answer (the pro app). */
  offers: OpsOffer[]
  /** Auto-assign (mission control → Automations): off, suggest or auto, and its pick per unassigned visit. */
  assignMode?: "off" | "suggest" | "auto"
  suggestions?: Record<string, { proId: string; reasons: string[] }>
  pros: OpsPro[]
  stats: { jobs: number; unassigned: number; live: number; done: number; revenue: number; perProDay: number; unreconciled: number; openComplaints: number; weddingsPending: number }
  days: { date: string; count: number }[]
  ai: boolean
  me: OpsMe
}

/** Each tab and the permissions that show it (any one of them). */
const TABS = [
  { id: "live", label: "Live board", icon: Activity, perms: ["ops.view"] },
  { id: "requests", label: "Requests", icon: Inbox, perms: ["ops.requests"] },
  { id: "dispatch", label: "Route Brain", icon: Route, perms: ["ops.view"] },
  { id: "pros", label: "Pros", icon: Users, perms: ["ops.view"] },
  { id: "recruiting", label: "Recruiting", icon: UserPlus, perms: ["ops.recruit"] },
  { id: "money", label: "Money", icon: Banknote, perms: ["ops.money"] },
  { id: "promos", label: "Promo codes", icon: Tag, perms: ["ops.promos"] },
  { id: "weddings", label: "Weddings", icon: CalendarHeart, perms: ["ops.view"] },
  { id: "trust", label: "Trust Desk", icon: Wallet, perms: ["ops.requests", "ops.money"] },
  { id: "kpi", label: "KPIs", icon: BarChart3, perms: ["ops.kpi"] },
  { id: "audit", label: "Audit log", icon: ScrollText, perms: ["ops.audit"] },
  { id: "growth", label: "Plus & gifts", icon: Gift, perms: ["ops.money"] },
  { id: "automations", label: "Automations", icon: Zap, perms: ["ops.automations"] },
  { id: "ask", label: "Ask AI", icon: Bot, perms: ["ops.ai"] },
] as const satisfies readonly { id: string; label: string; icon: unknown; perms: readonly OpsPerm[] }[]
type Tab = (typeof TABS)[number]["id"]

/** in: signed in with access; signed-out; two-step: must enter their code first; no-access: a role without mission control. */
export type OpsGate = "in" | "signed-out" | "two-step" | "no-access"
type Mode = "supabase" | "dev" | "off"

export function OpsConsole({ gate, mode, who }: { gate: OpsGate; mode: Mode; who: { email: string; role: string } | null }) {
  const [isIn, setIn] = useState(gate === "in")
  useEffect(() => {
    const out = () => setIn(false)
    window.addEventListener("mjazo:staff-logout", out)
    return () => window.removeEventListener("mjazo:staff-logout", out)
  }, [])
  return isIn ? <Shell onLogout={() => window.location.reload()} /> : <Gate gate={gate === "in" ? "signed-out" : gate} mode={mode} who={who} />
}

const signOut = async () => {
  await api("/api/ops/logout", {}).catch(() => {})
  window.location.reload()
}

function Gate({ gate, mode, who }: { gate: Exclude<OpsGate, "in">; mode: Mode; who: { email: string; role: string } | null }) {
  const [role, setRole] = useState<string>("owner")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const devIn = async () => {
    setBusy(true)
    setError("")
    try {
      await api("/api/ops/dev-login", { role })
      window.location.reload()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  const link = "h-14 w-full mt-10 rounded-full bg-[var(--brand)] text-black font-medium inline-flex items-center justify-center hover:brightness-105"
  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div aria-hidden className="absolute -top-40 -right-40 w-[34rem] h-[34rem] rounded-full bg-[var(--brand)] opacity-20 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <span className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-[var(--brand)]" />
        </span>
        <h1 className="font-serif text-5xl mt-8">
          Mjazo <span className="italic text-[var(--brand)]">Ops</span>
        </h1>
        <p className="text-white/55 mt-3">Mission control: the board, bookings, pros, money and the requests inbox.</p>
        {gate === "signed-out" && mode === "supabase" && (
          <>
            <a href="/admin/login?next=/ops" className={link}>
              Sign in with your Mjazo email
            </a>
            <p className="text-xs text-white/40 mt-4 leading-relaxed">Everyone has their own sign-in, so the audit log shows who did what. An Owner invites you from the CMS (People &amp; roles).</p>
          </>
        )}
        {gate === "signed-out" && mode === "dev" && (
          <>
            <p className="mt-10 rounded-2xl bg-white/[0.06] p-4 text-sm text-white/70 leading-relaxed">Local development: Supabase isn&apos;t set up, so pick a role to try mission control as. Never available on the live site.</p>
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className="mt-4 w-full h-14 rounded-2xl bg-white/[0.07] border border-white/10 px-5 text-[16px] outline-none focus:border-[var(--brand)]">
              {ROLES.map((r) => (
                <option key={r} value={r} className="text-black">
                  {ROLE_INFO[r].label}
                </option>
              ))}
            </select>
            {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
            <Btn variant="brand" size="lg" busy={busy} className="w-full mt-4" onClick={devIn}>
              Continue as local {ROLE_INFO[role as keyof typeof ROLE_INFO]?.label ?? role}
            </Btn>
          </>
        )}
        {gate === "signed-out" && mode === "off" && (
          <p className="mt-10 rounded-2xl bg-white/[0.06] p-5 text-sm text-white/70 leading-relaxed">Staff sign-in isn&apos;t set up: it needs the Supabase settings (the same sign-in as the CMS).</p>
        )}
        {gate === "two-step" && (
          <>
            <a href="/admin/two-step?next=/ops" className={link}>
              Finish two-step sign-in
            </a>
            <p className="text-xs text-white/40 mt-4">Your role approves money or runs the business, so it needs your authenticator app&apos;s code.</p>
          </>
        )}
        {gate === "no-access" && (
          <div className="mt-10 rounded-2xl bg-white/[0.06] p-5 text-sm text-white/70 leading-relaxed">
            Signed in as <b className="text-white">{who?.email}</b> ({who?.role}). This role works in the CMS, not mission control. Ask an Owner for a Dispatcher, Support, Finance or Recruiter role.
            <div className="flex gap-2 mt-4">
              <a href="/admin" className="h-10 px-4 rounded-full bg-white text-black inline-flex items-center font-medium">
                Open the CMS
              </a>
              <Btn variant="ghost" className="text-white hover:bg-white/10" onClick={signOut}>
                Sign out
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("live")
  const [booking, setBooking] = useState<string | null>(null)
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
    await api("/api/ops/logout", {}).catch(() => {})
    onLogout()
  }
  const perms = data?.me.perms
  const can = useCallback((...ps: OpsPerm[]) => Boolean(perms && ps.some((p) => perms.includes(p))), [perms])
  const ctx = useMemo(() => ({ me: data?.me ?? { name: "", email: "", role: "", roleLabel: "", perms: [] }, can, openBooking: setBooking }), [data?.me, can])
  const tabs = TABS.filter((t) => can(...t.perms))
  const sosCount = (data?.sos.length ?? 0) + (data?.alerts.filter((a) => a.safety.level === "sos" || a.safety.level === "escalated").length ?? 0)

  return (
    <OpsContext.Provider value={ctx}>
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
          {data && (
            <span className="hidden lg:block text-right text-xs leading-tight shrink-0 max-w-[14rem]">
              <span className="block text-white/80 truncate">{data.me.email}</span>
              <span className="block text-white/40">{data.me.roleLabel}</span>
            </span>
          )}
          <button onClick={logout} aria-label="Sign out" className="w-10 h-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <nav className="max-w-[1500px] mx-auto px-2 sm:px-4 overflow-x-auto no-scrollbar" data-lenis-prevent>
          <div className="flex gap-1 w-max">
            {tabs.map((t) => (
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
            {tab === "requests" && <RequestsInbox />}
            {tab === "dispatch" && <Dispatch date={data.date} reload={load} />}
            {tab === "pros" && <ProsTab pros={data.pros} reload={load} />}
            {tab === "recruiting" && <Recruiting />}
            {tab === "money" && <MoneyTab />}
            {tab === "promos" && <PromosTab />}
            {tab === "weddings" && <Weddings reload={load} />}
            {tab === "trust" && <TrustDesk reload={load} />}
            {tab === "kpi" && <KpiTab />}
            {tab === "audit" && <AuditTab />}
            {tab === "growth" && <GrowthTab />}
            {tab === "automations" && <AutomationsTab />}
            {tab === "ask" && <AskOps ai={data.ai} />}
          </motion.div>
        )}
      </div>
      <AnimatePresence>{booking && <BookingPage key={booking} id={booking} onClose={() => setBooking(null)} reload={load} />}</AnimatePresence>
    </div>
    </OpsContext.Provider>
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
