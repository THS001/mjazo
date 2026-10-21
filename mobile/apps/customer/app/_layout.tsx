import { color, LangProvider, onNotificationTap, prefs, pushToken } from "@mjazo/shared"
import { router, Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AccountProvider, CartProvider, CatalogProvider, useAccount, useT } from "../src/state"

// The Mjazo app: browse and book, track bookings live, rate, and the account, in English or Urdu.
// Everything goes through the website's /api/v1, so it always shows what the website shows.

export default function Root() {
  return (
    <SafeAreaProvider>
      <LangProvider langs={["en", "ur"]}>
        <AccountProvider>
          <CatalogProvider>
            <CartProvider>
              <StatusBar style="dark" />
              <Push />
              <Screens />
            </CartProvider>
          </CatalogProvider>
        </AccountProvider>
      </LangProvider>
    </SafeAreaProvider>
  )
}

function Screens() {
  const t = useT()
  return (
    <Stack screenOptions={{ headerTintColor: color.ink, headerStyle: { backgroundColor: color.bg }, headerShadowVisible: false, contentStyle: { backgroundColor: color.bg }, headerBackTitle: t.back, headerTitleStyle: { fontWeight: "700" } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t.home }} />
      <Stack.Screen name="category/[slug]" options={{ title: "" }} />
      <Stack.Screen name="service/[category]/[slug]" options={{ title: "", presentation: "modal" }} />
      <Stack.Screen name="cart" options={{ title: t.cart }} />
      <Stack.Screen name="checkout" options={{ title: t.checkout }} />
      <Stack.Screen name="booked/[id]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="booking/[id]" options={{ title: "" }} />
      <Stack.Screen name="login" options={{ title: t.signIn, presentation: "modal" }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      <Stack.Screen name="phone" options={{ title: t.phoneTitle }} />
      <Stack.Screen name="addresses" options={{ title: t.addresses }} />
      <Stack.Screen name="address" options={{ title: t.addAddress, presentation: "modal" }} />
    </Stack>
  )
}

/** Signed in on the installed app: register this phone for booking updates, and open a booking when its notification is tapped. */
function Push() {
  const { account, api } = useAccount()
  const signedIn = account.state === "in"
  useEffect(() => onNotificationTap((data) => typeof data.bookingId === "string" && router.push(`/booking/${data.bookingId}`)), [])
  useEffect(() => {
    if (!signedIn) return
    void (async () => {
      const p = await pushToken()
      if (!p) return
      const last = await prefs.get<string | null>("mjazo.push", null)
      if (last === p.token) return
      await api("/api/v1/customer/push-token", { body: p })
      await prefs.set("mjazo.push", p.token)
    })().catch(() => {})
  }, [signedIn, api])
  return null
}
