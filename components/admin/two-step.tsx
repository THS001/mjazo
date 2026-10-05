"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react"
import { mfaEnrollAction, mfaVerifyAction } from "@/app/(staff)/admin/mfa-actions"
import { signOutAction } from "@/app/(staff)/admin/actions"
import { Btn, Notice } from "./ui"

// Two-step sign-in: set up an authenticator app (scan the QR code, enter its code), or enter the
// current code at sign-in.

export function TwoStep({ mode, available, email, back }: { mode: "needs-code" | "needs-setup"; available: boolean; email: string; back: string }) {
  const router = useRouter()
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mode !== "needs-setup" || !available) return
    void mfaEnrollAction().then((r) => (r.ok ? setSetup(r.data) : setError(r.issues?.join(" ") || r.error)))
  }, [mode, available])

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    const r = await mfaVerifyAction(setup?.factorId ?? null, code)
    if (!r.ok) {
      setBusy(false)
      setError(r.issues?.join(" ") || r.error)
      return
    }
    router.replace(back)
    router.refresh()
  }

  const codeBox = (
    <form onSubmit={verify} className="space-y-3">
      <label className="block text-[13px] font-medium" htmlFor="code">
        6-digit code
      </label>
      <input
        id="code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, "").slice(0, 7))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={mode === "needs-code"}
        placeholder="123 456"
        className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-center font-mono text-xl tracking-[0.3em] outline-none focus:border-foreground"
      />
      <Btn variant="primary" className="w-full" busy={busy} disabled={code.replace(/\s/g, "").length !== 6}>
        {mode === "needs-setup" ? "Turn on two-step sign-in" : "Continue"}
      </Btn>
    </form>
  )

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-ink">{mode === "needs-setup" ? <ShieldCheck className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}</span>
        <span className="text-sm text-zinc-500">{email}</span>
      </div>
      <h1 className="font-serif text-3xl">{mode === "needs-setup" ? "Set up two-step sign-in" : "Enter your code"}</h1>

      {!available ? (
        <Notice className="mt-6">Two-step sign-in needs Supabase. In local development you&apos;re already signed in.</Notice>
      ) : mode === "needs-code" ? (
        <>
          <p className="mb-6 mt-2 text-sm text-zinc-500">Open your authenticator app and enter the code it shows for Mjazo CMS.</p>
          {codeBox}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-zinc-500">
            Owners and Admins can change everything, so their sign-in needs a second step: a code from an authenticator app on their phone (Google Authenticator, Microsoft Authenticator or 1Password all work).
          </p>
          <ol className="mt-6 space-y-5 text-sm">
            <li>
              <p className="flex items-center gap-2 font-medium">
                <Smartphone className="h-4 w-4" /> 1. Scan this with the app
              </p>
              <div className="mt-3 grid h-48 w-48 place-items-center rounded-2xl border border-zinc-200 bg-white p-2">
                {/* Supabase returns the QR code as an SVG data URL. */}
                {setup ? <img src={setup.qr} alt="QR code to add Mjazo CMS to an authenticator app" className="h-full w-full" /> : <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />}
              </div>
              {setup && (
                <p className="mt-2 text-xs text-zinc-500">
                  Can&apos;t scan? Type this key into the app instead: <code className="break-all rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] text-foreground">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
                </p>
              )}
            </li>
            <li>
              <p className="mb-3 font-medium">2. Enter the code the app shows</p>
              {codeBox}
            </li>
          </ol>
        </>
      )}

      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}
      <form action={signOutAction} className="mt-8">
        <button className="text-xs text-zinc-500 underline-offset-2 hover:text-foreground hover:underline">Sign out</button>
      </form>
    </div>
  )
}
