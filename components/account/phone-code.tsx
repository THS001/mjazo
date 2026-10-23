"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { CustomerApiError, type CodeSent, type PhoneChannels } from "@/lib/client/customer"
import { inputCls } from "@/components/site/forms"
import { fill, useT } from "@/components/cms/provider"

// The code step of phone sign-in (and of proving a number when an emailed sign-in adds it): the
// "send me a code" buttons, where the code went, the box for it (the phone's SMS suggestion can
// fill it), sending it again after the wait or by SMS instead, and another number.

type T = ReturnType<typeof useT>
export type Via = "whatsapp" | "sms" | undefined

/** A sign-in code problem in the page's language (the server's code says which). */
export function codeProblem(err: unknown, t: T, channels: PhoneChannels) {
  const m = t.myAccount
  if (!(err instanceof CustomerApiError)) return (err as Error).message
  switch (err.code) {
    case "phone":
      return t.notify.errPhone
    case "wrong":
      return m.codeWrong
    case "expired":
      return m.codeExpired
    case "tries":
      return m.codeTries
    case "wait":
      return fill(m.codeWait, { seconds: err.retryIn ?? 30 })
    case "limit":
      return m.codeLimit
    case "send":
      return channels?.sms && channels.whatsapp ? m.codeSendSms : m.codeSend
    case "off":
      return m.codeOff
    default:
      return err.message
  }
}

/** How a code goes when they just press Enter: WhatsApp when it's set up, else SMS (test mode: on screen). */
export const defaultVia = (c: NonNullable<PhoneChannels>): Via => (c.test ? undefined : c.whatsapp ? "whatsapp" : "sms")

/** The "send me a code" buttons for the channels this site has. The first one submits the form (defaultVia). */
export function SendCodeButtons({ channels, busy, onSms }: { channels: NonNullable<PhoneChannels>; busy: "" | "whatsapp" | "sms" | "test"; onSms: () => void }) {
  const m = useT().myAccount
  const btn = "w-full h-12 rounded-full flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
  const first = channels.test ? m.sendCode : channels.whatsapp ? m.sendCodeWhatsapp : m.sendCodeSms
  return (
    <div className="mt-6 space-y-3">
      <button type="submit" disabled={!!busy} className={`${btn} ${channels.whatsapp && !channels.test ? "bg-[#25D366] text-foreground hover:brightness-95" : "bg-foreground text-background hover:bg-brand hover:text-foreground"}`}>
        {busy && busy !== "sms" && <Loader2 className="w-4 h-4 animate-spin" />} {first}
      </button>
      {channels.whatsapp && channels.sms && !channels.test && (
        <button type="button" onClick={onSms} disabled={!!busy} className={`${btn} border border-zinc-300 hover:border-black`}>
          {busy === "sms" && <Loader2 className="w-4 h-4 animate-spin" />} {m.sendCodeSms}
        </button>
      )}
    </div>
  )
}

export function CodeStep({ phone, sent, channels, busy, error, submitLabel, onCode, onResend, onBack }: { phone: string; sent: CodeSent; channels: PhoneChannels; busy: boolean; error: string; submitLabel?: string; onCode: (code: string) => void; onResend: (via: Via) => void; onBack: () => void }) {
  const m = useT().myAccount
  const [code, setCode] = useState("")
  const [left, setLeft] = useState(sent.resendIn)
  useEffect(() => {
    setLeft(sent.resendIn)
    setCode("")
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [sent])
  const type = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 6)
    setCode(digits)
    // Six digits (typed, pasted or the phone's suggestion): straight in.
    if (digits.length === 6 && !busy) onCode(digits)
  }
  return (
    <div>
      {sent.via !== "test" && <p className="text-zinc-600 mt-3">{fill(m.codeSent, { phone, via: sent.via === "sms" ? m.viaSms : m.viaWhatsapp })}</p>}
      {sent.testCode &&<p className="mt-3 rounded-2xl bg-brand-soft text-brand-ink px-4 py-3 text-sm">{fill(m.testCode, { code: sent.testCode })}</p>}
      <label className="block mt-6">
        <span className="block text-sm font-medium mb-1.5">{m.codeLabel}</span>
        <input className={`${inputCls} text-center text-2xl tracking-[0.5em]`} value={code} onChange={(e) => type(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" aria-invalid={!!error} autoFocus dir="ltr" />
      </label>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      <button type="button" onClick={() => onCode(code)} disabled={busy || code.length !== 6} className="mt-6 w-full h-12 rounded-full bg-foreground text-background flex items-center justify-center gap-2 hover:bg-brand hover:text-foreground transition-colors disabled:opacity-60">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} {submitLabel ?? m.verifyCode}
      </button>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {left > 0 ? (
          <span className="text-zinc-500">{fill(m.resendIn, { seconds: left })}</span>
        ) : (
          <>
            <button type="button" onClick={() => onResend(sent.via === "sms" ? "sms" : sent.via === "whatsapp" ? "whatsapp" : undefined)} className="underline underline-offset-4">
              {m.resend}
            </button>
            {sent.via === "whatsapp" && channels?.sms && (
              <button type="button" onClick={() => onResend("sms")} className="underline underline-offset-4">
                {m.resendSms}
              </button>
            )}
          </>
        )}
        <button type="button" onClick={onBack} className="underline underline-offset-4 text-zinc-500">
          {m.otherNumber}
        </button>
      </div>
    </div>
  )
}
