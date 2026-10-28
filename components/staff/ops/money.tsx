"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, ExternalLink, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, Badge, Btn, Empty, pkr } from "../kit"
import { inputCls, useOps } from "./context"
import { Policies } from "./policies"

// Money: cash each pro is holding and what she's owed (from the ledger), refunds and credits
// waiting for approval, payments to reconcile, cash handed in, and payout runs.

type Req = { id: string; kind: "refund" | "credit"; bookingId: string | null; amount: number; reason: string; status: string; requestedBy: string; requestedAt: string; decidedBy: string | null; reference: string | null }
type Payout = { id: string; proId: string; proName: string; earned: number; cashHeld: number; netted: number; amount: number; status: string; reference: string | null; paidAt: string | null; paidBy: string | null }
type Run = { id: string; periodStart: string; periodEnd: string; cutOff: string; status: "draft" | "approved" | "paid" | "cancelled"; createdBy: string; createdAt: string; approvedBy: string | null; payouts: Payout[]; totals: { pay: number; collect: number; netted: number } }
type Overview = {
  perPro: { proId: string; name: string; phone: string; status: string; cashHeld: number; payable: number }[]
  totals: { cashHeld: number; payable: number }
  unreconciled: { id: string; date: string; pro: string; customer: string; total: number; booked: string; record: { amount: number; method: string; status: string; checked?: boolean } | null }[]
  pending: Req[]
  decided: Req[]
  runs: Run[]
  trial: { balanced: boolean }
}

const lastWeek = () => {
  // Monday to Sunday of last week, Karachi time.
  const now = new Date(Date.now() + 5 * 3600_000)
  const dow = (now.getUTCDay() + 6) % 7
  const end = new Date(now.getTime() - (dow + 1) * 86400000)
  const start = new Date(end.getTime() - 6 * 86400000)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })

