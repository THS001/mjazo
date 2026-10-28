"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, CircleDashed, PencilLine, Trash2, TrendingUp, XCircle } from "lucide-react"
import type { GateStatus, PilotReport } from "@/lib/ops/pilot"
import { cn } from "@/lib/utils"
import { api, Btn, pkr } from "../kit"
import { inputCls, useOps } from "./context"
import { Section } from "./money"

// KPIs → Pilot gates: what the validation sprint has to show before money goes into the full
// launch (the blueprint analysis's recommended path), measured from the real visits. Finance or an
// Owner enters what the numbers can't know: each month's ad and transport spend, the start date
// and the sales tax assumptions (until the written tax opinion is in).

type Report = PilotReport & {
  window: "pilot" | 30 | 90
  settings: { startDate: string | null; taxRate: number; taxInclusive: boolean; taxBase: "total" | "commission" }
  months: { month: string; marketing: number; transport: number; note?: string; by: string; at: string }[]
}

const STATUS: Record<GateStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  stretch: { label: "Stretch goal met", cls: "bg-emerald-100 text-emerald-900", icon: TrendingUp },
  pass: { label: "Pass", cls: "bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  fail: { label: "Not yet", cls: "bg-red-50 text-red-800", icon: XCircle },
  early: { label: "Too early to tell", cls: "bg-zinc-100 text-zinc-600", icon: CircleDashed },
  input: { label: "Needs an input", cls: "bg-amber-50 text-amber-900", icon: PencilLine },
}

const shown = (key: string, v: number | null) => (v === null ? "–" : ["secondBooking", "proRetention", "leakage"].includes(key) ? `${Math.round(v * 100)}%` : key === "visitsPerProDay" ? v.toFixed(2) : pkr(v))

