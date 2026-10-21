"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { api, pkr } from "../kit"
import { Section, Stat } from "./money"

// The KPI dashboard: bookings, completion rate, GMV, repeat rate, visits per pro-day and
// unreconciled cash, for the last 7, 30 or 90 days.

type Report = {
  from: string
  to: string
  bookings: number
  completed: number
  cancelled: number
  noShow: number
  completionRate: number | null
  gmv: number
  avgOrder: number
  customers: number
  repeatCustomers: number
  repeatRate: number | null
  proDays: number
  visitsPerProDay: number | null
  byDay: { date: string; bookings: number; completed: number; gmv: number }[]
  cashHeld: number
  unreconciled: { count: number; amount: number }
  books: boolean | null
}

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`)

export function KpiTab() {
  const [days, setDays] = useState(30)
  const [r, setR] = useState<Report | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    setR(null)
    api<Report>(`/api/ops/kpi?days=${days}`).then(setR, (e) => setError((e as Error).message))
  }, [days])
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-3xl">KPIs</h2>
          <p className="text-sm text-zinc-500 mt-1">{r ? `${r.from} to ${r.to}` : "Loading"} · by visit day</p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((n) => (
            <button key={n} onClick={() => setDays(n)} aria-pressed={days === n} className={cn("h-9 px-3.5 rounded-full border text-sm", days === n ? "bg-black text-white border-black" : "border-black/15 bg-white")}>
              {n} days
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!r ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-24 rounded-3xl bg-black/[0.04] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat k="Bookings" v={r.bookings} hint={`${r.cancelled} cancelled · ${r.noShow} no-show`} />
            <Stat k="Completion rate" v={pct(r.completionRate)} hint="of visits that are over" warn={r.completionRate !== null && r.completionRate < 0.85} />
            <Stat k="GMV (completed)" v={pkr(r.gmv)} hint={`${r.completed} visits · avg ${pkr(r.avgOrder)}`} />
            <Stat k="Repeat rate" v={pct(r.repeatRate)} hint={`${r.repeatCustomers} of ${r.customers} customers came back`} />
            <Stat k="Visits per pro-day" v={r.visitsPerProDay ?? "–"} hint={`${r.proDays} pro-days · target ≥ 2`} warn={r.visitsPerProDay !== null && r.visitsPerProDay < 2} />
            <Stat k="Cash held by pros" v={pkr(r.cashHeld)} hint="now, from the ledger" warn={r.cashHeld > 0} />
            <Stat k="Unreconciled payments" v={r.unreconciled.count} hint={pkr(r.unreconciled.amount)} warn={r.unreconciled.count > 0} />
            <Stat k="Books" v={r.books === null ? "–" : r.books ? "Balanced" : "Off!"} warn={r.books === false} />
          </div>
          <Section title="By day">
            <div className="rounded-3xl bg-white border border-black/[0.06] overflow-x-auto" data-lenis-prevent>
              <table className="w-full text-sm min-w-[420px]">
                <thead className="text-xs text-zinc-500 text-left">
                  <tr>
                    <th className="p-3 font-medium">Day</th>
                    <th className="p-3 font-medium text-right">Bookings</th>
                    <th className="p-3 font-medium text-right">Completed</th>
                    <th className="p-3 font-medium text-right">GMV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {[...r.byDay].reverse().map((d) => (
                    <tr key={d.date} className={d.bookings ? "" : "text-zinc-400"}>
                      <td className="p-3">{new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</td>
                      <td className="p-3 text-right tabular-nums">{d.bookings}</td>
                      <td className="p-3 text-right tabular-nums">{d.completed}</td>
                      <td className="p-3 text-right tabular-nums">{d.gmv ? pkr(d.gmv) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
