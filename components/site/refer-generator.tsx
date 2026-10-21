"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Loader2, MessageCircle } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { useAccount } from "@/lib/client/customer"
import { track } from "@/lib/site"
import { Field, inputCls } from "./forms"
import { PK_PHONE, normalisePhone } from "./notify-form"
import { fill, useLocale, useSite, useT } from "@/components/cms/provider"
import { localePath } from "@/lib/i18n"

const KEY = "mjazo-my-ref"

/**
 * The visitor's personal referral code + link, shared on WhatsApp. Signed in, it's their account's
 * code; otherwise their name and number make one on the server (it's theirs from then on, and the
 * credit it earns waits in their account).
 */
export function ReferGenerator() {
  const acc = useAccount()
  const [busy, setBusy] = useState(false)
  const { referral } = useSite()
  const t = useT().offers
  const locale = useLocale()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    if (acc.state === "in" && acc.me.referral) setCode(acc.me.referral.code)
  }, [acc])
  useEffect(() => {
    setOrigin(window.location.origin)
    try {
      setCode(localStorage.getItem(KEY))
      const c = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
      if (c.name) setName(c.name)
      if (c.phone) setPhone(c.phone)
    } catch {}
  }, [])

  const link = code ? `${origin}${localePath("/", locale)}?ref=${code}` : ""
  const message = fill(t.shareMessage, { amount: formatPKR(referral.friendOff), link })

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = normalisePhone(phone)
    if (name.trim().length < 2) return setError(t.errName)
    if (!PK_PHONE.test(p)) return setError(t.errPhone)
    setError("")
    setBusy(true)
    try {
      const res = await fetch("/api/v1/referral", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), phone: p }) })
      const r = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
      if (!res.ok || !r.code) return setError(r.error ?? t.errPhone)
      try {
        localStorage.setItem(KEY, r.code)
      } catch {}
      setCode(r.code)
      track("referral_code_created", { code: r.code })
    } finally {
      setBusy(false)
    }
  }

  if (code)
    return (
      <div className="rounded-3xl bg-white p-6 text-foreground">
        <p className="text-sm text-zinc-500">{t.yourCode}</p>
        <p className="font-mono text-3xl tracking-wide mt-1">{code}</p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-zinc-50 border border-zinc-200 px-4 h-12 text-sm">
          <span className="truncate flex-1">{link}</span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(link)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="shrink-0 flex items-center gap-1 text-zinc-600 hover:text-black"
            aria-label={t.copyLink}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("referral_share", { code, channel: "whatsapp" })}
          className="mt-4 h-12 rounded-full bg-[#25D366] text-foreground flex items-center justify-center gap-2 text-sm font-medium"
        >
          <MessageCircle className="w-4 h-4" /> {t.share}
        </a>
      </div>
    )

  return (
    <form onSubmit={create} className="rounded-3xl bg-white p-6 text-foreground grid gap-4">
      <Field label={t.yourName}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
      <Field label={t.yourPhone} hint={t.phoneHint}><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" /></Field>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button disabled={busy} className="h-12 rounded-full bg-foreground text-background text-sm font-medium hover:bg-brand hover:text-foreground transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {t.getCode}
      </button>
    </form>
  )
}
