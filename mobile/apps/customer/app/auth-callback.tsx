import { Button, finishSignIn, Loading, Notice, Screen } from "@mjazo/shared"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { useAccount, useT } from "../src/state"

// Where the emailed sign-in link lands (mjazo://auth-callback?code=…): swaps the code for a
// session, then carries on to the account (or to adding the phone number).

export default function AuthCallback() {
  const t = useT()
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>()
  const { refresh } = useAccount()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    finishSignIn(params)
      .then(async () => {
        await refresh()
        if (live) router.replace("/account")
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, params.error_description])
  if (!failed) return <Loading label={t.signingIn} />
  return (
    <Screen top>
      <Notice text={t.linkFailed} />
      <Button title={t.signIn} onPress={() => router.replace("/login")} />
    </Screen>
  )
}
