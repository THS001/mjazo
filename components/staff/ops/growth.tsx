"use client"

import { useEffect, useState } from "react"
import { Check, Copy, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, Badge, Btn, Empty, pkr, waTo } from "../kit"
import { inputCls } from "./context"

// Mission control → Plus & gifts (Finance and Owners). Money comes in here, so every action posts
// to the ledger and the audit log:
// - Plus: requests waiting for their fee (activate once paid, or cancel), adding a member by phone,
//   and the members;
// - gift cards: issue a paid-for card (then send its code to the buyer), cancel an unused one;
// - referrals: the credit paid to customers whose friends' first visits are done.

type Plus = { id: string; customerId: string; name: string; phone: string | null; status: "requested" | "active" | "cancelled"; price: number; discountPct: number; endsAt: string | null; requestedAt: string; paidVia: string | null }
type Gift = { code: string; amount: number; status: "active" | "redeemed" | "cancelled"; buyerName: string | null; buyerPhone: string | null; recipientName: string | null; recipientPhone: string | null; message: string | null; paidVia: string | null; createdBy: string; createdAt: string; redeemedAt: string | null }
type Reward = { friend: string; friend_phone: string | null; referrer: string; referrer_phone: string | null; code: string | null; booking_id: string; amount: number; at: string }
type Data = { plus: Plus[]; gifts: Gift[]; rewards: Reward[]; terms: { price: number; discountPct: number; friendOff: number; youGet: number } }

const METHODS = [
  ["jazzcash", "JazzCash"],
  ["easypaisa", "Easypaisa"],
  ["bank", "Bank transfer"],
  ["raast", "Raast"],
  ["cash", "Cash"],
] as const
type Method = (typeof METHODS)[number][0]
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" })

