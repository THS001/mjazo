"use client"

import { useEffect, useState } from "react"
import { Check, Copy, MessageCircle } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { submit, track } from "@/lib/site"
import { Field, inputCls } from "./forms"
import { PK_PHONE, normalisePhone } from "./notify-form"
import { fill, useLocale, useSite, useT } from "@/components/cms/provider"
import { localePath } from "@/lib/i18n"

const KEY = "mjazo-my-ref"
const makeCode = (name: string, phone: string) => `${name.trim().split(/\s+/)[0].replace(/[^a-z]/gi, "").toUpperCase().slice(0, 10) || "MJAZO"}-${phone.slice(-4)}`

/** Creates the visitor's personal referral code + link and shares it on WhatsApp. */
export function ReferGenerator() {
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
    const c = makeCode(name, p)
    try {
      localStorage.setItem(KEY, c)
    } catch {}
    setCode(c)
    track("referral_code_created", { code: c })
    // Register the code so credits can be matched to this customer.
    submit("enquiry", { kind: "contact", name: name.trim(), phone: p, message: `Referral code created: ${c}`, details: { referralCode: c } }).catch(() => {})
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
      <button className="h-12 rounded-full bg-foreground text-background text-sm font-medium hover:bg-brand hover:text-foreground transition-colors">{t.getCode}</button>
    </form>
  )
}
