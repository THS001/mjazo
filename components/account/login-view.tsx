"use client"

import Link from "@/components/site/locale-link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "@/components/site/locale-link"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, MailCheck } from "lucide-react"
import { track } from "@/lib/site"
import { announceSignIn, customerApi, devSignIn, emailSignIn, sendPhoneCode, sendSignInLink, signInWithCode, useAccount, type CodeSent, type PhoneChannels } from "@/lib/client/customer"
import { cn } from "@/lib/utils"
import { inputCls } from "@/components/site/forms"
import { PK_PHONE, normalisePhone } from "@/components/site/notify-form"
import { EASE } from "@/components/site/primitives"
import { fill, fillNodes, useLocale, useT } from "@/components/cms/provider"
import { CodeStep, codeProblem, defaultVia, SendCodeButtons, type Via } from "./phone-code"

/**
 * Sign in with a phone number and a code (when WhatsApp or SMS codes are set up, or locally in test
 * mode), or with an emailed link (locally without Supabase: a test sign-in).
 */
export function LoginView({ phone: channels }: { phone: PhoneChannels }) {
  const router = useRouter()
  const t = useT()
  const m = t.myAccount
  const acc = useAccount()
  const [method, setMethod] = useState<"phone" | "email">(channels ? "phone" : "email")
  // A new customer gives their name before the account opens.
  const naming = useRef(false)
  useEffect(() => {
    if ((acc.state === "in" || acc.state === "phone") && !naming.current) router.replace("/account")
  }, [acc.state, router])

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-end p-16 overflow-hidden" style={{ background: "linear-gradient(160deg, #f7d9a0 0%, #f4a437 45%, #e8914a 100%)" }}>
        <span aria-hidden className="absolute -end-10 -top-10 font-bold text-[16rem] leading-none tracking-tighter text-white/25">MJ</span>
        <p className="relative font-serif text-6xl leading-[1]">{t.login.tagline}</p>
        <p className="relative text-black/60 mt-4 max-w-sm">{t.login.taglineSub}</p>
      </div>
      <div className="flex items-center justify-center px-4 sm:px-6 pt-32 pb-24">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="w-full max-w-sm">
          <h1 className="font-serif text-5xl">{m.signInTitle}</h1>
          {channels && (
            <div role="tablist" className="mt-6 inline-flex rounded-full bg-zinc-100 p-1">
              {(["phone", "email"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={method === k} onClick={() => setMethod(k)} className={cn("h-9 px-4 rounded-full text-sm", method === k ? "bg-white shadow-sm" : "text-zinc-600")}>
                  {k === "phone" ? m.byPhone : m.email}
                </button>
              ))}
            </div>
          )}
          {acc.state === "out" && acc.failed && <p className="text-sm text-destructive mt-4">{m.linkFailed}</p>}
          {method === "phone" && channels ? (
            <PhoneSignIn channels={channels} naming={naming} onDone={() => router.push("/account")} />
          ) : (
            <EmailSignIn />
          )}
          <p className="text-xs text-zinc-500 mt-4">
            {fillNodes(m.legal, {
              terms: (
                <Link href="/terms" className="underline">
                  {t.login.terms}
                </Link>
              ),
              privacy: (
                <Link href="/privacy" className="underline">
                  {t.login.privacy}
                </Link>
              ),
            })}
          </p>
        </motion.div>
      </div>
    </div>
  )
}

