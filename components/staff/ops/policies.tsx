"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { keepPct, taxPct, type PairRatePolicy, type TaxPolicy } from "@/lib/ops/policy"
import { api, Btn, Empty, pkr } from "../kit"
import { inputCls } from "./context"
import { Section } from "./money"

// Money → Policies (Finance or an Owner): the money policies Mjazo applies by itself, and the
// sales tax on receipts by month for the SRB return. Every change is in the audit log.

type TaxMonth = { month: string; receipts: number; total: number; taxable: number; tax: number }
type Overview = { ready: boolean; tax: TaxPolicy; taxMonths: TaxMonth[]; pairRate: PairRatePolicy }

const Choice = <T extends string | boolean>({ value, set, options }: { value: T; set: (v: T) => void; options: readonly (readonly [T, string])[] }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(([v, label]) => (
      <button key={String(v)} type="button" onClick={() => set(v)} aria-pressed={value === v} className={cn("h-9 px-3.5 rounded-full border text-sm", value === v ? "bg-black text-white border-black" : "border-black/15 bg-white")}>
        {label}
      </button>
    ))}
  </div>
)

export function Policies() {
  const [d, setD] = useState<Overview | null>(null)
  const [error, setError] = useState("")
  useEffect(() => void api<Overview>("/api/ops/policy").then(setD, (e) => setError((e as Error).message)), [])
  if (!d) return error ? <p className="text-sm text-red-600">{error}</p> : null
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-3xl">Policies</h2>
        <p className="text-sm text-zinc-500 mt-1">What Mjazo applies by itself. Every value here is a placeholder until the founder confirms it.</p>
      </div>
      {!d.ready && <p className="rounded-2xl bg-amber-50 text-amber-900 px-4 py-3 text-sm">Run the database update (migration 0014) to switch on receipts and sales tax.</p>}
      <TaxCard d={d} onSaved={setD} />
      <PairRateCard d={d} onSaved={setD} />
    </div>
  )
}

