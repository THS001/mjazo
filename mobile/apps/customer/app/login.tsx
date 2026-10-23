import { Button, Chip, errorText, Field, fill, Loading, normalisePhone, Notice, Row, Screen, sendSignInLink, Txt, useLang, validPhone, type PhoneChannels } from "@mjazo/shared"
import { router } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { CodeStep, codeProblem, SendCodeButtons, type CodeSent, type Via } from "../src/phone-code"
import { testServer, useAccount, useT } from "../src/state"

// Sign in with a phone number and a code (when the server sends codes by WhatsApp or SMS, or in
// test mode), or with an emailed link (the same account as the website). Against a test server, a
// local test sign-in is offered too (the live server refuses it).

export default function Login() {
  const t = useT()
  const { config, account } = useAccount()
  const channels = config?.phoneSignIn ?? null
  const [method, setMethod] = useState<"phone" | "email" | null>(null)
  // A new customer gives their name before going on.
  const naming = useRef(false)
  useEffect(() => {
    if (config && !method) setMethod(config.phoneSignIn ? "phone" : "email")
  }, [config, method])
  // Signed in (here or by the emailed link): on to the number, or back.
  useEffect(() => {
    if (naming.current) return
    if (account.state === "in") {
      if (router.canGoBack()) router.back()
      else router.replace("/account")
    }
    if (account.state === "phone") router.replace("/phone")
  }, [account.state])
  if (!config || !method) return <Loading />
  return (
    <Screen>
      <Txt v="title">{t.signInTitle}</Txt>
      {channels && (
        <Row>
          <Chip label={t.byPhone} selected={method === "phone"} onPress={() => setMethod("phone")} />
          <Chip label={t.email} selected={method === "email"} onPress={() => setMethod("email")} />
        </Row>
      )}
      {method === "phone" && channels ? <PhoneSignIn channels={channels} naming={naming} /> : <EmailSignIn />}
    </Screen>
  )
}

/** Number → code → (a new customer) their name. */
function PhoneSignIn({ channels, naming }: { channels: NonNullable<PhoneChannels>; naming: React.RefObject<boolean> }) {
  const t = useT()
  const { lang } = useLang()
  const { api, refresh, phoneSignIn } = useAccount()
  const [phone, setPhone] = useState("")
  const [sent, setSent] = useState<CodeSent | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [busy, setBusy] = useState<"" | "whatsapp" | "sms" | "test" | "code" | "name">("")
  const [error, setError] = useState("")

  const send = async (via: Via) => {
    if (!validPhone(phone)) return setError(t.errPhone)
    setBusy(via ?? "test")
    setError("")
    try {
      setSent(await api<CodeSent>("/api/v1/customer/phone/code", { body: { phone: normalisePhone(phone), via, lang: lang === "ur" ? "ur" : "en" } }))
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
      const r = await phoneSignIn(normalisePhone(phone), code)
      if (!r.customer.name) {
        naming.current = true
        setName("")
      } else await refresh()
    } catch (e) {
      setError(codeProblem(e, t, channels))
    } finally {
      setBusy("")
    }
  }
  const saveName = async () => {
    if ((name ?? "").trim().length < 2) return setError(t.errName)
    setBusy("name")
    setError("")
    try {
      await api("/api/v1/customer/me", { method: "PATCH", body: { name: name!.trim() } })
      naming.current = false
      await refresh()
    } catch (e) {
      setError(errorText(e, t.offline))
      setBusy("")
    }
  }

  if (name !== null)
    return (
      <>
        <Txt v="h2">{t.nameTitle}</Txt>
        <Txt v="muted">{t.nameSub}</Txt>
        <Field label={t.name} value={name} onChangeText={setName} autoCapitalize="words" autoFocus error={error || null} />
        <Button title={t.continue} busy={busy === "name"} onPress={saveName} />
      </>
    )
  if (sent) return <CodeStep phone={normalisePhone(phone)} sent={sent} channels={channels} busy={busy === "code"} error={error} onCode={verify} onResend={send} onBack={() => (setSent(null), setError(""))} />
  return (
    <>
      <Txt v="muted">{t.phoneSignInSub}</Txt>
      <Field label={t.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0300 1234567" error={error || null} />
      <SendCodeButtons channels={channels} busy={busy === "code" || busy === "name" ? "" : busy} onSend={send} />
    </>
  )
}

/** An emailed sign-in link; against a test server, the local test sign-in too. */
function EmailSignIn() {
  const t = useT()
  const { config, devSignIn } = useAccount()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState("")
  const [busy, setBusy] = useState<"" | "link" | "dev">("")
  const [error, setError] = useState("")
  const valid = /^\S+@\S+\.\S+$/.test(email.trim())
  const go = async (how: "link" | "dev") => {
    if (!valid) return setError(t.badEmail)
    setBusy(how)
    setError("")
    try {
      if (how === "link") {
        await sendSignInLink(email)
        setSent(email.trim())
      } else await devSignIn(email.trim())
    } catch (e) {
      setError(errorText(e, t.offline))
    } finally {
      setBusy("")
    }
  }
  return (
    <>
      <Txt v="muted">{t.signInSub}</Txt>
      <Field label={t.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
      {sent ? <Notice tone="green" text={fill(t.linkSent, { email: sent })} /> : null}
      {error ? <Notice text={error} /> : null}
      {config?.emailSignIn ? <Button title={t.sendLink} busy={busy === "link"} onPress={() => go("link")} /> : !testServer ? <Notice tone="amber" text={t.signInOff} /> : null}
      {testServer && <Button title={t.devSignIn} variant="light" busy={busy === "dev"} onPress={() => go("dev")} />}
    </>
  )
}