/** Number → code → (a new customer) their name. */
function PhoneSignIn({ channels, naming, onDone }: { channels: NonNullable<PhoneChannels>; naming: React.RefObject<boolean>; onDone: () => void }) {
  const t = useT()
  const m = t.myAccount
  const locale = useLocale()
  const [phone, setPhone] = useState("")
  const [sent, setSent] = useState<CodeSent | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [busy, setBusy] = useState<"" | "whatsapp" | "sms" | "test" | "code" | "name">("")
  const [error, setError] = useState("")
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
      if (c.phone) setPhone(c.phone)
    } catch {}
  }, [])

  const send = async (via: Via) => {
    if (!PK_PHONE.test(normalisePhone(phone))) return setError(t.notify.errPhone)
    setBusy(via ?? "test")
    setError("")
    try {
      setSent(await sendPhoneCode(normalisePhone(phone), via, locale))
      track("sign_in_code", { method: via ?? "test" })
    } catch (e) {
      setError(codeProblem(e, t, channels))
    } finally {
      setBusy("")
    }
  }
  const verify = async (code: string) => {
    setBusy("code")
    setError("")
    try {
      const r = await signInWithCode(normalisePhone(phone), code)
      track("sign_in", { method: "phone" })
      if (!r.customer.name) {
        naming.current = true
        setName("")
      } else {
        announceSignIn()
        onDone()
      }
    } catch (e) {
      setError(codeProblem(e, t, channels))
    } finally {
      setBusy("")
    }
  }
  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((name ?? "").trim().length < 2) return setError(t.checkout.errName)
    setBusy("name")
    setError("")
    try {
      await customerApi("/api/v1/customer/me", { name: name!.trim() }, "PATCH")
      naming.current = false
      announceSignIn()
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setBusy("")
    }
  }

  if (name !== null)
    return (
      <form onSubmit={saveName} noValidate>
        <h2 className="font-serif text-3xl mt-8">{m.nameTitle}</h2>
        <p className="text-zinc-600 mt-2">{m.nameSub}</p>
        <label className="block mt-6">
          <span className="block text-sm font-medium mb-1.5">{t.form.name}</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus aria-invalid={!!error} />
        </label>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        <button disabled={busy === "name"} className="mt-6 w-full h-12 rounded-full bg-foreground text-background flex items-center justify-center gap-2 hover:bg-brand hover:text-foreground transition-colors disabled:opacity-60">
          {busy === "name" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {m.continue} {busy !== "name" && <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />}
        </button>
      </form>
    )
  if (sent) return <CodeStep phone={normalisePhone(phone)} sent={sent} channels={channels} busy={busy === "code"} error={error} onCode={verify} onResend={send} onBack={() => (setSent(null), setError(""))} />
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void send(defaultVia(channels))
      }}
      noValidate
    >
      <p className="text-zinc-600 mt-3">{m.phoneSignInSub}</p>
      <label className="block mt-8">
        <span className="block text-sm font-medium mb-1.5">{t.form.phone}</span>
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" aria-invalid={!!error} dir="ltr" />
      </label>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      <SendCodeButtons channels={channels} busy={busy === "code" || busy === "name" ? "" : busy} onSms={() => void send("sms")} />
    </form>
  )
}

/** An emailed sign-in link (locally without Supabase: the test sign-in). */
function EmailSignIn() {
  const router = useRouter()
  const m = useT().myAccount
  const locale = useLocale()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"email" | "dev" | null>(null)
  useEffect(() => setMode(emailSignIn() ? "email" : "dev"), [])

  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(m.badEmail)
    setBusy(true)
    setError("")
    try {
      if (mode === "dev") {
        await devSignIn(email.trim())
        track("sign_in", { method: "dev" })
        router.push("/account")
        return
      }
      await sendSignInLink(email.trim(), locale === "ur" ? "/ur/account" : "/account")
      track("sign_in_link", { method: "email" })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (sent)
    return (
      <div className="mt-8 rounded-3xl bg-brand-soft p-6">
        <MailCheck className="w-7 h-7 text-brand-ink" />
        <p className="mt-3 text-brand-ink">{fill(m.linkSent, { email: email.trim() })}</p>
      </div>
    )
  return (
    <form onSubmit={go} noValidate>
      <p className="text-zinc-600 mt-3">{mode === "dev" ? m.devSignIn : m.signInSub}</p>
      <label className="block mt-8">
        <span className="block text-sm font-medium mb-1.5">{m.email}</span>
        <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" aria-invalid={!!error} />
      </label>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      <button type="submit" disabled={busy || !mode} className="mt-6 w-full h-12 rounded-full bg-foreground text-background flex items-center justify-center gap-2 hover:bg-brand hover:text-foreground transition-colors disabled:opacity-60">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {mode === "dev" ? m.continue : m.sendLink} {!busy && <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />}
      </button>
    </form>
  )
}
