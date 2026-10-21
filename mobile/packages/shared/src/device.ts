import Constants, { ExecutionEnvironment } from "expo-constants"
import * as Device from "expo-device"
import * as Location from "expo-location"
import { Platform } from "react-native"

// The phone's location and push notifications.
// - Location: asked for only when it's used (a pro's "On my way", check-in, finish and SOS; a
//   customer's "Use my location"), never in the background.
// - Push: needs the installed app (Expo Go can't receive pushes since SDK 53) and the Expo project
//   id that `eas init` writes into app.json. Until then it's skipped, and messages go by WhatsApp,
//   email or the log as before.

export type Coords = { lat: number; lng: number }

const timeout = <T,>(ms: number) => new Promise<T | null>((r) => setTimeout(() => r(null), ms))

/** Where the phone is, or null (no permission, or no answer within 15 seconds: the action goes ahead without it). */
export const currentLocation = () => Promise.race([locate(), timeout<Coords>(15_000)])

async function locate(): Promise<Coords | null> {
  try {
    const p = await Location.requestForegroundPermissionsAsync()
    if (p.status !== "granted") return null
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000 }).catch(() => null)
    const pos = recent ?? (await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout<Location.LocationObject>(10_000)]))
    return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null
  } catch {
    return null
  }
}

const inExpoGo = () => Constants.executionEnvironment === ExecutionEnvironment.StoreClient

/** Why this phone can't get pushes, or null when it can. */
export function pushUnavailable(): string | null {
  if (Platform.OS === "web") return "web"
  if (inExpoGo()) return "expo-go"
  if (!Device.isDevice) return "emulator"
  if (!projectId()) return "no-project"
  return null
}

const projectId = () => (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId

/** Asks for permission and returns this phone's Expo push token, or null. */
export async function pushToken(): Promise<{ token: string; platform: "ios" | "android" } | null> {
  if (pushUnavailable()) return null
  try {
    // Loaded only where pushes work: Expo Go warns as soon as the module is imported.
    const N = await import("expo-notifications")
    if (Platform.OS === "android") await N.setNotificationChannelAsync("default", { name: "Mjazo", importance: N.AndroidImportance.HIGH })
    const now = await N.getPermissionsAsync()
    const status = now.status === "granted" ? now.status : (await N.requestPermissionsAsync()).status
    if (status !== "granted") return null
    const t = await N.getExpoPushTokenAsync({ projectId: projectId()! })
    return { token: t.data, platform: Platform.OS === "ios" ? "ios" : "android" }
  } catch (e) {
    console.warn("[push] no token", e)
    return null
  }
}

/** Calls `onOpen` with a notification's data when the person taps it (and for the one that opened the app). */
export function onNotificationTap(onOpen: (data: Record<string, unknown>) => void): () => void {
  if (pushUnavailable()) return () => {}
  let sub: { remove(): void } | null = null
  let stopped = false
  void import("expo-notifications").then((N) => {
    if (stopped) return
    N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) })
    void N.getLastNotificationResponseAsync().then((r) => r && onOpen(r.notification.request.content.data ?? {}))
    sub = N.addNotificationResponseReceivedListener((r) => onOpen(r.notification.request.content.data ?? {}))
  })
  return () => {
    stopped = true
    sub?.remove()
  }
}