export function PilotGates() {
  const { can } = useOps()
  const [range, setRange] = useState<"pilot" | "30" | "90">("pilot")
  const [r, setR] = useState<Report | null>(null)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)
  useEffect(() => {
    setError("")
    api<Report>(`/api/ops/pilot?window=${range}`).then(setR, (e) => setError((e as Error).message))
  }, [range, tick])
  const reload = () => setTick((n) => n + 1)

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <h2 className="font-serif text-3xl">Pilot gates</h2>
          <p className="text-sm text-zinc-500 mt-1">
            What the pilot has to show before money goes into the full launch, measured from real visits. {r ? `${r.from} to ${r.to}` : ""}
            {r && r.measured > 0 ? ` · ${r.passed} of ${r.measured} measured gates passed` : ""}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["pilot", "Since the start"],
              ["30", "30 days"],
              ["90", "90 days"],
            ] as const
          ).map(([w, label]) => (
            <button key={w} onClick={() => setRange(w)} aria-pressed={range === w} className={cn("h-9 px-3.5 rounded-full border text-sm", range === w ? "bg-black text-white border-black" : "border-black/15 bg-white")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!r ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-40 rounded-3xl bg-black/[0.04] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {r.gates.map((g) => {
              const s = STATUS[g.status]
              return (
                <div key={g.key} className={cn("rounded-3xl bg-white border p-5 flex flex-col gap-2 min-w-0", g.status === "fail" ? "border-red-200" : g.status === "input" ? "border-amber-200" : "border-black/[0.06]")}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{g.label}</p>
                    <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium", s.cls)}>
                      <s.icon className="w-3.5 h-3.5" /> {s.label}
                    </span>
                  </div>
                  <p className="font-serif text-4xl leading-none">{shown(g.key, g.value)}</p>
                  <p className="text-xs text-zinc-500">Target {g.target}</p>
                  <p className="text-xs text-zinc-600 mt-auto">{g.detail}</p>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-zinc-500 max-w-3xl">
            From the blueprint analysis. A gate says &ldquo;too early&rdquo; until there&rsquo;s enough to judge: 10 customers 60+ days past their first visit, 3 pros 90+ days in, 10 visits, 5 pro-days, 3
            regular pairs. Leakage counts the Trust Desk&rsquo;s open flags; one dismissed there with a reason counts as explained.
          </p>
          {can("ops.money") ? <Inputs r={r} onSaved={reload} /> : <ReadOnlyInputs r={r} />}
        </>
      )}
    </div>
  )
}

function ReadOnlyInputs({ r }: { r: Report }) {
  return (
    <Section title="The pilot's inputs" hint="Finance or an Owner enters these.">
      <p className="text-sm text-zinc-600">
        Start: {r.settings.startDate ?? "the first visit"} · Sales tax {Math.round(r.settings.taxRate * 1000) / 10}% {r.settings.taxInclusive ? "inside the price" : "added on top"}, on {r.settings.taxBase === "total" ? "the whole booking" : "Mjazo's share"} · {r.months.length} month{r.months.length === 1 ? "" : "s"} of spend entered
      </p>
    </Section>
  )
}

function Inputs({ r, onSaved }: { r: Report; onSaved: () => void }) {
  const [start, setStart] = useState(r.settings.startDate ?? "")
  const [rate, setRate] = useState(String(Math.round(r.settings.taxRate * 1000) / 10))
  const [inclusive, setInclusive] = useState(r.settings.taxInclusive)
  const [base, setBase] = useState(r.settings.taxBase)
  const [month, setMonth] = useState(r.to.slice(0, 7))
  const [ads, setAds] = useState("")
  const [transport, setTransport] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  useEffect(() => {
    const m = r.months.find((x) => x.month === month)
    setAds(m ? String(m.marketing) : "")
    setTransport(m ? String(m.transport) : "")
    setNote(m?.note ?? "")
  }, [month, r.months])

  const send = async (key: string, body: Record<string, unknown>, done: string) => {
    setBusy(key)
    setMsg(null)
    try {
      await api("/api/ops/pilot", body)
      setMsg({ text: done, ok: true })
      onSaved()
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false })
    } finally {
      setBusy("")
    }
  }
  const whole = (s: string) => Math.round(Number(s.replace(/[^\d.]/g, "")) || 0)

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Section title="A month's spend" hint="Ads (all channels) and transport for the pros' visits, in whole rupees. Shared out by day over the range you look at.">
        <div className="rounded-3xl bg-white border border-black/[0.06] p-5 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-xs text-zinc-500 space-y-1">
              <span>Month</span>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} />
            </label>
            <label className="text-xs text-zinc-500 space-y-1">
              <span>Ad spend (PKR)</span>
              <input inputMode="numeric" value={ads} onChange={(e) => setAds(e.target.value)} placeholder="0" className={inputCls} />
            </label>
            <label className="text-xs text-zinc-500 space-y-1">
              <span>Transport (PKR)</span>
              <input inputMode="numeric" value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="0" className={inputCls} />
            </label>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional), e.g. Instagram + society WhatsApp groups" className={inputCls} />
          <Btn busy={busy === "month"} disabled={!month || ads === "" || transport === ""} onClick={() => void send("month", { action: "month", month, marketing: whole(ads), transport: whole(transport), note: note || undefined }, `Saved ${month}`)}>
            Save {month || "month"}
          </Btn>
        </div>
        {r.months.length > 0 && (
          <div className="rounded-3xl bg-white border border-black/[0.06] overflow-x-auto mt-3" data-lenis-prevent>
            <table className="w-full text-sm min-w-[420px]">
              <thead className="text-xs text-zinc-500 text-left">
                <tr>
                  <th className="p-3 font-medium">Month</th>
                  <th className="p-3 font-medium text-right">Ads</th>
                  <th className="p-3 font-medium text-right">Transport</th>
                  <th className="p-3 font-medium">Entered by</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {r.months.map((m) => (
                  <tr key={m.month}>
                    <td className="p-3">
                      <button onClick={() => setMonth(m.month)} className="underline underline-offset-4">
                        {m.month}
                      </button>
                      {m.note && <p className="text-xs text-zinc-500">{m.note}</p>}
                    </td>
                    <td className="p-3 text-right tabular-nums">{pkr(m.marketing)}</td>
                    <td className="p-3 text-right tabular-nums">{pkr(m.transport)}</td>
                    <td className="p-3 text-xs text-zinc-500">{m.by}</td>
                    <td className="p-3 text-right">
                      <button aria-label={`Remove ${m.month}`} disabled={busy === `rm${m.month}`} onClick={() => confirm(`Remove the spend for ${m.month}?`) && void send(`rm${m.month}`, { action: "remove_month", month: m.month }, `Removed ${m.month}`)} className="text-zinc-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Start date and sales tax" hint="Until the written tax opinion is in, try the cases: 8% for beauty services, 15% standard, inside the price or on top, on the whole booking or only Mjazo's share. Once Money → Policies charges sales tax, the visits that carry it count what they really paid.">
        <div className="rounded-3xl bg-white border border-black/[0.06] p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-zinc-500 space-y-1">
              <span>Pilot started on</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </label>
            <label className="text-xs text-zinc-500 space-y-1">
              <span>Sales tax (%)</span>
              <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" className={inputCls} />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                [true, "Inside the price (Mjazo pays it)"],
                [false, "Added on top (the customer pays it)"],
              ] as const
            ).map(([v, label]) => (
              <button key={label} type="button" onClick={() => setInclusive(v)} aria-pressed={inclusive === v} className={cn("h-9 px-3.5 rounded-full border text-sm", inclusive === v ? "bg-black text-white border-black" : "border-black/15 bg-white")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["total", "On the whole booking (as principal)"],
                ["commission", "On Mjazo's share only (as agent)"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setBase(v)} aria-pressed={base === v} className={cn("h-9 px-3.5 rounded-full border text-sm", base === v ? "bg-black text-white border-black" : "border-black/15 bg-white")}>
                {label}
              </button>
            ))}
          </div>
          <Btn busy={busy === "settings"} onClick={() => void send("settings", { action: "settings", startDate: start || null, taxRate: Math.min(25, Math.max(0, Number(rate) || 0)) / 100, taxInclusive: inclusive, taxBase: base }, "Saved the start date and sales tax")}>
            Save
          </Btn>
        </div>
      </Section>
      {msg && <p className={cn("text-sm lg:col-span-2", msg.ok ? "text-emerald-700" : "text-red-600")}>{msg.text}</p>}
    </div>
  )
}
