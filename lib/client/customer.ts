"use client"

import { useCallback, useEffect, useState } from "react"
import { browserSupabase } from "@/components/admin/supabase-browser"
import { getBookings } from "@/lib/bookings"
import type { Customer } from "@/lib/core/customers"

// The signed-in customer in the browser. Customers sign in with an emailed link (Supabase keeps
// the session in this browser) or with their phone number and a code (the token is kept in
// localStorage); every /api/v1/customer call sends the token, exactly as the phone app does.
// Locally without Supabase, a test sign-in keeps a token in localStorage too.

const DEV_KEY = "mjazo-dev-customer"
const PHONE_KEY = "mjazo-customer-phone"
export const ACCOUNT_EVENT = "mjazo:account"

/** Email sign-in is set up on this site (otherwise only the local test sign-in). */
export const emailSignIn = () => Boolean(browserSupabase())

export async function customerToken(): Promise<string | null> {
  try {
    const saved = localStorage.getItem(DEV_KEY) ?? localStorage.getItem(PHONE_KEY)
    if (saved) return saved
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
    /** Seconds until it can be tried again (a sign-in code asked for too soon). */
    readonly retryIn?: number,
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
  if (!res.ok) throw new CustomerApiError(data?.error ?? "Something went wrong", res.status, data?.code, typeof data?.retryIn === "number" ? data.retryIn : undefined)
  return data as T
}

/** Sends the emailed sign-in link; it opens /account (or `next`) in this browser, signed in. */
export async function sendSignInLink(email: string, next: string) {
  const sb = browserSupabase()
  if (!sb) throw new Error("Email sign-in isn't set up here")
  const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}${next}`, shouldCreateUser: true } })
  if (error) throw error
}

/** How sign-in codes can go to a phone (null: phone sign-in is off on this site). */
export type PhoneChannels = { whatsapp: boolean; sms: boolean; test: boolean } | null
export type CodeSent = { via: "whatsapp" | "sms" | "test"; expiresIn: number; resendIn: number; testCode?: string }

/** Sends a sign-in code to the number (WhatsApp unless `via` is "sms"). */
export const sendPhoneCode = (phone: string, via: "whatsapp" | "sms" | undefined, lang: string) => customerApi<CodeSent>("/api/v1/customer/phone/code", { phone, via, lang })

/**
 * Signs in with the number and its code, and keeps the token in this browser. The account screens
 * catch up on `announceSignIn()` (after a new customer has given their name).
 */
export async function signInWithCode(phone: string, code: string) {
  const r = await customerApi<{ token: string; customer: Customer; isNew: boolean }>("/api/v1/customer/phone/session", { phone, code })
  localStorage.setItem(PHONE_KEY, r.token)
  return r
}
export const announceSignIn = () => window.dispatchEvent(new Event(ACCOUNT_EVENT))

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
    localStorage.removeItem(PHONE_KEY)
  } catch {}
  await browserSupabase()?.auth.signOut({ scope: "local" })
  window.dispatchEvent(new Event(ACCOUNT_EVENT))
}

/** Signs out on every device: every phone sign-in of theirs, and the emailed one's sessions everywhere. */
export async function signOutEverywhere() {
  await customerApi("/api/v1/customer/me/sessions", undefined, "DELETE").catch(() => {})
  await browserSupabase()?.auth.signOut({ scope: "global" }).catch(() => {})
  await signOut()
}

export type MePlus = { status: "requested" | "active"; endsAt: string | null; discountPct: number; price: number }
export type MeReferral = { code: string; friendOff: number; youGet: number; friends: number; rewarded: number; earned: number }
export type Me = { email: string | null; by?: "email" | "phone"; customer: Customer | null; credit: { balance: number; available: number }; plus?: MePlus | null; referral?: MeReferral | null }
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