function TaxCard({ d, onSaved }: { d: Overview; onSaved: (o: Overview) => void }) {
  const p = d.tax
  const [from, setFrom] = useState(p.from ?? "")
  const [rate, setRate] = useState(taxPct(p.rate))
  const [inclusive, setInclusive] = useState(p.inclusive)
  const [base, setBase] = useState(p.base)
  const [registration, setRegistration] = useState(p.registration)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const save = async () => {
    // A typo must not switch the tax off: anything but a number from 0 to 25 is refused.
    const pct = Number(rate.replace("%", "").trim() || "0")
    if (!Number.isFinite(pct) || pct < 0 || pct > 25) return setMsg({ text: "Enter a rate from 0 to 25 (%)", ok: false })
    setBusy(true)
    setMsg(null)
    try {
      onSaved(await api<Overview>("/api/ops/policy", { action: "tax", from: from || null, rate: pct / 100, inclusive: base === "commission" ? true : inclusive, base, registration }))
      setMsg({ text: "Saved", ok: true })
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false })
    } finally {
      setBusy(false)
    }
  }
  const on = Boolean(p.from && p.rate > 0)
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Section title="Sales tax on receipts" hint="Bookings made from the start day carry the tax, frozen on the booking. Inside the price, prices stay as they are and Mjazo pays it from its share; on top, checkout adds it and the pro collects it. The pro's share never changes. Set it once the written tax opinion is in.">
        <div className="rounded-3xl bg-white border border-black/[0.06] p-5 space-y-3">
          <p className={cn("text-sm rounded-2xl px-3 py-2", on ? "bg-emerald-50 text-emerald-800" : "bg-zinc-50 text-zinc-600")}>
            {on ? `Charged since ${p.from}: ${taxPct(p.rate)}% ${p.inclusive ? "inside the price" : "added on top"}, on ${p.base === "total" ? "the whole booking" : "Mjazo's share"}.` : "Not charged. Receipts show no tax."}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-zinc-500 space-y-1">
              <span>Charge it on bookings made from</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            </label>
            <label className="text-xs text-zinc-500 space-y-1">
              <span>Rate (%)</span>
              <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" className={inputCls} />
            </label>
          </div>
          <Choice value={base} set={setBase} options={[["total", "On the whole booking (as principal)"], ["commission", "On Mjazo's share only (as agent)"]] as const} />
          {base === "total" ? <Choice value={inclusive} set={setInclusive} options={[[true, "Inside the price (Mjazo pays it)"], [false, "Added on top (the customer pays it)"]] as const} /> : <p className="text-xs text-zinc-500">On Mjazo's share, the tax is always inside the price.</p>}
          <label className="text-xs text-zinc-500 space-y-1 block">
            <span>SRB / NTN registration (printed on receipts)</span>
            <input value={registration} onChange={(e) => setRegistration(e.target.value)} maxLength={60} placeholder="e.g. S1234567-8" className={inputCls} />
          </label>
          <div className="flex items-center gap-3">
            <Btn busy={busy} disabled={!d.ready} onClick={() => void save()}>
              Save sales tax
            </Btn>
            {msg && <span className={cn("text-sm", msg.ok ? "text-emerald-700" : "text-red-600")}>{msg.text}</span>}
          </div>
          <p className="text-xs text-zinc-400">To stop charging it, clear the start day or set the rate to 0. Bookings already made keep theirs.</p>
        </div>
      </Section>

      <Section title="Sales tax by month" hint="From the receipts (Karachi time), for the SRB return. The CSV lists every receipt of the month.">
        {!d.taxMonths.length ? (
          <Empty title="No receipts yet" body="A receipt is issued when a visit is done." />
        ) : (
          <div className="rounded-3xl bg-white border border-black/[0.06] overflow-x-auto" data-lenis-prevent>
            <table className="w-full text-sm min-w-[520px]">
              <thead className="text-xs text-zinc-500 text-left">
                <tr>
                  <th className="p-3 font-medium">Month</th>
                  <th className="p-3 font-medium text-right">Receipts</th>
                  <th className="p-3 font-medium text-right">Total</th>
                  <th className="p-3 font-medium text-right">Taxed value</th>
                  <th className="p-3 font-medium text-right">Sales tax</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {d.taxMonths.map((m) => (
                  <tr key={m.month}>
                    <td className="p-3">{m.month}</td>
                    <td className="p-3 text-right tabular-nums">{m.receipts}</td>
                    <td className="p-3 text-right tabular-nums">{pkr(m.total)}</td>
                    <td className="p-3 text-right tabular-nums">{pkr(m.taxable)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{pkr(m.tax)}</td>
                    <td className="p-3 text-right">
                      <a href={`/api/ops/policy?csv=${m.month}`} className="inline-flex items-center gap-1 text-xs underline underline-offset-4">
                        <Download className="w-3.5 h-3.5" /> CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

function PairRateCard({ d, onSaved }: { d: Overview; onSaved: (o: Overview) => void }) {
  const p = d.pairRate
  const [on, setOn] = useState(p.on)
  const [rate, setRate] = useState(taxPct(p.rate))
  const [fromVisit, setFromVisit] = useState(String(p.fromVisit))
  const [days, setDays] = useState(String(p.days))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const save = async () => {
    const pct = Number(rate.replace("%", "").trim())
    if (!rate.trim() || !Number.isFinite(pct) || pct < 0 || pct > 50) return setMsg({ text: "Enter Mjazo's share from 0 to 50 (%)", ok: false })
    setBusy(true)
    setMsg(null)
    try {
      onSaved(await api<Overview>("/api/ops/policy", { action: "pair_rate", on, rate: pct / 100, fromVisit: Number(fromVisit), days: Number(days) }))
      setMsg({ text: "Saved", ok: true })
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section title="Regular customers" hint="A lower share for Mjazo when a customer books the same pro again, so she earns more by keeping her regulars on Mjazo than by going direct. Never more than her own rate. Pros see it on the offer and the visit; the ledger posts it when the visit is done.">
      <div className="rounded-3xl bg-white border border-black/[0.06] p-5 space-y-3 max-w-xl">
        <p className={cn("text-sm rounded-2xl px-3 py-2", p.on ? "bg-emerald-50 text-emerald-800" : "bg-zinc-50 text-zinc-600")}>
          {p.on ? `On: from a customer's visit number ${p.fromVisit} with the same pro in ${p.days} days, Mjazo takes ${taxPct(p.rate)}% and she keeps ${keepPct(p.rate)}%.` : "Off: every visit is at the pro's own rate."}
        </p>
        <Choice value={on} set={setOn} options={[[true, "On"], [false, "Off"]] as const} />
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs text-zinc-500 space-y-1">
            <span>Mjazo's share (%)</span>
            <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} />
          </label>
          <label className="text-xs text-zinc-500 space-y-1">
            <span>From visit number</span>
            <input inputMode="numeric" value={fromVisit} onChange={(e) => setFromVisit(e.target.value)} className={inputCls} />
          </label>
          <label className="text-xs text-zinc-500 space-y-1">
            <span>Counting the last (days)</span>
            <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Btn busy={busy} onClick={() => void save()}>
            Save
          </Btn>
          {msg && <span className={cn("text-sm", msg.ok ? "text-emerald-700" : "text-red-600")}>{msg.text}</span>}
        </div>
        <p className="text-xs text-zinc-400">Applies to visits finished from now on, and to what pros see on their offers and visits.</p>
      </div>
    </Section>
  )
}
