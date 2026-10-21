import { ApiError, Button, errorText, Field, normalisePhone, Notice, Screen, Txt, validPhone } from "@mjazo/shared"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { deviceBookings, useAccount, useT } from "../src/state"

// After the first sign-in: their phone number, which brings in the bookings made with it. A number
// that already has bookings needs proof: a booking made on this phone (sent by itself), or a
// booking number from one of its confirmations.

export default function Phone() {
  const t = useT()
  const { account, api, refresh } = useAccount()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [proof, setProof] = useState("")
  const [needProof, setNeedProof] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (account.state === "in") router.replace("/account")
  }, [account.state])
  const go = async () => {
    if (name.trim().length < 2) return setError(t.errName)
    if (!validPhone(phone)) return setError(t.errPhone)
    setBusy(true)
    setError("")
    try {
      const mine = (await deviceBookings()).map((b) => b.id)
      await api("/api/v1/customer/me/link", { body: { name: name.trim(), phone: normalisePhone(phone), proof: [...mine, ...(proof.trim() ? [proof.trim().toUpperCase()] : [])] } })
      await refresh()
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined
      if (code === "proof") setNeedProof(true)
      setError(code === "proof" ? t.proofSub : code === "taken" ? t.linkTaken : errorText(e, t.offline))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Screen>
      <Txt v="muted">{t.phoneSub}</Txt>
      <Field label={t.name} value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label={t.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0300 1234567" />
      {needProof && <Field label={t.proofLabel} value={proof} onChangeText={setProof} autoCapitalize="none" placeholder="MJ-…" />}
      {error ? <Notice tone={needProof ? "amber" : "red"} text={error} /> : null}
      <Button title={t.continue} busy={busy} onPress={go} />
    </Screen>
  )
}
