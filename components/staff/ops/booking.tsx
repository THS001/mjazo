"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, MapPin, MessageCircle, Phone, X } from "lucide-react"
import { useCatalog } from "@/components/cms/provider"
import { eligible, unavailableReason } from "@/lib/ops/logic"
import type { Job, Pro } from "@/lib/ops/types"
import { WINDOW_LABELS } from "@/lib/time"
import { cn } from "@/lib/utils"
import { api, Badge, Btn, clock, pkr, STATUS, waTo } from "../kit"
import type { OpsOffer, OpsPro } from "./console"
import { OfferLine, ProPicker } from "./live"
import { inputCls, useOps } from "./context"

// The booking page: everything about one booking (timeline, items, payments and the ledger,
// refunds and credits) and what can be done with it. Money actions are asked for here and
// approved by a second person with the money permission.

type MoneyRequest = { id: string; kind: "refund" | "credit"; amount: number; reason: string; status: "pending" | "approved" | "rejected"; requestedBy: string; requestedAt: string; decidedBy: string | null; decidedAt: string | null; decisionNote: string | null; reference: string | null }
type Entry = { id: number; at: string; kind: string; memo: string | null; actor: string | null; postings: { account: string; amount: number }[] }
type Detail = {
  job: Job
  money: { subtotal: number; discount: number; promo: string | null; paid: number; refunded: number } | null
  ledger: Entry[]
  requests: MoneyRequest[]
  customer: { id: string; owes: number; credit: number; visits: number } | null
  offer: OpsOffer | null
  pros?: OpsPro[]
}

const KIND: Record<string, string> = { visit_completed: "Visit completed", payment: "Payment", refund: "Refund", credit_issued: "Credit given", credit_applied: "Credit used", payout: "Payout", cash_handed_in: "Cash handed in", pack_used: "Paid from their pack" }
const ACCOUNT = (a: string) => {
  const [scope, , what] = a.split(":")
  if (scope === "cust") return what === "ar" ? "Customer owes" : "Customer credit"
  if (scope === "pro") return what === "cash" ? "Cash with the pro" : "Owed to the pro"
  return { "mjazo:bank": "Mjazo bank", "mjazo:commission": "Commission", "mjazo:discounts": "Discounts", "mjazo:goodwill": "Goodwill", "mjazo:refunds": "Refunds", "mjazo:packs": "Packs not yet used" }[a] ?? a
}
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })

