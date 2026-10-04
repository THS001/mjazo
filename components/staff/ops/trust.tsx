"use client"

import { useState } from "react"
import { Image as ImageIcon, MessageCircle, Sparkles } from "lucide-react"
import type { Complaint, PaymentRecord } from "@/lib/ops/types"
import { cn } from "@/lib/utils"
import { api, ago, Badge, Btn, Empty, pkr, usePoll, waTo } from "../kit"
import { ActivityView, LeakageView, QualityView, TodayView, type Insights } from "./trust-insights"

type CashRow = { id: string; date: string; pro: string; customer: string; total: number; booked: string; needsCheck: boolean; record: (Omit<PaymentRecord, "screenshot"> & { screenshot?: string }) | null }
type Trust = { cash: CashRow[]; expected: number; collected: number; complaints: (Omit<Complaint, "photo" | "audio"> & { photo?: string; audio?: string })[]; ai: boolean }

const PAY: Record<string, { label: string; cls: string }> = {
  cash: { label: "Cash", cls: "bg-zinc-100 text-zinc-700" },
  matched: { label: "Matched", cls: "bg-emerald-100 text-emerald-800" },
  mismatch: { label: "Mismatch", cls: "bg-red-100 text-red-700" },
  unreadable: { label: "Unreadable", cls: "bg-amber-100 text-amber-800" },
  pending: { label: "To check", cls: "bg-amber-100 text-amber-800" },
  missing: { label: "Not recorded", cls: "bg-red-100 text-red-700" },
}
const RES: Record<string, string> = { redo: "Free redo", partial_refund: "Partial refund", full_refund: "Full refund", apology: "Apology", investigate: "Investigate" }

const SUBTABS = [
  { id: "today", label: "Today" },
  { id: "payments", label: "Payments" },
  { id: "complaints", label: "Complaints" },
  { id: "quality", label: "Quality" },
  { id: "leakage", label: "Leakage" },
  { id: "activity", label: "Activity log" },
] as const
export type TrustTab = (typeof SUBTABS)[number]["id"]

