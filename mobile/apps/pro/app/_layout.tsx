import { color, LangProvider, onNotificationTap, prefs, pushToken } from "@mjazo/shared"
import { router, Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { ScheduleProvider } from "../src/schedule"
import { LiveTracker } from "../src/tracker"
import { PUSH_KEY, SessionProvider, useSession, useT } from "../src/session"

// Mjazo Pro: her day, her offers, her money and her safety, in English, Urdu or Roman Urdu. All
// through /api/v1/pro, the same API as /pro on the website.

export default function Root() {
  return (
    <SafeAreaProvider>
      <LangProvider langs={["en", "ur", "ro"]}>
        <SessionProvider>
          <ScheduleProvider>
            <StatusBar style="dark" />
            <Push />
            <LiveTracker />
            <Screens />
          </ScheduleProvider>
        </SessionProvider>
      </LangProvider>
    </SafeAreaProvider>
  )
}

function Screens() {
  const t = useT()
  return (
    <Stack screenOptions={{ headerTintColor: color.ink, headerStyle: { backgroundColor: color.bg }, headerShadowVisible: false, contentStyle: { backgroundColor: color.bg }, headerTitleStyle: { fontWeight: "700" } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t.tabToday }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      <Stack.Screen name="visit/[id]" options={{ title: "" }} />
    </Stack>
  )
}

/** Signed in on the installed app: register for offer notifications; a tapped offer opens Offers. */
function Push() {
  const { session, api } = useSession()
  const signedIn = session.state === "in"
  useEffect(() => onNotificationTap((data) => (data.rule === "proOffer" ? router.push("/offers") : typeof data.bookingId === "string" ? router.push({ pathname: "/visit/[id]", params: { id: data.bookingId } }) : undefined)), [])
  useEffect(() => {
    if (!signedIn) return
    void (async () => {
      const p = await pushToken()
      if (!p) return
      if ((await prefs.get<string | null>(PUSH_KEY, null)) === p.token) return
      await api("/api/v1/pro/push-token", { body: p })
      await prefs.set(PUSH_KEY, p.token)
    })().catch(() => {})
  }, [signedIn, api])
  return null
}