export function BookingPage({ id, onClose, reload }: { id: string; onClose: () => void; reload: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [pros, setPros] = useState<OpsPro[]>([])
  const [error, setError] = useState("")
  const load = async () => {
    try {
      const r = await api<Detail>(`/api/ops/booking?id=${encodeURIComponent(id)}`)
      setD(r)
      if (r.pros) setPros(r.pros)
      setError("")
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    void load()
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  /** Runs an action on the booking; the answer is the refreshed booking. */
  const act = async (body: Record<string, unknown>) => {
    const r = await api<Detail & { full?: boolean }>("/api/ops/booking", { id, ...body })
    if (r.full) return r
    setD((old) => ({ ...r, pros: old?.pros }))
    reload()
    return r
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <motion.aside
        initial={{ x: 40 }}
        animate={{ x: 0 }}
        exit={{ x: 40 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Booking ${id}`}
        className="h-full w-full max-w-3xl bg-[oklch(0.975_0.008_80)] overflow-y-auto overscroll-contain"
        data-lenis-prevent
      >
        <header className="sticky top-0 z-10 bg-[#0b0b0b] text-white px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={onClose} aria-label="Back" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 sm:hidden">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <p className="font-mono text-sm text-white/70">{id}</p>
          {d && <Badge className={STATUS[d.job.status].cls}>{STATUS[d.job.status].label}</Badge>}
          <span className="flex-1" />
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-white/10 items-center justify-center hover:bg-white/15 hidden sm:flex">
            <X className="w-4 h-4" />
          </button>
        </header>
        {!d ? (
          <div className="p-6">{error ? <p className="text-sm text-red-600">{error}</p> : <div className="h-40 rounded-3xl bg-black/[0.04] animate-pulse" />}</div>
        ) : (
          <Body
            d={d}
            pros={pros}
            act={act}
            refresh={async () => {
              await load()
              reload()
            }}
          />
        )}
      </motion.aside>
    </motion.div>
  )
}

type Act = (body: Record<string, unknown>) => Promise<Detail & { full?: boolean }>

function Body({ d, pros, act, refresh }: { d: Detail; pros: OpsPro[]; act: Act; refresh: () => Promise<void> }) {
  const cat = useCatalog()
  const { can } = useOps()
  const j = d.job
  const pro = pros.find((p) => p.id === j.proId)
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key)
    setMsg(null)
    try {
      await fn()
      if (ok) setMsg({ tone: "ok", text: ok })
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message })
    } finally {
      setBusy("")
    }
  }
  const event = (type: string, note?: string) => run(type, () => api("/api/ops/jobs", { action: "event", jobId: j.id, type, note }).then(refresh))
  const lines = j.items.map((i) => ({ ...i, line: i.unitPrice * i.qty }))
  const subtotal = d.money?.subtotal ?? lines.reduce((s, l) => s + l.line, 0)
  // What the discount is: the pack's price for one visit, and a code (or PLUS).
  const discountWhy = [j.pack && "pack price", d.money?.promo].filter(Boolean).join(" + ")
  const notStarted = ["new", "assigned", "en_route"].includes(j.status)

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {msg && <p className={cn("rounded-2xl px-4 py-3 text-sm", msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>{msg.text}</p>}

      <Card>
        <p className="text-xl font-semibold">{j.customer.name}</p>
        <div className="mt-2 space-y-1.5 text-sm text-zinc-600">
          <p className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-zinc-400" />
            <span>
              {j.address}
              {j.landmark && `, near ${j.landmark}`} · {j.subArea ? `${j.subArea}, ` : ""}
              {cat.getArea(j.area)?.name ?? j.area}
            </span>
          </p>
          <p className="flex items-center gap-3 flex-wrap">
            <a className="inline-flex items-center gap-1.5 underline" href={`tel:${j.customer.phone}`}>
              <Phone className="w-4 h-4 text-zinc-400" /> {j.customer.phone}
            </a>
            <a className="inline-flex items-center gap-1.5 underline" target="_blank" rel="noreferrer" href={waTo(j.customer.phone, `Assalam o Alaikum ${j.customer.name.split(" ")[0]}, this is Mjazo about your booking ${j.id}.`)}>
              <MessageCircle className="w-4 h-4 text-zinc-400" /> WhatsApp
            </a>
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Fact k="Day" v={day(j.date)} />
          <Fact k="Window" v={j.eta ? `${j.window} · ETA ${j.eta}` : j.window} />
          <Fact k="Pro" v={pro?.name ?? (j.proId ? j.proId : "Not assigned")} />
          {j.preferredProId && <Fact k="Customer asked for" v={pros.find((p) => p.id === j.preferredProId)?.name ?? j.preferredProId} />}
          <Fact k="Booked via" v={`${j.channel ?? "web"} · ${when(j.createdAt)}`} />
        </dl>
        {j.notes && <p className="mt-3 text-sm text-zinc-600">Customer note: {j.notes}</p>}
        {j.brief && <p className="mt-2 text-sm text-zinc-600">Brief: {j.brief.title}</p>}
        {d.customer && (
          <p className="mt-3 text-xs text-zinc-500">
            Customer {d.customer.id} · {d.customer.visits} completed visit{d.customer.visits === 1 ? "" : "s"}
            {d.customer.credit > 0 && ` · credit ${pkr(d.customer.credit)}`}
            {d.customer.owes > 0 && ` · owes ${pkr(d.customer.owes)}`}
          </p>
        )}
        {can("ops.dispatch") && (
          <div className="mt-4 flex flex-wrap gap-2">
            {notStarted && (
              <AssignSelect
                job={j}
                pros={pros}
                busy={busy === "assign" || busy === "offer"}
                onPick={(action, proId) => run(action, () => api("/api/ops/jobs", { action, jobId: j.id, proId }).then(refresh), action === "offer" ? "Offered. She answers in the pro app." : undefined)}
              />
            )}
            {j.status === "checked_in" && (
              <Btn size="sm" variant="light" busy={busy === "checked_out"} onClick={() => event("checked_out", "Checked out by ops")}>
                Check out
              </Btn>
            )}
            {j.status === "checked_out" && (
              <Btn size="sm" variant="light" busy={busy === "completed"} onClick={() => event("completed", "Completed by ops")}>
                Mark done
              </Btn>
            )}
            {(j.status === "assigned" || j.status === "en_route") && (
              <Btn size="sm" variant="ghost" busy={busy === "no_show"} onClick={() => confirm("Mark the customer as a no-show?") && event("no_show", "Customer not home")}>
                No-show
              </Btn>
            )}
          </div>
        )}
        {d.offer && <OfferLine offer={d.offer} pros={pros} busy={busy === "withdraw"} canWithdraw={can("ops.dispatch")} onWithdraw={() => run("withdraw", () => api("/api/ops/jobs", { action: "withdraw_offer", jobId: j.id }).then(refresh), "Offer withdrawn")} />}
      </Card>

      <Card title="Services">
        <ul className="divide-y divide-black/[0.06] text-sm">
          {lines.map((l, i) => (
            <li key={i} className="py-2.5 flex gap-3">
              <span className="flex-1 min-w-0">
                {l.name}
                {l.qty > 1 && ` ×${l.qty}`}
                {(l.options.length > 0 || l.addOns.length > 0) && <span className="block text-xs text-zinc-500">{[...l.options, ...l.addOns.map((a) => `+ ${a}`)].join(" · ")}</span>}
              </span>
              <span className="tabular-nums">{pkr(l.line)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-3 border-t border-black/[0.06] text-sm space-y-1">
          <Row k="Subtotal" v={pkr(subtotal)} />
          {!!d.money?.discount && <Row k={`Discount${discountWhy ? ` (${discountWhy})` : ""}`} v={`− ${pkr(d.money.discount)}`} />}
          <Row k="Total" v={pkr(j.total)} strong />
          {!!j.credit && <Row k="From their Mjazo credit" v={`− ${pkr(j.credit)}`} />}
          {j.pack && <Row k={`From their pack (${j.pack.name})`} v={`− ${pkr(j.pack.paid)}`} />}
          {(!!j.credit || j.pack) && <Row k="The pro collects" v={pkr(j.total - (j.credit ?? 0) - (j.pack?.paid ?? 0))} />}
          <Row k="Pays by" v={j.payment} />
        </div>
      </Card>

      <Card title="Payment and books">
        {j.paymentRecord ? (
          <p className="text-sm">
            The pro recorded {pkr(j.paymentRecord.amount)} by {j.paymentRecord.method} · <b>{j.paymentRecord.status}</b>
            {j.paymentRecord.checked && " · checked"}
            {j.paymentRecord.note && <span className="text-zinc-500"> · {j.paymentRecord.note}</span>}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">No payment recorded yet.</p>
        )}
        {d.money && (
          <p className="text-sm mt-1 text-zinc-600">
            In the books: paid {pkr(d.money.paid)}
            {d.money.refunded > 0 && `, refunded ${pkr(d.money.refunded)}`}
          </p>
        )}
        {d.ledger.length > 0 && (
          <ol className="mt-4 space-y-2">
            {d.ledger.map((e) => (
              <li key={e.id} className="rounded-2xl bg-black/[0.03] p-3 text-xs">
                <p className="font-medium text-sm">
                  {KIND[e.kind] ?? e.kind} <span className="font-normal text-zinc-500">· {when(e.at)}{e.actor ? ` · ${e.actor}` : ""}{e.memo ? ` · ${e.memo}` : ""}</span>
                </p>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-zinc-600">
                  {e.postings.map((p, i) => (
                    <span key={i} className="flex justify-between gap-2">
                      <span className="truncate">{ACCOUNT(p.account)}</span>
                      <span className={cn("tabular-nums", p.amount < 0 && "text-zinc-400")}>{p.amount > 0 ? `+${p.amount.toLocaleString("en-PK")}` : p.amount.toLocaleString("en-PK")}</span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <MoneyRequests d={d} act={act} />

      {can("ops.bookings", "ops.dispatch") && (
        <Card title="Notes and changes">
          <NoteForm onSave={(note) => run("note", () => act({ action: "note", note }), "Note added")} busy={busy === "note"} />
          {can("ops.bookings") && notStarted && (
            <>
              <Reschedule job={j} act={act} onDone={(t) => setMsg({ tone: "ok", text: t })} />
              <CancelForm busy={busy === "cancel"} onCancel={(reason) => run("cancel", () => act({ action: "cancel", reason }), "Booking cancelled")} />
            </>
          )}
        </Card>
      )}

      <Card title="Timeline">
        <ol className="space-y-2 text-sm border-l border-black/10 pl-4">
          <li className="text-zinc-500">
            <span className="text-black font-medium">booked</span> · {when(j.createdAt)} · {j.channel ?? "web"}
          </li>
          {j.events.map((e, i) => (
            <li key={i} className="text-zinc-500">
              <span className="text-black font-medium">{e.type.replace("_", " ")}</span> · {when(e.at)} · {e.actor ?? e.by}
              {e.note && <span className="block text-zinc-600">{e.note}</span>}
              {e.lat && (
                <a className="underline text-xs" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}>
                  location at {clock(e.at)}
                </a>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function AssignSelect({ job, pros, busy, onPick }: { job: Job; pros: OpsPro[]; busy: boolean; onPick: (action: "assign" | "offer", proId: string | null) => void }) {
  const cat = useCatalog()
  const fits = pros
    .filter((p) => p.status === "active")
    .map((p) => ({ p, why: [p.id === job.preferredProId ? "asked for" : null, !eligible(p as Pro, job, cat) ? "skills don't match" : unavailableReason(p as Pro, job)].filter(Boolean).join(", ") }))
    .sort((a, b) => Number(b.p.id === job.preferredProId) - Number(a.p.id === job.preferredProId) || Number(Boolean(a.why)) - Number(Boolean(b.why)))
  return <ProPicker job={job} pro={pros.find((p) => p.id === job.proId)} fits={fits} disabled={busy} onPick={onPick} className="h-9 flex-none rounded-full border-black/15 bg-white max-w-[18rem]" />
}

function MoneyRequests({ d, act }: { d: Detail; act: Act }) {
  const { can, me } = useOps()
  const [kind, setKind] = useState<"refund" | "credit">("credit")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [refs, setRefs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  if (!d.money || (!can("ops.money.request", "ops.money") && !d.requests.length)) return null
  const left = Math.max(0, d.money.paid - d.money.refunded - d.requests.filter((r) => r.kind === "refund" && r.status === "pending").reduce((s, r) => s + r.amount, 0))
  const go = async (key: string, body: Record<string, unknown>, after?: () => void) => {
    setBusy(key)
    setError("")
    try {
      await act(body)
      after?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  return (
    <Card title="Refunds and credits">
      {d.requests.length > 0 && (
        <ul className="space-y-2 mb-4">
          {d.requests.map((r) => (
            <li key={r.id} className="rounded-2xl border border-black/[0.06] p-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={r.status === "pending" ? "bg-amber-100 text-amber-900" : r.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"}>{r.status}</Badge>
                <span className="font-semibold">
                  {r.kind === "refund" ? "Refund" : "Credit"} {pkr(r.amount)}
                </span>
                <span className="text-xs text-zinc-500 ml-auto">{r.id}</span>
              </div>
              <p className="mt-1 text-zinc-600">{r.reason}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Asked by {r.requestedBy} · {when(r.requestedAt)}
                {r.decidedBy && ` · ${r.status} by ${r.decidedBy}${r.reference ? ` (ref ${r.reference})` : ""}`}
                {r.decisionNote && ` · ${r.decisionNote}`}
              </p>
              {r.status === "pending" && can("ops.money") && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.kind === "refund" && <input className={cn(inputCls, "h-9 max-w-[14rem]")} placeholder="Transfer reference" value={refs[r.id] ?? ""} onChange={(e) => setRefs({ ...refs, [r.id]: e.target.value })} />}
                  <Btn size="sm" busy={busy === `a${r.id}`} disabled={(r.kind === "refund" && !refs[r.id]?.trim()) || (r.requestedBy === me.email && me.role !== "owner")} onClick={() => go(`a${r.id}`, { action: "decide", requestId: r.id, approve: true, reference: refs[r.id] })}>
                    Approve
                  </Btn>
                  <Btn size="sm" variant="ghost" busy={busy === `r${r.id}`} onClick={() => go(`r${r.id}`, { action: "decide", requestId: r.id, approve: false, note: prompt("Why not? (optional)") ?? undefined })}>
                    Reject
                  </Btn>
                  {r.requestedBy === me.email && me.role !== "owner" && <span className="text-xs text-zinc-500">Someone else approves your own request.</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {can("ops.money.request") && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void go("ask", { action: "request", kind, amount: Number(amount), reason }, () => {
              setAmount("")
              setReason("")
            })
          }}
          className="grid sm:grid-cols-[auto_8rem_1fr_auto] gap-2 items-start"
        >
          <select value={kind} onChange={(e) => setKind(e.target.value as "refund" | "credit")} aria-label="Refund or credit" className={cn(inputCls, "sm:w-32")}>
            <option value="credit">Credit</option>
            <option value="refund" disabled={!left}>
              Refund
            </option>
          </select>
          <input className={inputCls} inputMode="numeric" placeholder="PKR" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} aria-label="Amount" />
          <input className={inputCls} placeholder="Why (the approver sees this)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
          <Btn busy={busy === "ask"} disabled={!amount || reason.trim().length < 3}>
            Ask for approval
          </Btn>
          <p className="text-xs text-zinc-500 sm:col-span-4">{left ? `Up to ${pkr(left)} of what was paid can be refunded.` : "Nothing paid for this booking can be refunded yet, so a credit for the next visit is the option."} A person with the money permission approves it before anything moves.</p>
        </form>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </Card>
  )
}

function NoteForm({ onSave, busy }: { onSave: (note: string) => Promise<unknown>; busy: boolean }) {
  const [note, setNote] = useState("")
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        await onSave(note.trim())
        setNote("")
      }}
      className="flex gap-2"
    >
      <input className={inputCls} placeholder="Add a note to the timeline" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      <Btn busy={busy} disabled={note.trim().length < 2}>
        Add
      </Btn>
    </form>
  )
}

function Reschedule({ job, act, onDone }: { job: Job; act: Act; onDone: (text: string) => void }) {
  const [date, setDate] = useState(job.date)
  const [win, setWin] = useState(job.window)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const go = async (force = false) => {
    setBusy(true)
    setError("")
    try {
      const r = await act({ action: "reschedule", date, window: win, reason: reason || undefined, force })
      if (r.full) {
        if (confirm("That window is full (no pro can fit it in). Book it there anyway?")) return go(true)
        setError("That window is full. Pick another one.")
      } else onDone(`Moved to ${date}, ${win}${job.proId ? ". The pro was taken off it: assign one again." : ""}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-4 pt-4 border-t border-black/[0.06]">
      <p className="text-sm font-medium mb-2">Reschedule</p>
      <div className="grid sm:grid-cols-[10rem_10rem_1fr_auto] gap-2">
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} aria-label="New day" />
        <select className={inputCls} value={win} onChange={(e) => setWin(e.target.value)} aria-label="New window">
          {WINDOW_LABELS.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
        <input className={inputCls} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
        <Btn variant="light" busy={busy} disabled={date === job.date && win === job.window} onClick={() => go()}>
          Move it
        </Btn>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}

function CancelForm({ onCancel, busy }: { onCancel: (reason: string) => Promise<unknown>; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  if (!open)
    return (
      <Btn size="sm" variant="ghost" className="text-red-600 mt-4" onClick={() => setOpen(true)}>
        Cancel this booking…
      </Btn>
    )
  return (
    <div className="mt-4 pt-4 border-t border-black/[0.06] flex gap-2">
      <input className={inputCls} placeholder="Why is it cancelled?" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Cancellation reason" />
      <Btn variant="danger" busy={busy} disabled={reason.trim().length < 2} onClick={() => onCancel(reason.trim())}>
        Cancel booking
      </Btn>
    </div>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white border border-black/[0.06] p-5">
      {title && <h3 className="text-sm font-semibold text-zinc-500 mb-3">{title}</h3>}
      {children}
    </section>
  )
}

const Fact = ({ k, v }: { k: string; v: string }) => (
  <div className="min-w-0">
    <dt className="text-xs text-zinc-500">{k}</dt>
    <dd className="mt-0.5 font-medium truncate">{v}</dd>
  </div>
)

const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <p className={cn("flex justify-between gap-3", strong && "font-semibold text-base")}>
    <span className={strong ? "" : "text-zinc-500"}>{k}</span>
    <span className="tabular-nums">{v}</span>
  </p>
)
