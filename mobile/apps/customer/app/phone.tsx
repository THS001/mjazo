import { ApiError, Button, errorText, Field, normalisePhone, Notice, Screen, Txt, useLang, validPhone } from "@mjazo/shared"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable } from "react-native"
import { CodeStep, codeProblem, defaultVia, type CodeSent, type Via } from "../src/phone-code"
import { deviceBookings, useAccount, useT } from "../src/state"

// After the first emailed sign-in: their phone number, which brings in the bookings made with it.
// A number that already has bookings needs proof: a code sent to it (where codes are set up), a
// booking made on this phone (sent by itself), or a booking number from one of its confirmations.

export default function Phone() {
  const t = useT()
  const { lang } = useLang()
  const { account, api, refresh, config } = useAccount()
  const channels = config?.phoneSignIn ?? null
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [proof, setProof] = useState("")
  const [needProof, setNeedProof] = useState(false)
  const [sent, setSent] = useState<CodeSent | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (account.state === "in") router.replace("/account")
  }, [account.state])
  const go = async (code?: string) => {
    if (name.trim().length < 2) return setError(t.errName)
    if (!validPhone(phone)) return setError(t.errPhone)
    setBusy(true)
    setError("")
    try {
      const mine = (await deviceBookings()).map((b) => b.id)
      await api("/api/v1/customer/me/link", { body: { name: name.trim(), phone: normalisePhone(phone), proof: [...mine, ...(proof.trim() ? [proof.trim().toUpperCase()] : [])], ...(code ? { code } : {}) } })
      await refresh()
    } catch (e) {
      const why = e instanceof ApiError ? e.code : undefined
      if (why === "proof") setNeedProof(true)
      setError(why === "proof" ? t.proofSub : why === "taken" ? t.linkTaken : code ? codeProblem(e, t, channels) : errorText(e, t.offline))
    } finally {
      setBusy(false)
    }
  }
  const sendCode = async (via: Via) => {
    setBusy(true)
    setError("")
    try {
      setSent(await api<CodeSent>("/api/v1/customer/phone/code", { body: { phone: normalisePhone(phone), via, lang: lang === "ur" ? "ur" : "en" } }))
    } catch (e) {
      setError(codeProblem(e, t, channels))
    } finally {
      setBusy(false)
    }
  }
  if (sent)
    return (
      <Screen>
        <CodeStep phone={normalisePhone(phone)} sent={sent} channels={channels} busy={busy} error={error} submitLabel={t.continue} onCode={(c) => void go(c)} onResend={(via) => void sendCode(via)} onBack={() => (setSent(null), setError(""))} />
      </Screen>
    )
  return (
    <Screen>
      <Txt v="muted">{t.phoneSub}</Txt>
      <Field label={t.name} value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label={t.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0300 1234567" />
      {needProof && <Field label={t.proofLabel} value={proof} onChangeText={setProof} autoCapitalize="none" placeholder="MJ-…" />}
      {error ? <Notice tone={needProof ? "amber" : "red"} text={error} /> : null}
      <Button title={t.continue} busy={busy} onPress={() => void go()} />
      {needProof && channels ? (
        <Pressable onPress={() => void sendCode(defaultVia(channels))} hitSlop={8}>
          <Txt v="small" style={{ textDecorationLine: "underline" }}>
            {t.proofByCode}
          </Txt>
        </Pressable>
      ) : null}
    </Screen>
  )
}
