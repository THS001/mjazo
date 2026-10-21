"use client"

import { useCallback, useEffect, useState } from "react"
import { browserSupabase } from "@/components/admin/supabase-browser"
import { getBookings } from "@/lib/bookings"
import type { Customer } from "@/lib/core/customers"

// The signed-in customer in the browser. Customers sign in with an emailed link (Supabase keeps
// the session in this browser); every /api/v1/customer call sends its access token, exactly as
// the phone app will. Locally without Supabase, a test sign-in keeps a token in localStorage.

const DEV_KEY = "mjazo-dev-customer"
export const ACCOUNT_EVENT = "mjazo:account"

/** Email sign-in is set up on this site (otherwise only the local test sign-in). */
export const emailSignIn = () => Boolean(browserSupabase())

export async function customerToken(): Promise<string | null> {
  try {
    const dev = localStorage.getItem(DEV_KEY)
    if (dev) return dev
  } catch {}
  const sb = browserSupabase()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export class CustomerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

/** Calls /api/v1/customer (or any API) as the signed-in customer. */
export async function customerApi<T = Record<string, unknown>>(url: string, body?: unknown, method?: string): Promise<T> {
  const token = await customerToken()
  const res = await fetch(url, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new CustomerApiError(data?.error ?? "Something went wrong", res.status, data?.code)
  return data as T
}

/** Sends the emailed sign-in link; it opens /account (or `next`) in this browser, signed in. */
export async function sendSignInLink(email: string, next: string) {
  const sb = browserSupabase()
  if (!sb) throw new Error("Email sign-in isn't set up here")
  const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}${next}`, shouldCreateUser: true } })
  if (error) throw error
}

/** Local development: sign in as a test customer. */
export async function devSignIn(email: string) {
  const { token } = await customerApi<{ token: string }>("/api/v1/customer/dev-login", { email })
  localStorage.setItem(DEV_KEY, token)
  window.dispatchEvent(new Event(ACCOUNT_EVENT))
}

/** Finishes an emailed link that landed on this page (?code=…), then tidies the address bar. */
export async function finishSignIn(): Promise<"none" | "ok" | "failed"> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get("code")
  if (!code) return "none"
  const sb = browserSupabase()
  url.searchParams.delete("code")
  window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash)
  if (!sb) return "failed"
  const { data } = await sb.auth.getSession()
  if (data.session) return "ok"
  const { error } = await sb.auth.exchangeCodeForSession(code)
  return error ? "failed" : "ok"
}

export async function signOut() {
  try {
    localStorage.removeItem(DEV_KEY)
  } catch {}
  await browserSupabase()?.auth.signOut({ scope: "local" })
  window.dispatchEvent(new Event(ACCOUNT_EVENT))
}

export type MePlus = { status: "requested" | "active"; endsAt: string | null; discountPct: number; price: number }
export type MeReferral = { code: string; friendOff: number; youGet: number; friends: number; rewarded: number; earned: number }
export type Me = { email: string | null; customer: Customer | null; credit: { balance: number; available: number }; plus?: MePlus | null; referral?: MeReferral | null }
export type AccountState = { state: "loading" } | { state: "out"; failed?: boolean } | { state: "phone"; me: Me } | { state: "in"; me: Me & { customer: Customer } }

/** Who's signed in, kept fresh across the page (sign-in, phone added, sign-out). */
export function useAccount() {
  const [s, setS] = useState<AccountState>({ state: "loading" })
  const load = useCallback(async () => {
    const finished = await finishSignIn().catch(() => "failed" as const)
    if (!(await customerToken())) return setS({ state: "out", failed: finished === "failed" })
    try {
      const me = await customerApi<Me>("/api/v1/customer/me")
      setS(me.customer ? { state: "in", me: me as Me & { customer: Customer } } : { state: "phone", me })
    } catch (e) {
      // A stale session (401), or accounts switched off here (403): signed out.
      if (e instanceof CustomerApiError && e.status === 401) await signOut().catch(() => {})
      setS({ state: "out" })
    }
  }, [])
  useEffect(() => {
    void load()
    const again = () => void load()
    window.addEventListener(ACCOUNT_EVENT, again)
    return () => window.removeEventListener(ACCOUNT_EVENT, again)
  }, [load])
  return { ...s, reload: load }
}

/** Booking numbers made on this device: proof that a phone number's bookings are theirs. */
export const deviceBookingIds = () => getBookings().map((b) => b.id)
