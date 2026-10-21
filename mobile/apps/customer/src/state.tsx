import { accessToken, API_URL, appConfig, ApiError, prefs, request, secret, signOutEmail, supabase, useLang, useStrings, type AppConfig, type CartItem, type Catalog, type Me, type RequestOptions } from "@mjazo/shared"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { S } from "./strings"

// The app's state, shared by every screen:
// - the catalogue, in the app's language (the last copy is kept, so the app opens offline too);
// - the cart (kept on the phone), and "book her again";
// - the account: signed out, signed in without a phone number yet, or signed in;
// - the bookings made on this phone (to show them before sign-in, and as proof of the number).

export const useT = () => useStrings(S)

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

type CatalogCtx = { catalog: Catalog | null; error: unknown; reload: () => void }
const CatalogContext = createContext<CatalogCtx>({ catalog: null, error: null, reload: () => {} })

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { lang, ready } = useLang()
  const l = lang === "ur" ? "ur" : "en"
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!ready) return
    let live = true
    const key = `mjazo.catalog.${l}`
    void prefs.get<Catalog | null>(key, null).then((saved) => live && saved && setCatalog((c) => c ?? saved))
    request<Catalog>(`/api/v1/catalog?lang=${l}`).then(
      (c) => {
        if (!live) return
        setCatalog(c)
        setError(null)
        void prefs.set(key, c)
      },
      (e) => live && setError(e),
    )
    return () => {
      live = false
    }
  }, [l, ready, tick])
  // After a language change the old copy shows until the new one arrives.
  const value = useMemo(() => ({ catalog, error, reload: () => setTick((t) => t + 1) }), [catalog, error])
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
export const useCatalog = () => useContext(CatalogContext)

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export type Rebook = { proId: string; firstName: string }
type CartCtx = {
  items: CartItem[]
  rebook: Rebook | null
  add: (item: Omit<CartItem, "key">) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
  setRebook: (r: Rebook | null) => void
  subtotal: number
  count: number
}
const CartContext = createContext<CartCtx | null>(null)
const CART_KEY = "mjazo.cart"

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [rebook, setRebook] = useState<Rebook | null>(null)
  const loaded = useRef(false)
  useEffect(() => {
    void prefs.get<{ items: CartItem[]; rebook: Rebook | null }>(CART_KEY, { items: [], rebook: null }).then((c) => {
      setItems((now) => (now.length ? now : c.items))
      setRebook((now) => now ?? c.rebook)
      loaded.current = true
    })
  }, [])
  useEffect(() => {
    if (loaded.current) void prefs.set(CART_KEY, { items, rebook })
  }, [items, rebook])
  const value = useMemo<CartCtx>(() => {
    const keyOf = (i: Omit<CartItem, "key">) => [i.category, i.service, ...i.options, "+", ...[...i.addOns].sort()].join("|")
    return {
      items,
      rebook,
      add: (item) =>
        setItems((list) => {
          const key = keyOf(item)
          const same = list.find((x) => x.key === key)
          return same ? list.map((x) => (x.key === key ? { ...x, qty: Math.min(10, x.qty + item.qty) } : x)) : [...list, { ...item, key }]
        }),
      setQty: (key, qty) => setItems((list) => list.map((x) => (x.key === key ? { ...x, qty: Math.max(1, Math.min(10, qty)) } : x))),
      remove: (key) => setItems((list) => list.filter((x) => x.key !== key)),
      clear: () => {
        setItems([])
        setRebook(null)
      },
      setRebook,
      subtotal: items.reduce((s, i) => s + i.unitPrice * i.qty, 0),
      count: items.reduce((s, i) => s + i.qty, 0),
    }
  }, [items, rebook])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
export function useCart() {
  const c = useContext(CartContext)
  if (!c) throw new Error("useCart outside CartProvider")
  return c
}

// ---------------------------------------------------------------------------
// Bookings made on this phone
// ---------------------------------------------------------------------------

export type DeviceBooking = { id: string; date: string; window: string; total: number; services: string[]; at: string }
const DEVICE_KEY = "mjazo.bookings"
export const deviceBookings = () => prefs.get<DeviceBooking[]>(DEVICE_KEY, [])
export async function rememberBooking(b: DeviceBooking) {
  const list = await deviceBookings()
  await prefs.set(DEVICE_KEY, [b, ...list.filter((x) => x.id !== b.id)].slice(0, 30))
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

type State = { state: "loading" } | { state: "out" } | { state: "phone"; me: Me } | { state: "in"; me: Me & { customer: NonNullable<Me["customer"]> } }
type AccountCtx = {
  account: State
  config: AppConfig | null
  /** A call to /api/v1 as the signed-in customer (signed out: as a guest). */
  api: <T = Record<string, unknown>>(path: string, o?: Omit<RequestOptions, "token">) => Promise<T>
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  /** Local test sign-in, against a test server only (the live server refuses it). */
  devSignIn: (email: string) => Promise<void>
}
const AccountContext = createContext<AccountCtx | null>(null)
const DEV_KEY = "mjazo.dev-customer"
/** The local test sign-in is offered only when the app talks to a test server. */
export const testServer = !/^https:\/\/mjazo\.(vercel\.app|pk)$/.test(API_URL)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<State>({ state: "loading" })
  const [config, setConfig] = useState<AppConfig | null>(null)
  const token = useCallback(async () => (await secret.get(DEV_KEY)) ?? (await accessToken()), [])
  const api = useCallback(async <T,>(path: string, o: Omit<RequestOptions, "token"> = {}) => request<T>(path, { ...o, token: await token() }), [token])
  const refresh = useCallback(async () => {
    const t = await token()
    if (!t) return setAccount({ state: "out" })
    try {
      const me = await request<Me>("/api/v1/customer/me", { token: t })
      setAccount(me.customer ? { state: "in", me: me as Me & { customer: NonNullable<Me["customer"]> } } : { state: "phone", me })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await secret.remove(DEV_KEY)
        await signOutEmail()
        setAccount({ state: "out" })
      } else setAccount((a) => (a.state === "loading" ? { state: "out" } : a))
    }
  }, [token])
  useEffect(() => {
    void appConfig().then(setConfig, () => setConfig({ emailSignIn: false, supabase: null, contact: null }))
    void refresh()
    let unsub: (() => void) | undefined
    void supabase()
      .then((sb) => {
        const { data } = sb?.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN" || event === "SIGNED_OUT") void refresh()
        }) ?? { data: null }
        unsub = () => data?.subscription.unsubscribe()
      })
      .catch(() => {})
    return () => unsub?.()
  }, [refresh])
  const value = useMemo<AccountCtx>(
    () => ({
      account,
      config,
      api,
      refresh,
      signOut: async () => {
        await secret.remove(DEV_KEY)
        await signOutEmail()
        setAccount({ state: "out" })
      },
      devSignIn: async (email) => {
        const { token: t } = await request<{ token: string }>("/api/v1/customer/dev-login", { body: { email } })
        await secret.set(DEV_KEY, t)
        await refresh()
      },
    }),
    [account, config, api, refresh],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
export function useAccount() {
  const c = useContext(AccountContext)
  if (!c) throw new Error("useAccount outside AccountProvider")
  return c
}
