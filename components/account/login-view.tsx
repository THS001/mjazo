"use client"

import Link from "@/components/site/locale-link"
import { useEffect, useState } from "react"
import { useRouter } from "@/components/site/locale-link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { track } from "@/lib/site"
import { inputCls } from "@/components/site/forms"
import { PK_PHONE, normalisePhone } from "@/components/site/notify-form"
import { EASE } from "@/components/site/primitives"
import { fillNodes, useT } from "@/components/cms/provider"

/** Sign in: saves the customer's name + number as their Mjazo profile on this device. */
export function LoginView() {
  const router = useRouter()
  const t = useT()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
      if (c.name) setName(c.name)
      if (c.phone) setPhone(c.phone)
    } catch {}
  }, [])

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError(t.checkout.errName)
    if (!PK_PHONE.test(normalisePhone(phone))) return setError(t.notify.errPhone)
    try {
      const c = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
      localStorage.setItem("mjazo-contact", JSON.stringify({ ...c, name: name.trim(), phone: normalisePhone(phone) }))
    } catch {}
    track("sign_in", { method: "phone" })
    router.push("/account")
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
          <h1 className="font-serif text-5xl">{t.login.title}</h1>
          <p className="text-zinc-600 mt-3">{t.login.sub}</p>
          <label className="block mt-8">
            <span className="block text-sm font-medium mb-1.5">{t.form.name}</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block mt-4">
            <span className="block text-sm font-medium mb-1.5">{t.login.phone}</span>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" aria-invalid={!!error} />
          </label>
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          <button type="submit" className="mt-6 w-full h-12 rounded-full bg-foreground text-background flex items-center justify-center gap-2 hover:bg-brand hover:text-foreground transition-colors">
            {t.login.continue} <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
          </button>
          <p className="text-xs text-zinc-500 mt-4">{fillNodes(t.login.legal, { terms: <Link href="/terms" className="underline">{t.login.terms}</Link>, privacy: <Link href="/privacy" className="underline">{t.login.privacy}</Link> })}</p>
        </motion.form>
      </div>
    </div>
  )
}
