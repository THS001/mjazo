"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, HeartHandshake, MessageCircle, Star, Sunrise, TrendingDown } from "lucide-react"
import type { Digest, LeakFlag, ProQuality } from "@/lib/ops/trust"
import type { AuditEntry } from "@/lib/server/audit"
import { cn } from "@/lib/utils"
import { api, ago, Badge, Btn, Empty, waTo } from "../kit"
import type { TrustTab } from "./trust"

export type Insights = { today: string; digest: Digest; quality: ProQuality[]; leakage: LeakFlag[]; audit: AuditEntry[] }

export function TodayView({ insights, go }: { insights: Insights; go: (t: TrustTab) => void }) {
  const c = insights.digest.counts
  const queue = [
    { n: c.drafts, label: "Complaint resolutions to approve", tab: "complaints" as const, icon: ClipboardList },
    { n: c.toCheck + c.unpaid, label: "Payments to check or record", tab: "payments" as const, icon: AlertTriangle },
    { n: c.quality, label: "Pros needing a quality conversation", tab: "quality" as const, icon: TrendingDown },
    { n: c.leakage, label: "Friendly check-ins to send", tab: "leakage" as const, icon: HeartHandshake },
  ]
  return (
    <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4 items-start">
      <div className="rounded-[32px] bg-[#0b0b0b] text-white p-6 sm:p-8 relative overflow-hidden">
        <div aria-hidden className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-[var(--brand)] opacity-20 blur-[90px]" />
        <p className="relative flex items-center gap-2 text-sm text-[var(--brand)]">
          <Sunrise className="w-4 h-4" /> Morning brief ·{" "}
          {new Date(`${insights.today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
        </p>
        <ul className="relative mt-5 space-y-3">
          {insights.digest.lines.map((l, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="text-lg sm:text-xl leading-snug font-serif">
              {l}
            </motion.li>
          ))}
        </ul>
        <p className="relative mt-6 text-xs text-white/45">Counted from bookings, payments, ratings and complaints. Ask AI for the detail behind any line.</p>
      </div>
      <div className="rounded-[32px] bg-white border border-black/[0.06] p-5 sm:p-6">
        <p className="font-semibold">Needs a person</p>
        <p className="text-xs text-zinc-500 mt-0.5">The AI drafts; people approve every refund, payout and message.</p>
        <ul className="mt-4 space-y-2">
          {queue.map((q) => (
            <li key={q.label}>
              <button onClick={() => go(q.tab)} className="w-full flex items-center gap-3 rounded-2xl border border-black/[0.06] px-4 py-3 text-left hover:border-black/25 transition-colors">
                <q.icon className={cn("w-4 h-4 shrink-0", q.n ? "text-[var(--brand-ink)]" : "text-zinc-300")} />
                <span className="flex-1 text-sm">{q.label}</span>
                <span className={cn("font-serif text-2xl", !q.n && "text-zinc-300")}>{q.n}</span>
                <ArrowRight className="w-4 h-4 text-zinc-400" />
              </button>
            </li>
          ))}
        </ul>
        {c.lowRatings > 0 && (
          <p className="mt-4 text-sm flex items-center gap-2 text-zinc-600">
            <Star className="w-4 h-4 text-amber-500" /> {c.lowRatings} low rating{c.lowRatings > 1 ? "s" : ""} this week, see Quality.
          </p>
        )}
      </div>
    </div>
  )
}

export function QualityView({ quality }: { quality: ProQuality[] }) {
  const [all, setAll] = useState(false)
  const rows = quality.filter((q) => all || q.level !== "ok")
  return (
    <section>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-3xl">Quality drift</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">Last 14 days against the 6 weeks before: ratings, complaints, late check-ins, visits much shorter than the service time, and price-at-the-door reports. Flags start a coaching conversation, not a penalty.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="w-4 h-4 accent-black" /> Show every pro
        </label>
      </div>
      {!rows.length ? (
        <Empty className="mt-4" title="No drift" body="No pro has enough warning signs to flag. Ratings appear here as customers rate their visits." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-3 mt-5">
          {rows.map((q) => (
            <article key={q.proId} className={cn("min-w-0 rounded-3xl bg-white border p-5", q.level === "act" ? "border-red-300" : q.level === "watch" ? "border-amber-300" : "border-black/[0.06]")}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{q.name}</p>
                  <p className="text-xs text-zinc-500">
                    {q.area} · {q.recent.visits} visit{q.recent.visits === 1 ? "" : "s"} in 14 days
                  </p>
                </div>
                <Badge className={q.level === "act" ? "bg-red-100 text-red-700" : q.level === "watch" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>{q.level === "act" ? "Talk this week" : q.level === "watch" ? "Watch" : "Good"}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                {[
                  { k: "Rating", now: q.recent.avg?.toFixed(1) ?? "–", before: q.baseline.avg?.toFixed(1) ?? "–" },
                  { k: "Late", now: q.recent.visits ? `${Math.round((q.recent.late / q.recent.visits) * 100)}%` : "–", before: q.baseline.visits ? `${Math.round((q.baseline.late / q.baseline.visits) * 100)}%` : "–" },
                  { k: "Complaints", now: String(q.recent.complaints), before: String(q.baseline.complaints) },
                ].map((m) => (
                  <div key={m.k} className="rounded-2xl bg-[oklch(0.975_0.008_80)] py-2.5">
                    <p className="text-[11px] text-zinc-500">{m.k}</p>
                    <p className="font-serif text-xl leading-tight">{m.now}</p>
                    <p className="text-[10px] text-zinc-400">before {m.before}</p>
                  </div>
                ))}
              </div>
              {q.signals.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {q.signals.map((s) => (
                    <li key={s.key} className="flex gap-2">
                      <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", s.severity === "act" ? "bg-red-500" : "bg-amber-400")} />
                      <span>
                        <b>{s.label}:</b> {s.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {q.coaching && <p className="mt-4 text-sm rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-ink)] p-3">{q.coaching}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function LeakageView({ flags, onChange }: { flags: LeakFlag[]; onChange: () => void }) {
  const [busy, setBusy] = useState("")
  const act = async (key: string, action: "leak_checkin" | "leak_dismiss", note?: string) => {
    setBusy(key + action)
    try {
      await api("/api/ops/insights", { action, key, note })
      onChange()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  return (
    <section>
      <h2 className="font-serif text-3xl">Leakage watch</h2>
      <p className="text-sm text-zinc-500 mt-1 max-w-2xl">Regular customer–pro pairs where the customer has gone quiet for well past their usual gap while the pro stayed busy, often nearby. It may be nothing: people travel, move or switch services. Each flag starts a friendly check-in, never an accusation.</p>
      {!flags.length ? (
        <Empty className="mt-4" title="No quiet regulars" body="Pairs appear here after 3+ visits together and a long silence while the pro keeps working." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-3 mt-5">
          {flags.map((f) => (
            <article key={f.key} className="min-w-0 rounded-3xl bg-white border border-black/[0.06] p-5">
              <p className="font-semibold">
                {f.customer} <span className="font-normal text-zinc-500">& {f.proName}</span>
              </p>
              <p className="text-xs text-zinc-500">
                {f.area} · last visit {f.lastDate} · {f.daysSince} days ago
              </p>
              <ul className="mt-3 space-y-1 text-sm text-zinc-700">
                {f.signals.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm rounded-2xl bg-[oklch(0.975_0.008_80)] p-3 leading-relaxed" dir="auto">
                {f.checkIn}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <a href={waTo(f.phone, f.checkIn)} target="_blank" rel="noreferrer" onClick={() => act(f.key, "leak_checkin", "WhatsApp check-in opened")} className="h-9 px-3.5 rounded-full bg-[#25D366] text-foreground inline-flex items-center gap-1.5 text-[13px] font-medium">
                  <MessageCircle className="w-3.5 h-3.5" /> Send check-in
                </a>
                <Btn
                  size="sm"
                  variant="ghost"
                  busy={busy === f.key + "leak_dismiss"}
                  onClick={() => {
                    const note = prompt("Why dismiss? (e.g. moved away, travelling)")
                    if (note !== null) act(f.key, "leak_dismiss", note || undefined)
                  }}
                >
                  Not a concern
                </Btn>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function ActivityView({ log }: { log: AuditEntry[] }) {
  return (
    <section>
      <h2 className="font-serif text-3xl">Activity log</h2>
      <p className="text-sm text-zinc-500 mt-1">Every assignment, payment check, complaint decision, hire and safety action, newest first.</p>
      {!log.length ? (
        <Empty className="mt-4" title="Nothing logged yet" />
      ) : (
        <ol className="mt-5 rounded-3xl bg-white border border-black/[0.06] divide-y divide-black/[0.05]">
          {log.map((e) => (
            <li key={e.id} className="px-5 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
              <span className="text-xs text-zinc-400 w-20 shrink-0">{ago(e.at)}</span>
              <Badge className={cn("normal-case tracking-normal", e.actor === "ops" ? "bg-black text-white" : e.actor === "pro" ? "bg-sky-100 text-sky-800" : e.actor === "customer" ? "bg-[var(--brand-soft)] text-[var(--brand-ink)]" : "bg-violet-100 text-violet-800")}>{e.actor === "system" ? "AI" : e.actor}</Badge>
              <span className="font-medium">{e.action}</span>
              {e.target && <span className="font-mono text-xs text-zinc-500">{e.target}</span>}
              {e.detail && <span className="text-zinc-500 truncate max-w-full">· {e.detail}</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-xs text-zinc-400 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> Showing the latest 80 entries.
      </p>
    </section>
  )
}
