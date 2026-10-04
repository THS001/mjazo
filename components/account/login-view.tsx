"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { track } from "@/lib/site"
import { inputCls } from "@/components/site/forms"
import { PK_PHONE, normalisePhone } from "@/components/site/notify-form"
import { EASE } from "@/components/site/primitives"

/** Sign in: saves the customer's name + number as their Mjazo profile on this device. */
export function LoginView() {
  const router = useRouter()
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
    if (name.trim().length < 2) return setError("Enter your name")
    if (!PK_PHONE.test(normalisePhone(phone))) return setError("Enter a Pakistani mobile number, e.g. 0300 1234567")
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
        <span aria-hidden className="absolute -right-10 -top-10 font-bold text-[16rem] leading-none tracking-tighter text-white/25">MJ</span>
        <p className="relative font-serif text-6xl leading-[1]">Ghar ka har kaam. Pakka.</p>
        <p className="relative text-black/60 mt-4 max-w-sm">Your bookings, saved details and one-tap rebooking, in one place.</p>
      </div>
      <div className="flex items-center justify-center px-4 sm:px-6 pt-32 pb-24">
        <motion.form onSubmit={go} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="w-full max-w-sm" noValidate>
          <h1 className="font-serif text-5xl">Welcome to Mjazo</h1>
          <p className="text-zinc-600 mt-3">Sign in with your name and number. No passwords, nothing to remember.</p>
          <label className="block mt-8">
            <span className="block text-sm font-medium mb-1.5">Your name</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block mt-4">
            <span className="block text-sm font-medium mb-1.5">Mobile / WhatsApp number</span>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" aria-invalid={!!error} />
          </label>
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          <button type="submit" className="mt-6 w-full h-12 rounded-full bg-foreground text-background flex items-center justify-center gap-2 hover:bg-brand hover:text-foreground transition-colors">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-xs text-zinc-500 mt-4">Your profile is saved on this device and we confirm every booking on WhatsApp. By continuing you agree to our <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy" className="underline">privacy policy</Link>.</p>
        </motion.form>
      </div>
    </div>
  )
}
