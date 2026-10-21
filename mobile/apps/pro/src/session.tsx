import { accessToken, ApiError, appConfig, prefs, request, secret, sendSignInLink, signOutEmail, useStrings, type AppConfig, type ProProfile, type RequestOptions } from "@mjazo/shared"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { T } from "./strings"

// The pro's session. She signs in with her phone number and the PIN ops gave her (a signed token
// kept in the phone's keychain), or with an emailed link (a Supabase session). Every call to
// /api/v1/pro carries it; when the server refuses it (PIN reset, account paused) she's signed out.

export const useT = () => useStrings(T)

type State = { state: "loading" } | { state: "out"; expired?: boolean } | { state: "in"; pro: ProProfile }
type Ctx = {
  session: State
  config: AppConfig | null
  api: <R = Record<string, unknown>>(path: string, o?: Omit<RequestOptions, "token">) => Promise<R>
  signInPin: (phone: string, pin: string) => Promise<void>
  /** Step 1 of email sign-in: the server checks the email belongs to a pro, then Supabase sends the link. */
  sendEmailLink: (email: string) => Promise<void>
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}
const SessionContext = createContext<Ctx | null>(null)
const TOKEN = "mjazo.pro.token"
export const PUSH_KEY = "mjazo.pro.push"

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<State>({ state: "loading" })
  const [config, setConfig] = useState<AppConfig | null>(null)
  const signingOut = useRef(false)
  const token = useCallback(async () => (await secret.get(TOKEN)) ?? (await accessToken()), [])

  const clear = useCallback(async (expired: boolean) => {
    await secret.remove(TOKEN)
    await signOutEmail()
    await prefs.remove(PUSH_KEY)
    setSession({ state: "out", expired })
  }, [])

  const api = useCallback(
    async <R,>(path: string, o: Omit<RequestOptions, "token"> = {}) => {
      try {
        return await request<R>(path, { ...o, token: await token() })
      } catch (e) {
        // Signed out by the server (a new PIN, a paused account): back to sign-in.
        if (e instanceof ApiError && e.status === 401 && !signingOut.current) await clear(true)
        throw e
      }
    },
    [token, clear],
  )

  const refresh = useCallback(async () => {
    const t = await token()
    if (!t) return setSession({ state: "out" })
    try {
      setSession({ state: "in", pro: await request<ProProfile>("/api/v1/pro/me", { token: t }) })
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) await clear(e.status === 401)
      // Offline at start: keep what we had, or show sign-in only if we had nothing.
      else setSession((s) => (s.state === "loading" ? { state: "out" } : s))
    }
  }, [token, clear])

  useEffect(() => {
    void appConfig().then(setConfig, () => setConfig({ emailSignIn: false, supabase: null, contact: null }))
    void refresh()
  }, [refresh])

  const value = useMemo<Ctx>(
    () => ({
      session,
      config,
      api,
      refresh,
      signInPin: async (phone, pin) => {
        const r = await request<{ token: string; pro: ProProfile }>("/api/v1/pro/session", { body: { phone, pin } })
        await secret.set(TOKEN, r.token)
        setSession({ state: "in", pro: r.pro })
      },
      sendEmailLink: async (email) => {
        await request("/api/v1/pro/session/email", { body: { email } })
        await sendSignInLink(email, false)
      },
      signOut: async () => {
        signingOut.current = true
        // This phone stops getting her offers.
        const push = await prefs.get<string | null>(PUSH_KEY, null)
        if (push) await api("/api/v1/pro/push-token", { method: "DELETE", body: { token: push } }).catch(() => {})
        await clear(false)
        signingOut.current = false
      },
    }),
    [session, config, api, refresh, clear],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const c = useContext(SessionContext)
  if (!c) throw new Error("useSession outside SessionProvider")
  return c
}
