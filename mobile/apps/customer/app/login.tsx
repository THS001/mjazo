import { Button, errorText, Field, fill, Loading, Notice, Screen, sendSignInLink, Txt } from "@mjazo/shared"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { testServer, useAccount, useT } from "../src/state"

// Sign in with an emailed link (the same account as the website). Against a test server, a local
// test sign-in is offered too (the live server refuses it).

export default function Login() {
  const t = useT()
  const { config, account, devSignIn } = useAccount()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState("")
  const [busy, setBusy] = useState<"" | "link" | "dev">("")
  const [error, setError] = useState("")
  // Signed in (here or by the emailed link): on to the number, or back.
  useEffect(() => {
    if (account.state === "in") {
      if (router.canGoBack()) router.back()
      else router.replace("/account")
    }
    if (account.state === "phone") router.replace("/phone")
  }, [account.state])
  if (!config) return <Loading />
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
    <Screen>
      <Txt v="title">{t.signInTitle}</Txt>
      <Txt v="muted">{t.signInSub}</Txt>
      <Field label={t.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
      {sent ? <Notice tone="green" text={fill(t.linkSent, { email: sent })} /> : null}
      {error ? <Notice text={error} /> : null}
      {config.emailSignIn ? <Button title={t.sendLink} busy={busy === "link"} onPress={() => go("link")} /> : !testServer ? <Notice tone="amber" text={t.signInOff} /> : null}
      {testServer && <Button title={t.devSignIn} variant="light" busy={busy === "dev"} onPress={() => go("dev")} />}
    </Screen>
  )
}