export function GrowthTab() {
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [issued, setIssued] = useState<Gift | null>(null)
  useEffect(() => {
    api<Data>("/api/ops/growth").then(setData, (e) => setError((e as Error).message))
  }, [])
  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key)
    setError("")
    try {
      const r = await api<Data & { gift?: Gift }>("/api/ops/growth", body)
      setData(r)
      if (body.action === "issue_gift" && r.gift) setIssued(r.gift)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy("")
    }
  }
  if (!data) return error ? <p className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p> : <div className="h-40 rounded-3xl bg-black/[0.04] animate-pulse" />
  const waiting = data.plus.filter((p) => p.status === "requested")
  const members = data.plus.filter((p) => p.status === "active")
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-3xl">Plus & gifts</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Mjazo Plus is {pkr(data.terms.price)} a year for {data.terms.discountPct}% off every booking. A friend&apos;s first booking with a referral code gets {pkr(data.terms.friendOff)} off; the customer who referred them gets {pkr(data.terms.youGet)} credit when that visit is done. (Change these in /admin → Settings → Plus & referrals.)
        </p>
      </div>
      {error && <p className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>}

      <section className="space-y-3">
        <h3 className="font-serif text-2xl">Plus: waiting for the fee</h3>
        {!waiting.length ? (
          <Empty title="No Plus requests waiting" body="Customers ask to join from their account; a request also comes in by WhatsApp or the Plus page (Requests)." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {waiting.map((p) => (
              <PlusRequest key={p.id} p={p} busy={busy === p.id} onActivate={(m, ref) => run(p.id, { action: "activate_plus", membershipId: p.id, paidVia: m, reference: ref })} onCancel={() => run(p.id, { action: "cancel_plus", membershipId: p.id, note: "Didn't go ahead" })} />
            ))}
          </div>
        )}
        <AddMember busy={busy === "add"} onAdd={(b) => run("add", { action: "activate_plus", ...b })} />
        <h3 className="font-serif text-2xl pt-2">Members</h3>
        {!members.length ? (
          <p className="text-sm text-zinc-500">No members yet.</p>
        ) : (
          <ol className="rounded-3xl bg-white border border-black/[0.06] divide-y divide-black/[0.06]">
            {members.map((p) => (
              <li key={p.id} className="p-3 sm:p-4 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium">{p.name || "—"}</span>
                <span className="text-zinc-500">{p.phone}</span>
                <span className="flex-1" />
                <Badge className={p.endsAt && Date.parse(p.endsAt) > Date.now() ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"}>{p.endsAt && Date.parse(p.endsAt) > Date.now() ? `until ${day(p.endsAt)}` : "ended"}</Badge>
                <span className="text-xs text-zinc-500">{p.discountPct}% · {p.paidVia}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-2xl">Gift cards</h3>
        <IssueGift busy={busy === "gift"} onIssue={(b) => run("gift", { action: "issue_gift", ...b })} />
        {issued && <Issued g={issued} onClose={() => setIssued(null)} />}
        {!data.gifts.length ? (
          <p className="text-sm text-zinc-500">No gift cards yet.</p>
        ) : (
          <ol className="rounded-3xl bg-white border border-black/[0.06] divide-y divide-black/[0.06]">
            {data.gifts.map((g) => (
              <li key={g.code} className="p-3 sm:p-4 text-sm grid sm:grid-cols-[11rem_7rem_1fr_auto] gap-x-4 gap-y-1 items-center">
                <span className="font-mono">{g.code}</span>
                <span className="font-medium">{pkr(g.amount)}</span>
                <span className="text-xs text-zinc-500 min-w-0">
                  {[g.buyerName && `from ${g.buyerName}`, g.recipientName && `to ${g.recipientName}`, day(g.createdAt), g.paidVia].filter(Boolean).join(" · ")}
                  {g.redeemedAt && ` · used ${day(g.redeemedAt)}`}
                </span>
                <span className="flex items-center gap-2">
                  <Badge className={g.status === "active" ? "bg-sky-100 text-sky-800" : g.status === "redeemed" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"}>{g.status === "active" ? "not used yet" : g.status}</Badge>
                  {g.status === "active" && (
                    <Btn
                      size="sm"
                      variant="ghost"
                      busy={busy === g.code}
                      onClick={() => {
                        const reason = window.prompt(`Cancel ${g.code}? Its ${pkr(g.amount)} goes back to the buyer (pay it back outside the app). Why?`)
                        if (reason !== null) void run(g.code, { action: "cancel_gift", code: g.code, reason })
                      }}
                    >
                      Cancel
                    </Btn>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-2xl">Referral rewards</h3>
        {!data.rewards.length ? (
          <p className="text-sm text-zinc-500">None yet. They&apos;re paid by themselves when a referred friend&apos;s first visit is done.</p>
        ) : (
          <ol className="rounded-3xl bg-white border border-black/[0.06] divide-y divide-black/[0.06]">
            {data.rewards.map((r) => (
              <li key={`${r.booking_id}`} className="p-3 sm:p-4 text-sm flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <b>{r.referrer}</b> ({r.code}) got {pkr(r.amount)}
                </span>
                <span className="text-zinc-500">
                  for {r.friend}&apos;s first visit · <span className="font-mono">{r.booking_id}</span> · {day(r.at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function MethodPick({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  return (
    <select className={cn(inputCls, "w-auto")} value={value} onChange={(e) => onChange(e.target.value as Method)} aria-label="Paid by">
      {METHODS.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  )
}

function PlusRequest({ p, busy, onActivate, onCancel }: { p: Plus; busy: boolean; onActivate: (m: Method, ref: string) => void; onCancel: () => void }) {
  const [m, setM] = useState<Method>("jazzcash")
  const [ref, setRef] = useState("")
  return (
    <article className="rounded-3xl bg-white border border-black/[0.06] p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-medium">{p.name || "—"}</p>
        <span className="text-sm text-zinc-500">{p.phone}</span>
        {p.phone && (
          <a className="text-sm underline" href={waTo(p.phone, `Assalam o Alaikum ${p.name}! Thank you for joining Mjazo Plus. The fee is ${pkr(p.price)} a year.`)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Asked {day(p.requestedAt)} · {pkr(p.price)} for {p.discountPct}% off
      </p>
      <div className="flex flex-wrap gap-2">
        <MethodPick value={m} onChange={setM} />
        <input className={cn(inputCls, "w-auto flex-1 min-w-[8rem]")} placeholder="Reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Btn size="sm" busy={busy} onClick={() => onActivate(m, ref)}>
          <Check className="w-4 h-4" /> Fee received: activate
        </Btn>
        <Btn size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel request
        </Btn>
      </div>
    </article>
  )
}

function AddMember({ busy, onAdd }: { busy: boolean; onAdd: (b: { name: string; phone: string; paidVia: Method; reference: string }) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: "", phone: "", paidVia: "jazzcash" as Method, reference: "" })
  if (!open)
    return (
      <Btn size="sm" variant="light" onClick={() => setOpen(true)}>
        Add a member by phone (fee already received)
      </Btn>
    )
  return (
    <div className="rounded-3xl bg-white border border-black/[0.06] p-5 flex flex-wrap gap-2 items-center">
      <input className={cn(inputCls, "w-auto flex-1 min-w-[10rem]")} placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className={cn(inputCls, "w-auto flex-1 min-w-[10rem]")} placeholder="03xx xxxxxxx" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <MethodPick value={f.paidVia} onChange={(paidVia) => setF({ ...f, paidVia })} />
      <input className={cn(inputCls, "w-auto flex-1 min-w-[8rem]")} placeholder="Reference (optional)" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
      <Btn size="sm" busy={busy} onClick={async () => (await onAdd(f)) && setOpen(false)}>
        Activate Plus
      </Btn>
      <Btn size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Close
      </Btn>
    </div>
  )
}

function IssueGift({ busy, onIssue }: { busy: boolean; onIssue: (b: Record<string, unknown>) => Promise<boolean> }) {
  const blank = { amount: "", buyerName: "", buyerPhone: "", recipientName: "", recipientPhone: "", message: "", paidVia: "jazzcash" as Method, reference: "" }
  const [f, setF] = useState(blank)
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="rounded-3xl bg-white border border-black/[0.06] p-5 space-y-3">
      <p className="font-medium">Issue a gift card (after the buyer has paid)</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <input className={inputCls} placeholder="Amount (PKR)" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "") })} />
        <MethodPick value={f.paidVia} onChange={(paidVia) => setF({ ...f, paidVia })} />
        <input className={inputCls} placeholder="Payment reference (optional)" value={f.reference} onChange={set("reference")} />
        <span />
        <input className={inputCls} placeholder="Buyer's name" value={f.buyerName} onChange={set("buyerName")} />
        <input className={inputCls} placeholder="Buyer's number" value={f.buyerPhone} onChange={set("buyerPhone")} />
        <input className={inputCls} placeholder="For (name)" value={f.recipientName} onChange={set("recipientName")} />
        <input className={inputCls} placeholder="Their number" value={f.recipientPhone} onChange={set("recipientPhone")} />
      </div>
      <input className={inputCls} placeholder="Message on the card (optional)" value={f.message} onChange={set("message")} />
      <Btn size="sm" busy={busy} disabled={!f.amount} onClick={async () => (await onIssue({ ...f, amount: Number(f.amount) })) && setF(blank)}>
        Issue the gift card
      </Btn>
    </div>
  )
}

function Issued({ g, onClose }: { g: Gift; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = `${g.recipientName ? `${g.recipientName}, a` : "A"} Mjazo gift card for you${g.buyerName ? ` from ${g.buyerName}` : ""}: ${pkr(g.amount)}.${g.message ? ` "${g.message}"` : ""} Code: ${g.code}. Add it in your Mjazo account (website or app) and it becomes credit for any booking.`
  return (
    <div className="rounded-3xl bg-emerald-50 text-emerald-950 p-5 space-y-3">
      <p className="text-sm">Gift card issued:</p>
      <p className="font-mono text-2xl">{g.code}</p>
      <p className="text-sm">{text}</p>
      <div className="flex flex-wrap gap-2">
        <Btn
          size="sm"
          variant="light"
          onClick={() => {
            navigator.clipboard?.writeText(text)
            setCopied(true)
          }}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy the message
        </Btn>
        {[g.recipientPhone, g.buyerPhone].filter((p): p is string => Boolean(p)).map((p, i) => (
          <a key={p} href={waTo(p, text)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 h-9 px-3.5 rounded-full bg-[#25D366] text-sm">
            <MessageCircle className="w-4 h-4" /> WhatsApp the {i === 0 && g.recipientPhone ? "recipient" : "buyer"}
          </a>
        ))}
        <Btn size="sm" variant="ghost" onClick={onClose}>
          Done
        </Btn>
      </div>
    </div>
  )
}
