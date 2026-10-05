"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { devLoginAction, prepareSignInAction } from "@/app/(staff)/admin/actions"
import { browserSupabase } from "./supabase-browser"
import { Btn, Notice } from "./ui"

export function LoginForm({ mode, linkError }: { mode: "supabase" | "dev" | "off"; linkError: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(linkError ? { tone: "error", text: "That link has expired or was already used. Request a new one." } : null)
  const callback = (next = "/admin") => `${window.location.origin}/admin/auth/callback?next=${encodeURIComponent(next)}`

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const sb = browserSupabase()
    if (!sb) return
    setBusy("password")
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
    setBusy("")
    if (error) setMsg({ tone: "error", text: error.message === "Invalid login credentials" ? "That email and password don't match." : error.message })
    else router.replace("/admin")
  }
  const magic = async () => {
    const sb = browserSupabase()
    if (!sb || !email) return setMsg({ tone: "error", text: "Enter your email first." })
    setBusy("magic")
    await prepareSignInAction(email).catch(() => {})
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback(), shouldCreateUser: false } })
    setBusy("")
    setMsg(error ? { tone: "error", text: error.message } : { tone: "ok", text: `Check ${email} for a sign-in link.` })
  }
  const reset = async () => {
    const sb = browserSupabase()
    if (!sb || !email) return setMsg({ tone: "error", text: "Enter your email first." })
    setBusy("reset")
    await prepareSignInAction(email).catch(() => {})
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: callback("/admin/account") })
    setBusy("")
    setMsg(error ? { tone: "error", text: error.message } : { tone: "ok", text: `If ${email} has an account, a reset link is on its way.` })
  }

  return (
    <div className="w-full max-w-sm">
      <svg viewBox="0 0 24 24" className="mb-6 w-10 h-10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M8 21v-6.5l4 3.5 4-3.5V21" />
        <circle cx="18.5" cy="5.5" r="1.6" fill="#F4A437" stroke="none" />
      </svg>
      <h1 className="font-serif text-4xl">Mjazo CMS</h1>
      <p className="mt-2 text-sm text-zinc-500">Sign in to edit the website.</p>
      {msg && (
        <Notice tone={msg.tone} className="mt-6">
          {msg.text}
        </Notice>
      )}
      {mode === "supabase" && (
        <form onSubmit={signIn} className="mt-6 space-y-3">
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-foreground" />
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-foreground" />
          <Btn variant="primary" className="h-11 w-full" busy={busy === "password"} disabled={!email || !password}>
            Sign in
          </Btn>
          <div className="flex justify-between pt-1 text-xs">
            <button type="button" onClick={magic} className="text-zinc-500 hover:text-foreground">
              {busy === "magic" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Email me a sign-in link"}
            </button>
            <button type="button" onClick={reset} className="text-zinc-500 hover:text-foreground">
              {busy === "reset" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Forgot password?"}
            </button>
          </div>
        </form>
      )}
      {mode === "dev" && (
        <form action={devLoginAction} className="mt-6 space-y-3">
          <Notice tone="warn">Supabase isn't configured, so this is local development mode. Changes are saved to .data/cms on this computer only.</Notice>
          <Btn variant="primary" className="h-11 w-full">
            Continue as local Owner
          </Btn>
        </form>
      )}
      {mode === "off" && (
        <Notice className="mt-6">
          Sign-in isn't set up yet. Add the Supabase keys (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) and CMS_OWNER_EMAIL in Vercel, run migration 0004_cms.sql, then redeploy.
        </Notice>
      )}
    </div>
  )
}
