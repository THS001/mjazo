"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { mfaStatusAction } from "@/app/(staff)/admin/mfa-actions"
import { browserSupabase } from "./supabase-browser"
import { Btn, Notice, when } from "./ui"

export function PasswordForm() {
  const [pw, setPw] = useState("")
  const [again, setAgain] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 10) return setMsg({ tone: "error", text: "Use at least 10 characters." })
    if (pw !== again) return setMsg({ tone: "error", text: "The two passwords don't match." })
    const sb = browserSupabase()
    if (!sb) return
    setBusy(true)
    const { error } = await sb.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setMsg({ tone: "error", text: error.message })
    else {
      setMsg({ tone: "ok", text: "Password saved." })
      setPw("")
      setAgain("")
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-foreground" />
      <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Repeat it" className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-foreground" />
      <Btn variant="primary" busy={busy}>
        Save password
      </Btn>
    </form>
  )
}

/** Your account: whether two-step sign-in is on, and a way to turn it on. */
export function TwoStepStatus() {
  const [s, setS] = useState<{ required: boolean; factors: { id: string; name: string; created: string }[] } | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    void mfaStatusAction().then((r) => (r.ok ? setS(r.data) : setError(r.error)))
  }, [])
  if (error) return <Notice tone="error">{error}</Notice>
  if (!s) return <p className="text-sm text-zinc-500">Checking…</p>
  return (
    <div className="text-sm">
      {s.factors.length ? (
        <p className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" /> On. Authenticator added {when(s.factors[0].created)}.
        </p>
      ) : (
        <p className="text-zinc-600">Off. {s.required ? "Your role must use it: you'll be asked to set it up." : "You can turn it on for extra safety."}</p>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        {s.factors.length ? "Lost your phone? Ask an Owner to reset it from People & roles, then set it up again." : ""}
        {!s.factors.length && (
          <Link href="/admin/two-step?setup=1" className="font-medium text-foreground underline underline-offset-2">
            Set up two-step sign-in
          </Link>
        )}
      </p>
    </div>
  )
}
