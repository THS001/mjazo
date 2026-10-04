"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Car, MessageCircle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, Btn, Empty, waTo } from "../kit"

type StopJob = { id: string; window: string; area: string; customer: string; services: string; status: string }
type Plan = {
  applied: boolean
  before: number
  after: number
  perProDay: number
  routes: { proId: string; proName: string; home: string; stops: { jobId: string; area: string; window: string; eta: string; travelMin: number; durationMin: number; job: StopJob }[] }[]
  unassigned: { jobId: string; reason: string; job: StopJob }[]
  gaps: { proId: string; proName: string; area: string; candidates: { name: string; phone: string; area: string; lastDate: string; daysSince: number; services: string; message: string }[] }[]
}

const DAY_START = 9 * 60
const DAY_END = 21 * 60
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

export function Dispatch({ date, reload }: { date: string; reload: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [busy, setBusy] = useState<"" | "plan" | "apply">("")
  const [error, setError] = useState("")
  const run = async (apply: boolean) => {
    setBusy(apply ? "apply" : "plan")
    setError("")
    try {
      setPlan(await api<Plan>("/api/ops/route-plan", { date, apply }))
      if (apply) reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  useEffect(() => {
    setPlan(null)
    run(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const saved = plan ? plan.before - plan.after : 0
  return (
    <div className="space-y-8">
      <div className="rounded-[32px] bg-[#0b0b0b] text-white p-6 sm:p-8 relative overflow-hidden">
        <div aria-hidden className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[var(--brand)] opacity-25 blur-[100px]" />
        <div className="relative flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="flex-1">
            <p className="flex items-center gap-2 text-sm text-[var(--brand)]">
              <Sparkles className="w-4 h-4" /> Route Brain
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl mt-2">Fewer kilometres, more visits.</h2>
            <p className="text-white/60 mt-2 max-w-xl">Assigns {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}&apos;s bookings to the closest pro with the right skills who can arrive inside the window, and prefers the pro a customer had before. Jobs already under way stay put.</p>
          </div>
          <div className="flex gap-2">
            <Btn variant="light" className="bg-white/10 text-white border-white/15" busy={busy === "plan"} onClick={() => run(false)}>
              Re-plan
            </Btn>
            <Btn variant="brand" busy={busy === "apply"} disabled={!plan?.routes.length} onClick={() => run(true)}>
              Apply plan <ArrowRight className="w-4 h-4" />
            </Btn>
          </div>
        </div>
        {plan && (
          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {[
              { k: "Travel now", v: `${plan.before} min` },
              { k: "Travel with plan", v: `${plan.after} min` },
              { k: "Saved", v: saved > 0 ? `${saved} min` : "–" },
              { k: "Visits per working pro", v: plan.perProDay || "–" },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-white/[0.06] p-4">
                <p className="text-xs text-white/50">{x.k}</p>
                <p className="font-serif text-2xl mt-1">{x.v}</p>
              </div>
            ))}
          </div>
        )}
        {plan?.applied && <p className="relative mt-4 text-sm text-emerald-300">Plan applied. Pros see their route in the pro app.</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {plan && !plan.routes.length && !plan.unassigned.length && <Empty title="Nothing to plan" body="No open bookings on this day." />}

      {plan && plan.routes.length > 0 && (
        <section className="space-y-3">
          <div className="hidden sm:flex pl-[196px] pr-4 text-[11px] text-zinc-400">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="flex-1">
                {((9 + i * 2 + 11) % 12) + 1}
                {9 + i * 2 < 12 ? " am" : " pm"}
              </span>
            ))}
          </div>
          {plan.routes.map((r, ri) => (
            <motion.div key={r.proId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ri * 0.05 }} className="rounded-3xl bg-white border border-black/[0.06] p-4 sm:flex sm:items-center gap-4">
              <div className="sm:w-[164px] shrink-0">
                <p className="font-semibold truncate">{r.proName}</p>
                <p className="text-xs text-zinc-500">
                  from {r.home} · {r.stops.length} visits
                </p>
              </div>
              <div className="relative h-14 flex-1 mt-3 sm:mt-0 rounded-2xl bg-[oklch(0.975_0.008_80)] hidden sm:block">
                {r.stops.map((s) => {
                  const start = toMin(s.eta)
                  const left = ((start - DAY_START) / (DAY_END - DAY_START)) * 100
                  const width = (s.durationMin / (DAY_END - DAY_START)) * 100
                  const tl = (s.travelMin / (DAY_END - DAY_START)) * 100
                  return (
                    <div key={s.jobId}>
                      <div className="absolute top-1/2 -translate-y-1/2 h-1 bg-[repeating-linear-gradient(90deg,#a1a1aa_0_4px,transparent_4px_8px)]" style={{ left: `${Math.max(0, left - tl)}%`, width: `${tl}%` }} title={`${s.travelMin} min travel`} />
                      <div className="absolute top-1.5 bottom-1.5 rounded-xl bg-black text-white px-2 flex flex-col justify-center overflow-hidden" style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }} title={`${s.job.customer} · ${s.job.services}`}>
                        <span className="text-[11px] font-semibold truncate">{s.eta} {s.area}</span>
                        <span className="text-[10px] text-white/60 truncate">{s.job.customer}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <ol className="sm:hidden mt-3 space-y-2">
                {r.stops.map((s, i) => (
                  <li key={s.jobId} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center">{i + 1}</span>
                    <span className="font-medium">{s.eta}</span> {s.area} · {s.job.customer}
                    <span className="ml-auto text-xs text-zinc-400 flex items-center gap-1">
                      <Car className="w-3 h-3" /> {s.travelMin}m
                    </span>
                  </li>
                ))}
              </ol>
            </motion.div>
          ))}
        </section>
      )}

      {plan && plan.unassigned.length > 0 && (
        <section>
          <h3 className="font-semibold mb-3">Can&apos;t be assigned ({plan.unassigned.length})</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {plan.unassigned.map((u) => (
              <div key={u.jobId} className="rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm">
                <p className="font-medium">
                  {u.job.window} · {u.job.area} · {u.job.customer}
                </p>
                <p className="text-zinc-600 mt-0.5">{u.job.services}</p>
                <p className="text-amber-800 mt-2">{u.reason}. Add or move a pro, or call the customer to shift the time.</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {plan && plan.gaps.length > 0 && (
        <section>
          <h3 className="font-semibold">Fill the gaps</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-4">These pros have room. Past customers nearby who are due again; message them yourself if it suits.</p>
          <div className="grid lg:grid-cols-2 gap-3">
            {plan.gaps.map((g) => (
              <div key={g.proId} className="rounded-3xl bg-white border border-black/[0.06] p-5">
                <p className="font-semibold">
                  {g.proName} <span className="font-normal text-zinc-500">· near {g.area}</span>
                </p>
                <ul className="mt-3 divide-y divide-black/[0.05]">
                  {g.candidates.map((c) => (
                    <li key={c.phone} className="py-2.5 flex items-center gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {c.name} <span className="font-normal text-zinc-500">· {c.area}</span>
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {c.services} · {c.daysSince} days ago
                        </p>
                      </div>
                      <a href={waTo(c.phone, c.message)} target="_blank" rel="noreferrer" className={cn("h-9 px-3 rounded-full bg-[#25D366] text-foreground inline-flex items-center gap-1.5 text-xs font-medium shrink-0")}>
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
