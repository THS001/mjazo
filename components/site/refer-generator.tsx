"use client"

import { useEffect, useState } from "react"
import { Check, Copy, MessageCircle } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { submit, track } from "@/lib/site"
import { Field, inputCls } from "./forms"
import { PK_PHONE, normalisePhone } from "./notify-form"
import { useSite } from "@/components/cms/provider"

const KEY = "mjazo-my-ref"
const makeCode = (name: string, phone: string) => `${name.trim().split(/\s+/)[0].replace(/[^a-z]/gi, "").toUpperCase().slice(0, 10) || "MJAZO"}-${phone.slice(-4)}`

/** Creates the visitor's personal referral code + link and shares it on WhatsApp. */
export function ReferGenerator() {
  const { referral } = useSite()
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

  const link = code ? `${origin}/?ref=${code}` : ""
  const message = `I book my home services on Mjazo: verified pros, clear prices, pay after. Use my link for ${formatPKR(referral.friendOff)} off your first booking: ${link}`

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = normalisePhone(phone)
    if (name.trim().length < 2) return setError("Enter your name")
    if (!PK_PHONE.test(p)) return setError("Enter a Pakistani mobile number, e.g. 0300 1234567")
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
        <p className="text-sm text-zinc-500">Your code</p>
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
            aria-label="Copy link"
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
          <MessageCircle className="w-4 h-4" /> Share on WhatsApp
        </a>
      </div>
    )

  return (
    <form onSubmit={create} className="rounded-3xl bg-white p-6 text-foreground grid gap-4">
      <Field label="Your name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
      <Field label="Your WhatsApp number" hint="So we can credit you when friends book."><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" /></Field>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button className="h-12 rounded-full bg-foreground text-background text-sm font-medium hover:bg-brand hover:text-foreground transition-colors">Get my code</button>
    </form>
  )
}