export function TrustDesk({ reload }: { reload: () => void }) {
  const [tab, setTab] = useState<TrustTab>("today")
  const [data, setData] = useState<Trust | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [only, setOnly] = useState(true)
  const load = async () => {
    const [t, i] = await Promise.all([api<Trust>("/api/ops/trust").catch(() => null), api<Insights>("/api/ops/insights").catch(() => null)])
    if (t) setData(t)
    if (i) setInsights(i)
  }
  usePoll(load, 30000)
  const changed = () => {
    load()
    reload()
  }
  if (!data || !insights) return <div className="h-64 rounded-3xl bg-black/[0.04] animate-pulse" />
  const rows = data.cash.filter((r) => !only || r.needsCheck)
  const gap = data.expected - data.collected
  const badge: Partial<Record<TrustTab, number>> = {
    payments: data.cash.filter((r) => r.needsCheck).length,
    complaints: data.complaints.filter((c) => c.status !== "resolved").length,
    quality: insights.quality.filter((q) => q.level === "act").length,
    leakage: insights.leakage.length,
  }
  return (
    <div className="space-y-8">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" data-lenis-prevent role="tablist">
        {SUBTABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("h-10 px-4 rounded-full text-sm whitespace-nowrap flex items-center gap-2 transition-colors", tab === t.id ? "bg-black text-white" : "bg-white border border-black/[0.08] text-zinc-600 hover:border-black/30")}>
            {t.label}
            {!!badge[t.id] && <span className={cn("min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center", tab === t.id ? "bg-[var(--brand)] text-black" : "bg-black/[0.07]")}>{badge[t.id]}</span>}
          </button>
        ))}
      </div>

      {tab === "today" && <TodayView insights={insights} go={setTab} />}

      {tab === "payments" && (
        <section>
          <p className="flex items-center gap-2 text-sm text-[var(--brand-ink)]">
            <Sparkles className="w-4 h-4" /> Trust Desk · payments
          </p>
          <h2 className="font-serif text-3xl mt-1">Every rupee accounted for</h2>
          <p className="text-sm text-zinc-500 mt-1">Last 14 days. AI reads JazzCash, Easypaisa and bank screenshots and matches them to the visit total; you check anything it flags.</p>
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { k: "Expected", v: pkr(data.expected) },
              { k: "Recorded", v: pkr(data.collected) },
              { k: "Difference", v: pkr(gap), warn: gap !== 0 },
            ].map((c) => (
              <div key={c.k} className={cn("rounded-3xl bg-white border p-4 sm:p-5 min-w-0", c.warn ? "border-amber-300" : "border-black/[0.06]")}>
                <p className="text-xs text-zinc-500">{c.k}</p>
                <p className="font-serif text-2xl sm:text-3xl mt-1 truncate">{c.v}</p>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm mt-5">
            <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} className="w-4 h-4 accent-black" /> Only show what needs checking
          </label>
          {!rows.length ? (
            <Empty className="mt-4" title={only ? "Nothing to check" : "No completed visits yet"} body={only ? "All recent payments are matched or recorded as cash." : undefined} />
          ) : (
            <div className="mt-4 space-y-2">
              {rows.map((r) => (
                <CashLine key={r.id} row={r} onChange={changed} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "complaints" && (
        <section>
          <p className="flex items-center gap-2 text-sm text-[var(--brand-ink)]">
            <Sparkles className="w-4 h-4" /> Trust Desk · complaints
          </p>
          <h2 className="font-serif text-3xl mt-1">Complaints</h2>
          <p className="text-sm text-zinc-500 mt-1">AI drafts a fair, policy-based resolution in the customer&apos;s language, including from voice notes. Nothing reaches the customer until you send it.</p>
          {!data.complaints.length ? (
            <Empty className="mt-4" title="No complaints" body="Customers report problems at /complaint with their booking ID." />
          ) : (
            <div className="grid lg:grid-cols-2 gap-3 mt-4">
              {data.complaints.map((c) => (
                <ComplaintCard key={c.id} c={c} ai={data.ai} onChange={changed} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "quality" && <QualityView quality={insights.quality} />}
      {tab === "leakage" && <LeakageView flags={insights.leakage} onChange={changed} />}
      {tab === "activity" && <ActivityView log={insights.audit} />}
    </div>
  )
}

function CashLine({ row: r, onChange }: { row: CashRow; onChange: () => void }) {
  const [shot, setShot] = useState<string | null>(null)
  const [busy, setBusy] = useState("")
  const st = r.record?.checked
    ? { label: "Checked", cls: "bg-emerald-100 text-emerald-800" }
    : r.record && r.needsCheck && r.record.amount !== r.total && ["cash", "matched"].includes(r.record.status)
      ? { label: "Amount differs", cls: "bg-red-100 text-red-700" }
      : PAY[r.record?.status ?? "missing"]
  const act = async (key: string, body: unknown) => {
    setBusy(key)
    try {
      await api("/api/ops/trust", body)
      onChange()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  return (
    <div className="rounded-3xl bg-white border border-black/[0.06] p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="min-w-[160px] flex-1">
        <p className="font-medium">
          {r.customer} <span className="text-zinc-400 font-mono text-xs">{r.id}</span>
        </p>
        <p className="text-xs text-zinc-500">
          {r.date} · {r.pro} · booked as {r.booked}
        </p>
      </div>
      <div className="text-sm tabular-nums">
        <p>
          Total <b>{pkr(r.total)}</b>
        </p>
        {r.record && (
          <p className="text-zinc-500">
            Recorded {pkr(r.record.amount)} {r.record.method}
          </p>
        )}
      </div>
      {r.record?.ocr && (
        <div className="text-xs text-zinc-500">
          <p>Screenshot: {r.record.ocr.amount != null ? pkr(r.record.ocr.amount) : "no amount"}</p>
          {r.record.ocr.reference && <p>Ref {r.record.ocr.reference}</p>}
        </div>
      )}
      <Badge className={st.cls}>{st.label}</Badge>
      <div className="flex gap-2 ml-auto">
        {r.record?.screenshot && (
          <Btn size="sm" variant="light" onClick={async () => setShot(shot ? null : (await api<{ screenshot: string | null }>(`/api/ops/trust?shot=${r.id}`)).screenshot)}>
            <ImageIcon className="w-3.5 h-3.5" /> {shot ? "Hide" : "Screenshot"}
          </Btn>
        )}
        {r.record && r.needsCheck && (
          <Btn size="sm" busy={busy === "v"} onClick={() => act("v", { action: "verify", jobId: r.id, note: "Checked by ops" })}>
            Mark checked
          </Btn>
        )}
        {!r.record && (
          <Btn
            size="sm"
            busy={busy === "r"}
            onClick={() => {
              const amt = prompt(`Amount received for ${r.id} (PKR)`, String(r.total))
              if (amt) act("r", { action: "record", jobId: r.id, amount: Number(amt.replace(/\D/g, "")) || 0, method: r.booked === "online" ? "raast" : r.booked })
            }}
          >
            Record payment
          </Btn>
        )}
      </div>
      {shot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shot} alt={`Payment screenshot for ${r.id}`} className="basis-full max-h-[420px] w-auto object-contain rounded-2xl border border-black/10" />
      )}
    </div>
  )
}

function ComplaintCard({ c, ai, onChange }: { c: Trust["complaints"][number]; ai: boolean; onChange: () => void }) {
  const [msg, setMsg] = useState(c.draft?.message ?? "")
  const [media, setMedia] = useState<{ photo: string | null; audio: string | null } | null>(null)
  const [busy, setBusy] = useState("")
  const act = async (key: string, body: unknown) => {
    setBusy(key)
    try {
      await api("/api/ops/trust", body)
      onChange()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  const resolved = c.status === "resolved"
  return (
    <article className={cn("min-w-0 rounded-3xl bg-white border p-5", resolved ? "border-black/[0.06] opacity-70" : "border-[var(--brand)]/60")}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={resolved ? "bg-emerald-100 text-emerald-800" : c.status === "draft_ready" ? "bg-violet-100 text-violet-800" : "bg-amber-100 text-amber-800"}>{resolved ? "Resolved" : c.status === "draft_ready" ? "Draft ready" : "New"}</Badge>
        <span className="text-xs text-zinc-500">
          {c.bookingId} · {c.phone} · {ago(c.createdAt)}
        </span>
        {(c.photo || c.audio) && !media && (
          <button onClick={async () => setMedia(await api<{ photo: string | null; audio: string | null }>(`/api/ops/trust?media=${c.id}`))} className="text-xs underline text-zinc-600">
            {c.audio ? (c.photo ? "Play voice note + photo" : "Play voice note") : "View photo"}
          </button>
        )}
      </div>
      <p dir="auto" className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap">
        “{c.text}”
      </p>
      {media && (
        <div className="mt-3 space-y-2">
          {media.audio && <audio src={media.audio} controls className="w-full h-10" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {media.photo && <img src={media.photo} alt="Customer's photo" className="max-h-72 rounded-2xl border border-black/10" />}
        </div>
      )}
      {c.draft && !resolved && (
        <div className="mt-4 rounded-2xl bg-[oklch(0.975_0.008_80)] p-4 space-y-3">
          <p className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-[var(--brand-ink)]" />
            <b>{RES[c.draft.resolution] ?? c.draft.resolution}</b>
            {c.draft.refundPKR ? <span>· refund {pkr(c.draft.refundPKR)}</span> : null}
          </p>
          <p className="text-xs text-zinc-600 leading-relaxed">{c.draft.reasoning}</p>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} dir="auto" className="w-full rounded-2xl border border-black/10 bg-white p-3 text-sm outline-none focus:border-black" />
        </div>
      )}
      {resolved && c.resolution && <p className="mt-3 text-sm text-emerald-800">Resolution: {c.resolution}</p>}
      {!resolved && (
        <div className="flex flex-wrap gap-2 mt-4">
          {msg && (
            <a href={waTo(c.phone, msg)} target="_blank" rel="noreferrer" className="h-9 px-3.5 rounded-full bg-[#25D366] text-foreground inline-flex items-center gap-1.5 text-[13px] font-medium">
              <MessageCircle className="w-3.5 h-3.5" /> Send on WhatsApp
            </a>
          )}
          <Btn
            size="sm"
            busy={busy === "res"}
            onClick={() => {
              const def = c.draft ? `${RES[c.draft.resolution] ?? c.draft.resolution}${c.draft.refundPKR ? ` (${pkr(c.draft.refundPKR)})` : ""}` : ""
              const r = prompt("What was agreed with the customer?", def)
              if (r) act("res", { action: "resolve", id: c.id, resolution: r })
            }}
          >
            Mark resolved
          </Btn>
          {ai && (
            <Btn size="sm" variant="ghost" busy={busy === "d"} onClick={() => act("d", { action: "draft", id: c.id })}>
              {c.draft ? "Redraft" : "Draft with AI"}
            </Btn>
          )}
        </div>
      )}
    </article>
  )
}
