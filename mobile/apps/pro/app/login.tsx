import { ApiError, Button, Chip, color, errorText, Field, normalisePhone, Notice, Row, Screen, space, Txt, useLang, validPhone } from "@mjazo/shared"
import { Redirect } from "expo-router"
import { useState } from "react"
import { View } from "react-native"
import { useSession, useT } from "../src/session"

// Sign in: phone number and the PIN ops gave her, or (when it's set up) an emailed link.

export default function Login() {
  const t = useT()
  const { lang, setLang } = useLang()
  const { session, config, signInPin, sendEmailLink } = useSession()
  const [mode, setMode] = useState<"pin" | "email">("pin")
  const [phone, setPhone] = useState("")
  const [pin, setPin] = useState("")
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  if (session.state === "in") return <Redirect href="/" />

  const go = async () => {
    setError("")
    if (mode === "pin") {
      if (!validPhone(phone)) return setError(t.badPhone)
      if (pin.length < 4) return setError(t.badPin)
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t.badEmail)
    setBusy(true)
    try {
      if (mode === "pin") await signInPin(normalisePhone(phone), pin)
      else {
        await sendEmailLink(email.trim())
        setSent(true)
      }
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? t.pinWrong : errorText(e, t.offline))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen top>
      <View style={{ alignItems: "center", gap: space.sm, paddingVertical: space.xl }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: color.ink, alignItems: "center", justifyContent: "center" }}>
          <Txt v="title" style={{ color: color.brand }}>
            M
          </Txt>
        </View>
        <Txt v="title" center>
          {t.appName}
        </Txt>
        <Txt v="muted" center>
          {t.appSub}
        </Txt>
      </View>
      {session.state === "out" && session.expired && <Notice tone="amber" text={t.signedOut} />}
      {mode === "pin" ? (
        <>
          <Field label={t.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0300 1234567" />
          <Field label={t.pin} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, ""))} keyboardType="number-pad" secure maxLength={6} />
          <Txt v="muted">{t.forgot}</Txt>
        </>
      ) : (
        <>
          <Field label={t.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          {sent && <Notice tone="green" text={t.linkSent} />}
        </>
      )}
      {error ? <Notice text={error} /> : null}
      <Button title={mode === "pin" ? t.login : t.sendLink} busy={busy} onPress={go} />
      {config?.emailSignIn && <Button title={mode === "pin" ? t.orEmail : t.orPin} variant="ghost" onPress={() => setMode(mode === "pin" ? "email" : "pin")} />}
      <Row style={{ justifyContent: "center", marginTop: space.lg }}>
        <Chip label="English" selected={lang === "en"} onPress={() => setLang("en")} />
        <Chip label="اردو" selected={lang === "ur"} onPress={() => setLang("ur")} />
        <Chip label="Roman Urdu" selected={lang === "ro"} onPress={() => setLang("ro")} />
      </Row>
    </Screen>
  )
}
