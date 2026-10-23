import { ApiError, Button, errorText, Field, fill, Notice, Row, Txt, type PhoneChannels } from "@mjazo/shared"
import { useEffect, useState } from "react"
import { Pressable } from "react-native"
import { useT } from "./state"

// The code step of phone sign-in (and of proving a number when an emailed sign-in adds it), as on
// the website: the "send me a code" buttons, where the code went, the box for it (the phone offers
// the code from its SMS), sending it again after the wait or by SMS instead, and another number.

export type Via = "whatsapp" | "sms" | undefined
export type CodeSent = { via: "whatsapp" | "sms" | "test"; expiresIn: number; resendIn: number; testCode?: string }
type T = ReturnType<typeof useT>

/** A sign-in code problem in the app's language (the server's code says which). */
export function codeProblem(e: unknown, t: T, channels: PhoneChannels | undefined) {
  if (!(e instanceof ApiError)) return errorText(e, t.offline)
  switch (e.code) {
    case "phone":
      return t.errPhone
    case "wrong":
      return t.codeWrong
    case "expired":
      return t.codeExpired
    case "tries":
      return t.codeTries
    case "wait":
      return fill(t.codeWait, { seconds: typeof e.data?.retryIn === "number" ? e.data.retryIn : 30 })
    case "limit":
      return t.codeLimit
    case "send":
      return channels?.sms && channels.whatsapp ? t.codeSendSms : t.codeSend
    case "off":
      return t.codeOff
    default:
      return errorText(e, t.offline)
  }
}

/** How a code goes by default: WhatsApp when it's set up, else SMS (test mode: on screen). */
export const defaultVia = (c: NonNullable<PhoneChannels>): Via => (c.test ? undefined : c.whatsapp ? "whatsapp" : "sms")

export function SendCodeButtons({ channels, busy, onSend }: { channels: NonNullable<PhoneChannels>; busy: "" | "whatsapp" | "sms" | "test"; onSend: (via: Via) => void }) {
  const t = useT()
  if (channels.test) return <Button title={t.sendCode} busy={busy === "test"} onPress={() => onSend(undefined)} />
  return (
    <>
      {channels.whatsapp && <Button title={t.sendCodeWhatsapp} variant="whatsapp" busy={busy === "whatsapp"} disabled={!!busy} onPress={() => onSend("whatsapp")} />}
      {channels.sms && <Button title={t.sendCodeSms} variant={channels.whatsapp ? "light" : "dark"} busy={busy === "sms"} disabled={!!busy} onPress={() => onSend("sms")} />}
    </>
  )
}

export function CodeStep({ phone, sent, channels, busy, error, submitLabel, onCode, onResend, onBack }: { phone: string; sent: CodeSent; channels: PhoneChannels | undefined; busy: boolean; error: string; submitLabel?: string; onCode: (code: string) => void; onResend: (via: Via) => void; onBack: () => void }) {
  const t = useT()
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
    // Six digits (typed, pasted or offered from the SMS): straight in.
    if (digits.length === 6 && !busy) onCode(digits)
  }
  const link = (title: string, onPress: () => void) => (
    <Pressable onPress={onPress} hitSlop={8}>
      <Txt v="small" style={{ textDecorationLine: "underline" }}>
        {title}
      </Txt>
    </Pressable>
  )
  return (
    <>
      {sent.via !== "test" && <Txt v="muted">{fill(t.codeSent, { phone, via: sent.via === "sms" ? t.viaSms : t.viaWhatsapp })}</Txt>}
      {sent.testCode ? <Notice tone="brand" text={fill(t.testCode, { code: sent.testCode })} /> : null}
      <Field label={t.codeLabel} value={code} onChangeText={type} keyboardType="number-pad" maxLength={6} placeholder="••••••" otp autoFocus error={error || null} />
      <Button title={submitLabel ?? t.verifyCode} busy={busy} disabled={code.length !== 6} onPress={() => onCode(code)} />
      <Row wrap gap={16}>
        {left > 0 ? (
          <Txt v="muted">{fill(t.resendIn, { seconds: left })}</Txt>
        ) : (
          <>
            {link(t.resend, () => onResend(sent.via === "test" ? undefined : sent.via))}
            {sent.via === "whatsapp" && channels?.sms ? link(t.resendSms, () => onResend("sms")) : null}
          </>
        )}
        {link(t.otherNumber, onBack)}
      </Row>
    </>
  )
}