export function MoneyTab() {
  const { me, openBooking } = useOps()
  const [d, setD] = useState<Overview | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [form, setForm] = useState<Record<string, string>>({})
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const load = () => api<Overview>("/api/ops/money").then(setD, (e) => setError((e as Error).message))
  useEffect(() => void load(), [])
  const run = async (key: string, body: Record<string, unknown>, after?: () => void) => {
    setBusy(key)
    setError("")
    try {
      setD(await api<Overview>("/api/ops/money", body))
      after?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  const trust = async (key: string, body: Record<string, unknown>) => {
    setBusy(key)
    setError("")
    try {
      await api("/api/ops/trust", body)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  if (!d) return error ? <p className="text-sm text-red-600">{error}</p> : <div className="h-40 rounded-3xl bg-black/[0.04] animate-pulse" />
  const week = lastWeek()
  const open = d.runs.find((r) => r.status === "draft" || r.status === "approved")
  const mine = (by: string) => by === me.email && me.role !== "owner"

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-3xl">Money</h2>
          <p className="text-sm text-zinc-500 mt-1">Straight from the ledger. Every refund, credit and payout is approved by a person.</p>
        </div>
        <span className={cn("inline-flex items-center gap-2 text-sm rounded-full px-3 h-9", d.trial.balanced ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>
          {d.trial.balanced ? <CheckCircle2 className="w-4 h-4" /> : <TriangleAlert className="w-4 h-4" />}
          {d.trial.balanced ? "Books balance" : "Books don't balance: tell the developer"}
        </span>
      </div>
      {error && <p className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat k="Cash held by pros" v={pkr(d.totals.cashHeld)} warn={d.totals.cashHeld > 0} />
        <Stat k="Owed to pros" v={pkr(d.totals.payable)} />
        <Stat k="Waiting for approval" v={d.pending.length} warn={d.pending.length > 0} />
        <Stat k="Payments to check (30 days)" v={d.unreconciled.length} warn={d.unreconciled.length > 0} />
      </div>

      <Section title="Refunds and credits waiting for approval">
        {!d.pending.length ? (
          <Empty title="Nothing waiting" body="Support asks for refunds and credits on the booking page; they show up here." />
        ) : (
          <ul className="grid md:grid-cols-2 gap-3">
            {d.pending.map((r) => (
              <li key={r.id} className="rounded-3xl bg-white border border-amber-200 p-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {r.kind === "refund" ? "Refund" : "Credit"} {pkr(r.amount)}
                  </span>
                  {r.bookingId && (
                    <button onClick={() => openBooking(r.bookingId!)} className="ml-auto text-xs underline inline-flex items-center gap-1">
                      {r.bookingId} <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-zinc-600">{r.reason}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Asked by {r.requestedBy} · {when(r.requestedAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {r.kind === "refund" && <input className={cn(inputCls, "h-9 max-w-[13rem]")} placeholder="Transfer reference" value={form[`ref:${r.id}`] ?? ""} onChange={(e) => set(`ref:${r.id}`, e.target.value)} />}
                  <Btn size="sm" busy={busy === `a:${r.id}`} disabled={mine(r.requestedBy) || (r.kind === "refund" && !form[`ref:${r.id}`]?.trim())} onClick={() => run(`a:${r.id}`, { action: "decide", requestId: r.id, approve: true, reference: form[`ref:${r.id}`] })}>
                    Approve
                  </Btn>
                  <Btn size="sm" variant="ghost" busy={busy === `r:${r.id}`} onClick={() => run(`r:${r.id}`, { action: "decide", requestId: r.id, approve: false, note: prompt("Why not? (optional)") ?? undefined })}>
                    Reject
                  </Btn>
                  {mine(r.requestedBy) && <span className="text-xs text-zinc-500">You asked for this: someone else approves it.</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Cash held and owed, per pro" hint="Cash she collected and still holds for Mjazo, and what Mjazo owes her for completed visits. Record cash she hands in here.">
        {!d.perPro.length ? (
          <Empty title="No pros yet" />
        ) : (
          <div className="rounded-3xl bg-white border border-black/[0.06] overflow-x-auto" data-lenis-prevent>
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-xs text-zinc-500 text-left">
                <tr>
                  <th className="p-3 font-medium">Pro</th>
                  <th className="p-3 font-medium text-right">Cash held</th>
                  <th className="p-3 font-medium text-right">Owed to her</th>
                  <th className="p-3 font-medium text-right">Net</th>
                  <th className="p-3 font-medium">Cash handed in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {d.perPro.map((p) => (
                  <tr key={p.proId}>
                    <td className="p-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-zinc-500">{p.phone}</p>
                    </td>
                    <td className={cn("p-3 text-right tabular-nums", p.cashHeld > 0 && "font-semibold")}>{pkr(p.cashHeld)}</td>
                    <td className="p-3 text-right tabular-nums">{pkr(p.payable)}</td>
                    <td className="p-3 text-right tabular-nums text-xs text-zinc-500">{p.payable - p.cashHeld >= 0 ? `Mjazo pays ${pkr(p.payable - p.cashHeld)}` : `She hands in ${pkr(p.cashHeld - p.payable)}`}</td>
                    <td className="p-3">
                      {p.cashHeld > 0 && (
                        <div className="flex gap-1.5">
                          <input className={cn(inputCls, "h-9 w-24 px-3")} inputMode="numeric" placeholder="PKR" value={form[`cash:${p.proId}`] ?? ""} onChange={(e) => set(`cash:${p.proId}`, e.target.value.replace(/\D/g, ""))} aria-label={`Cash handed in by ${p.name}`} />
                          <input className={cn(inputCls, "h-9 w-28 px-3")} placeholder="Receipt" value={form[`cashref:${p.proId}`] ?? ""} onChange={(e) => set(`cashref:${p.proId}`, e.target.value)} aria-label="Receipt number" />
                          <Btn size="sm" variant="light" busy={busy === `cash:${p.proId}`} disabled={!form[`cash:${p.proId}`]} onClick={() => run(`cash:${p.proId}`, { action: "cash_in", proId: p.proId, amount: Number(form[`cash:${p.proId}`]), reference: form[`cashref:${p.proId}`] || undefined }, () => set(`cash:${p.proId}`, ""))}>
                            Record
                          </Btn>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Payout runs" hint="A run nets the cash each pro holds against what she's owed, as the ledger stood at the end of the period. A second person approves it; then each payout is marked paid with its transfer reference, which settles it in the books.">
        {!open && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run("draft", { action: "draft_run", periodStart: form.start || week.start, periodEnd: form.end || week.end })
            }}
            className="rounded-3xl bg-white border border-black/[0.06] p-4 flex flex-wrap items-end gap-3 mb-3"
          >
            <label className="text-xs text-zinc-500">
              From
              <input type="date" className={cn(inputCls, "mt-1 w-44")} value={form.start || week.start} onChange={(e) => set("start", e.target.value)} />
            </label>
            <label className="text-xs text-zinc-500">
              To
              <input type="date" className={cn(inputCls, "mt-1 w-44")} value={form.end || week.end} onChange={(e) => set("end", e.target.value)} />
            </label>
            <Btn busy={busy === "draft"}>Draft a payout run</Btn>
          </form>
        )}
        {!d.runs.length ? (
          <Empty title="No payout runs yet" />
        ) : (
          <div className="space-y-3">
            {d.runs.map((r) => (
              <RunCard key={r.id} r={r} busy={busy} form={form} set={set} mine={mine(r.createdBy)} act={run} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Payments to check" hint="Completed visits whose payment isn't recorded, doesn't match the total, or needs its screenshot checked.">
        {!d.unreconciled.length ? (
          <Empty title="Everything is reconciled" />
        ) : (
          <ul className="rounded-3xl bg-white border border-black/[0.06] divide-y divide-black/[0.06]">
            {d.unreconciled.map((u) => (
              <li key={u.id} className="p-3 sm:p-4 flex flex-wrap items-center gap-3 text-sm">
                <button onClick={() => openBooking(u.id)} className="font-mono text-xs underline">
                  {u.id}
                </button>
                <span className="text-zinc-500">{u.date}</span>
                <span>
                  {u.customer} · {u.pro}
                </span>
                <span className="tabular-nums font-semibold">{pkr(u.total)}</span>
                <span className="text-xs text-zinc-500">{u.record ? `${pkr(u.record.amount)} ${u.record.method} · ${u.record.status}` : `nothing recorded (booked: ${u.booked})`}</span>
                <span className="flex-1" />
                {u.record ? (
                  <Btn size="sm" variant="light" busy={busy === `v:${u.id}`} onClick={() => trust(`v:${u.id}`, { action: "verify", jobId: u.id })}>
                    Mark checked
                  </Btn>
                ) : (
                  <Btn size="sm" variant="light" busy={busy === `c:${u.id}`} onClick={() => confirm(`Record ${pkr(u.total)} cash collected by ${u.pro}?`) && trust(`c:${u.id}`, { action: "record", jobId: u.id, amount: u.total, method: "cash" })}>
                    Record cash
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Policies />

      {d.decided.length > 0 && (
        <Section title="Recent refunds and credits">
          <ul className="rounded-3xl bg-white border border-black/[0.06] divide-y divide-black/[0.06] text-sm">
            {d.decided.map((r) => (
              <li key={r.id} className="p-3 flex flex-wrap gap-2 items-center">
                <Badge className={r.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"}>{r.status}</Badge>
                {r.kind} {pkr(r.amount)} · {r.reason}
                <span className="text-xs text-zinc-500 ml-auto">
                  asked by {r.requestedBy}, {r.status} by {r.decidedBy}
                  {r.reference && ` · ref ${r.reference}`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function RunCard({ r, busy, form, set, mine, act }: { r: Run; busy: string; form: Record<string, string>; set: (k: string, v: string) => void; mine: boolean; act: (key: string, body: Record<string, unknown>) => Promise<void> }) {
  const cls = { draft: "bg-amber-100 text-amber-900", approved: "bg-sky-100 text-sky-800", paid: "bg-emerald-100 text-emerald-800", cancelled: "bg-zinc-100 text-zinc-400" }[r.status]
  return (
    <article className={cn("rounded-3xl bg-white border p-4 sm:p-5", r.status === "cancelled" ? "border-black/[0.04] opacity-60" : "border-black/[0.06]")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cls}>{r.status}</Badge>
        <p className="font-semibold">
          {r.periodStart} to {r.periodEnd}
        </p>
        <span className="text-xs text-zinc-500">
          {r.id} · drafted by {r.createdBy}
          {r.approvedBy && ` · approved by ${r.approvedBy}`}
        </span>
        <span className="flex-1" />
        {r.status === "draft" && (
          <Btn size="sm" busy={busy === `ap:${r.id}`} disabled={mine} onClick={() => act(`ap:${r.id}`, { action: "approve_run", runId: r.id })}>
            Approve run
          </Btn>
        )}
        {(r.status === "draft" || r.status === "approved") && !r.payouts.some((p) => p.status === "paid") && (
          <Btn size="sm" variant="ghost" busy={busy === `x:${r.id}`} onClick={() => confirm("Cancel this payout run?") && act(`x:${r.id}`, { action: "cancel_run", runId: r.id })}>
            Cancel
          </Btn>
        )}
      </div>
      {mine && r.status === "draft" && <p className="text-xs text-zinc-500 mt-1">You drafted this run: someone else approves it.</p>}
      <p className="text-sm text-zinc-600 mt-2">
        Mjazo pays {pkr(r.totals.pay)} · pros hand in {pkr(r.totals.collect)} · {pkr(r.totals.netted)} netted against cash held
      </p>
      <div className="mt-3 overflow-x-auto" data-lenis-prevent>
        <table className="w-full text-sm min-w-[620px]">
          <thead className="text-xs text-zinc-500 text-left">
            <tr>
              <th className="py-2 pr-3 font-medium">Pro</th>
              <th className="py-2 pr-3 font-medium text-right">Owed</th>
              <th className="py-2 pr-3 font-medium text-right">Cash held</th>
              <th className="py-2 pr-3 font-medium text-right">Result</th>
              <th className="py-2 font-medium">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {r.payouts.map((p) => (
              <tr key={p.id}>
                <td className="py-2 pr-3">{p.proName}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{pkr(p.earned)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{pkr(p.cashHeld)}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-medium">{p.amount >= 0 ? `pay ${pkr(p.amount)}` : `collect ${pkr(-p.amount)}`}</td>
                <td className="py-2">
                  {p.status === "paid" ? (
                    <span className="text-xs text-emerald-700">
                      ✓ {p.reference ?? "netted"} · {p.paidBy}
                    </span>
                  ) : r.status === "approved" ? (
                    <div className="flex gap-1.5">
                      {p.amount !== 0 && <input className={cn(inputCls, "h-9 w-36 px-3")} placeholder={p.amount > 0 ? "Transfer ref" : "Receipt no."} value={form[`po:${p.id}`] ?? ""} onChange={(e) => set(`po:${p.id}`, e.target.value)} aria-label={`Reference for ${p.proName}`} />}
                      <Btn size="sm" variant="light" busy={busy === `po:${p.id}`} disabled={p.amount !== 0 && !form[`po:${p.id}`]?.trim()} onClick={() => act(`po:${p.id}`, { action: "pay", payoutId: p.id, reference: form[`po:${p.id}`] ?? "" })}>
                        {p.amount >= 0 ? "Mark paid" : "Mark collected"}
                      </Btn>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">{p.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-zinc-500">{title}</h3>
      {hint && <p className="text-xs text-zinc-400 mt-1 max-w-3xl">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function Stat({ k, v, warn, hint }: { k: string; v: string | number; warn?: boolean; hint?: string }) {
  return (
    <div className={cn("rounded-3xl bg-white border p-4 sm:p-5 min-w-0", warn ? "border-amber-300" : "border-black/[0.06]")}>
      <p className="text-xs text-zinc-500">{k}</p>
      <p className="font-serif text-3xl mt-1.5 leading-none truncate">{v}</p>
      {hint && <p className="text-[11px] text-zinc-400 mt-1.5">{hint}</p>}
    </div>
  )
}
