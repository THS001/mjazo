import { Button, finishSignIn, Loading, Notice, Screen } from "@mjazo/shared"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { useSession, useT } from "../src/session"

// Where the emailed sign-in link lands (mjazopro://auth-callback?code=…).

export default function AuthCallback() {
  const t = useT()
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>()
  const { refresh } = useSession()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    finishSignIn(params)
      .then(async () => {
        await refresh()
        if (live) router.replace("/")
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
      <Notice text={t.linkError} />
      <Button title={t.login} onPress={() => router.replace("/login")} />
    </Screen>
  )
}
