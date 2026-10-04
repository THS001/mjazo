"use client"

import { useState } from "react"
import { browserSupabase } from "./supabase-browser"
import { Btn, Notice } from "./ui"

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
