"use client"

import Link from "@/components/site/locale-link"
import { useEffect, useState } from "react"
import { useRouter } from "@/components/site/locale-link"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, MailCheck } from "lucide-react"
import { track } from "@/lib/site"
import { devSignIn, emailSignIn, sendSignInLink, useAccount } from "@/lib/client/customer"
import { inputCls } from "@/components/site/forms"
import { EASE } from "@/components/site/primitives"
import { fill, fillNodes, useLocale, useT } from "@/components/cms/provider"

/** Sign in with an emailed link (locally without Supabase: a test sign-in). */
export function LoginView() {
  const router = useRouter()
  const t = useT()
  const m = t.myAccount
  const locale = useLocale()
  const acc = useAccount()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"email" | "dev" | null>(null)
  useEffect(() => setMode(emailSignIn() ? "email" : "dev"), [])
  useEffect(() => {
    if (acc.state === "in" || acc.state === "phone") router.replace("/account")
  }, [acc.state, router])

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

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-end p-16 overflow-hidden" style={{ background: "linear-gradient(160deg, #f7d9a0 0%, #f4a437 45%, #e8914a 100%)" }}>
        <span aria-hidden className="absolute -end-10 -top-10 font-bold text-[16rem] leading-none tracking-tighter text-white/25">MJ</span>
        <p className="relative font-serif text-6xl leading-[1]">{t.login.tagline}</p>
        <p className="relative text-black/60 mt-4 max-w-sm">{t.login.taglineSub}</p>
      </div>
      <div className="flex items-center justify-center px-4 sm:px-6 pt-32 pb-24">
        <motion.form onSubmit={go} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="w-full max-w-sm" noValidate>
          <h1 className="font-serif text-5xl">{m.signInTitle}</h1>
          {sent ? (
            <div className="mt-8 rounded-3xl bg-brand-soft p-6">
              <MailCheck className="w-7 h-7 text-brand-ink" />
              <p className="mt-3 text-brand-ink">{fill(m.linkSent, { email: email.trim() })}</p>
            </div>
          ) : (
            <>
              <p className="text-zinc-600 mt-3">{mode === "dev" ? m.devSignIn : m.signInSub}</p>
              {acc.state === "out" && acc.failed && <p className="text-sm text-destructive mt-4">{m.linkFailed}</p>}
              <label className="block mt-8">
                <span className="block text-sm font-medium mb-1.5">{m.email}</span>
                <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" aria-invalid={!!error} />
              </label>
              {error && <p className="text-xs text-destructive mt-2">{error}</p>}
              <button type="submit" disabled={busy || !mode} className="mt-6 w-full h-12 rounded-full bg-foreground text-background flex items-center justify-center gap-2 hover:bg-brand hover:text-foreground transition-colors disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {mode === "dev" ? m.continue : m.sendLink} {!busy && <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />}
              </button>
            </>
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
        </motion.form>
      </div>
    </div>
  )
}
