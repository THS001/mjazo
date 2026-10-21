"use client"

import { useState, type ReactNode } from "react"
import { Check, Copy, Crown, Gift, Loader2, MessageCircle } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { ACCOUNT_EVENT, customerApi, CustomerApiError, useAccount, type Me } from "@/lib/client/customer"
import { localePath } from "@/lib/i18n"
import { track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { inputCls } from "@/components/site/forms"
import { fill, useLocale, useSite, useT } from "@/components/cms/provider"

// Mjazo Plus, referral codes and gift cards in the client account (and on the Plus page). They all
// go through /api/v1/customer, like the phone app.

const day = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale === "ur" ? "ur-PK" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" })
const refresh = () => window.dispatchEvent(new Event(ACCOUNT_EVENT))

/** One line for the account's Plus tile: their membership, a request waiting, or nothing. */
export function plusLine(me: Me, m: ReturnType<typeof useT>["myAccount"], locale: string) {
  if (me.plus?.status === "active" && me.plus.endsAt) return fill(m.plusActive, { date: day(me.plus.endsAt, locale) })
  if (me.plus?.status === "requested") return fill(m.plusWaiting, { price: formatPKR(me.plus.price) })
  return null
}

/**
 * The Plus page's join box: a signed-in customer joins in one tap (or sees their membership);
 * anyone else gets the page's request form (`children`).
 */
export function PlusJoin({ children }: { children: ReactNode }) {
  const acc = useAccount()
  const m = useT().myAccount
  const { plus } = useSite()
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  if (acc.state !== "in") return <>{children}</>
  const me = acc.me
  const join = async () => {
    setBusy(true)
    setError("")
    try {
      await customerApi("/api/v1/customer/plus", {})
      track("plus_join")
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-3xl bg-white text-foreground p-6 sm:p-8 space-y-4">
      <Crown className="w-7 h-7 text-brand-ink" />
      {me.plus?.status === "active" && me.plus.endsAt ? (
        <p className="font-serif text-2xl">{fill(m.plusYours, { pct: me.plus.discountPct, date: day(me.plus.endsAt, locale) })}</p>
      ) : me.plus?.status === "requested" ? (
        <p className="font-serif text-2xl">{fill(m.plusWaiting, { price: formatPKR(me.plus.price) })}</p>
      ) : (
        <>
          <p className="font-serif text-3xl">{m.plusJoin}</p>
          <p className="text-zinc-600">{fill(m.plusJoinSub, { price: formatPKR(plus.price), pct: Math.round(plus.discount * 100) })}</p>
          <button onClick={join} disabled={busy} className="h-12 px-6 rounded-full bg-foreground text-background text-sm inline-flex items-center gap-2 disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {m.plusJoin}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  )
}

/** Their referral code, what it gives and has earned, and sharing it. */
export function ReferCard({ me, className }: { me: Me; className?: string }) {
  const m = useT().myAccount
  const locale = useLocale()
  const [copied, setCopied] = useState(false)
  const r = me.referral
  if (!r) return null
  const link = `${typeof window === "undefined" ? "" : window.location.origin}${localePath("/", locale)}?ref=${r.code}`
  const message = fill(m.referShare, { code: r.code, amount: formatPKR(r.friendOff), link })
  return (
    <div className={cn("rounded-3xl bg-white border border-zinc-200 p-6 space-y-3", className)}>
      <p className="text-sm text-zinc-500">{m.referTitle}</p>
      <p className="font-mono text-3xl tracking-wide">{r.code}</p>
      <p className="text-sm text-zinc-600">{fill(m.referSub, { friendOff: formatPKR(r.friendOff), youGet: formatPKR(r.youGet) })}</p>
      {r.friends > 0 && <p className="text-sm font-medium">{fill(m.referEarned, { count: r.friends, amount: formatPKR(r.earned) })}</p>}
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" onClick={() => track("referral_share", { code: r.code, channel: "whatsapp" })} className="h-11 px-5 rounded-full bg-[#25D366] text-foreground text-sm inline-flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> {m.shareWhatsapp}
        </a>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(link)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="h-11 px-5 rounded-full border border-zinc-300 text-sm inline-flex items-center gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? m.copied : m.copy}
        </button>
      </div>
    </div>
  )
}

/** A gift card's code, turned into their credit. */
export function GiftRedeem({ className }: { className?: string }) {
  const m = useT().myAccount
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await customerApi<{ added: number }>("/api/v1/customer/gift-card", { code })
      setMsg({ ok: true, text: fill(m.giftAdded, { amount: formatPKR(r.added) }) })
      setCode("")
      track("gift_card_redeemed", { amount: r.added })
      refresh()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof CustomerApiError && err.status === 429 ? m.tooMany : (err as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={add} className={cn("rounded-3xl bg-white border border-zinc-200 p-6 space-y-3", className)}>
      <p className="font-medium flex items-center gap-2">
        <Gift className="w-5 h-5" /> {m.giftTitle}
      </p>
      <p className="text-sm text-zinc-500">{m.giftSub}</p>
      <div className="flex gap-2">
        <input className={cn(inputCls, "uppercase font-mono")} value={code} onChange={(e) => setCode(e.target.value)} placeholder="MJG-XXXX-XXXX" aria-label={m.giftCode} maxLength={20} />
        <button type="submit" disabled={busy || !code.trim()} className="h-12 px-5 rounded-full bg-foreground text-background text-sm shrink-0 inline-flex items-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {m.giftAdd}
        </button>
      </div>
      {msg && <p className={cn("text-sm", msg.ok ? "text-emerald-700" : "text-destructive")}>{msg.text}</p>}
    </form>
  )
}
