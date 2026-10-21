import "react-native-url-polyfill/auto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"
import * as Linking from "expo-linking"
import { AppState, Platform } from "react-native"
import { request } from "./api"

// Email sign-in (Supabase), the same accounts as the website. The emailed link opens the app
// (mjazo://auth-callback, or Expo Go's address while testing) with a one-time code, which this
// phone swaps for a session; the link only works on the phone that asked for it. The session's
// access token is the bearer token for /api/v1. Supabase's public address and key come from the
// server (/api/v1/config), so nothing is built into the app.

export type AppConfig = { emailSignIn: boolean; supabase: { url: string; anonKey: string } | null; contact: { phone: string; whatsapp: string; email: string } | null }

let client: SupabaseClient | null = null
let config: Promise<AppConfig> | null = null

/** The server's public settings (cached for the app's life; a failure is retried next time). */
export function appConfig(): Promise<AppConfig> {
  if (!config)
    config = request<AppConfig>("/api/v1/config").catch((e) => {
      config = null
      throw e
    })
  return config
}

/** The Supabase client, or null when email sign-in isn't set up on the server. */
export async function supabase(): Promise<SupabaseClient | null> {
  if (client) return client
  const c = await appConfig()
  if (!c.supabase) return null
  client = createClient(c.supabase.url, c.supabase.anonKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: "pkce" },
  })
  // Refresh the session only while the app is open (Supabase's advice for phones).
  if (Platform.OS !== "web") {
    AppState.addEventListener("change", (s) => {
      if (s === "active") client?.auth.startAutoRefresh()
      else client?.auth.stopAutoRefresh()
    })
  }
  return client
}

/** Where the emailed link brings them back: this app's auth-callback screen. */
export const authRedirect = () => Linking.createURL("auth-callback")

/** Emails a sign-in link. `create: false` for pros (only people Mjazo added can sign in). */
export async function sendSignInLink(email: string, create = true) {
  const sb = await supabase()
  if (!sb) throw new Error("Email sign-in isn't available")
  const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: authRedirect(), shouldCreateUser: create } })
  if (error) throw new Error(error.message)
}

/** Finishes the emailed link (its `code`, or an `error_description` when it failed). */
export async function finishSignIn(params: { code?: string; error_description?: string }): Promise<Session> {
  if (params.error_description) throw new Error(params.error_description)
  const sb = await supabase()
  if (!sb || !params.code) throw new Error("The sign-in link didn't work")
  const { data, error } = await sb.auth.exchangeCodeForSession(params.code)
  if (error || !data.session) throw new Error(error?.message ?? "The sign-in link didn't work")
  return data.session
}

/** The current access token (refreshed when needed), or null when signed out. */
export async function accessToken(): Promise<string | null> {
  const sb = await supabase().catch(() => null)
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export async function signOutEmail() {
  const sb = await supabase().catch(() => null)
  await sb?.auth.signOut().catch(() => {})
}
