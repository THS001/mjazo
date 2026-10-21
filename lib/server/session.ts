import "server-only"
import crypto from "crypto"
import { cookies } from "next/headers"

// Pro app sessions: an HMAC-signed session (SESSION_SECRET), kept in a cookie by the web app and
// sent as a bearer token by the phone app (lib/server/pro-auth.ts). Pros log in with phone + PIN
// (scrypt-hashed, set by ops) or an emailed link. Without SESSION_SECRET in production the pro app
// stays switched off; locally a fixed development secret is used. Staff (mission control and the
// CMS) sign in with their own email instead: lib/server/staff.ts.

const COOKIE = "mjz_staff"
/** `pv`: a fingerprint of her PIN when the session began, so resetting the PIN ends every session. */
export type Session = { role: "pro"; proId: string; exp: number; pv: string }

/** The phone app's tokens start with this, so they can't be mistaken for a Supabase access token. */
export const TOKEN_PREFIX = "mjp."

const DEV_SECRET = "local-dev-session-secret-not-for-production"
const secret = () => process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? DEV_SECRET : "")

/** Whether the pro app can sign people in. */
export const proEnabled = () => Boolean(secret())

function sig(data: string) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url")
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export const pinVersion = (pinHash?: string | null) => crypto.createHash("sha256").update(pinHash ?? "").digest("base64url").slice(0, 12)

/** A signed session: the cookie's value, and (with TOKEN_PREFIX) the phone app's bearer token. */
export function signSession(s: Omit<Session, "exp">, maxAgeSec: number) {
  const exp = Date.now() + maxAgeSec * 1000
  const payload = Buffer.from(JSON.stringify({ ...s, exp })).toString("base64url")
  return { value: `${payload}.${sig(payload)}`, exp }
}

/** The session in a signed value, or null when it's missing, forged, expired or from before `pv` existed. */
export function readSession(raw: string | null | undefined): Session | null {
  if (!raw || !proEnabled()) return null
  const [payload, mac, extra] = raw.split(".")
  if (!payload || !mac || extra !== undefined || !safeEqual(mac, sig(payload))) return null
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session
    return s.role === "pro" && typeof s.proId === "string" && typeof s.pv === "string" && s.exp > Date.now() ? s : null
  } catch {
    return null
  }
}

/** Any small value, signed with the same secret and given an expiry (e.g. the local test sign-in for customers). */
export function signPayload(data: Record<string, unknown>, maxAgeSec: number) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + maxAgeSec * 1000 })).toString("base64url")
  return `${payload}.${sig(payload)}`
}

/** A value signed by signPayload, or null when it's forged or expired. */
export function readPayload<T extends Record<string, unknown>>(raw: string | null | undefined): T | null {
  if (!raw || !proEnabled()) return null
  const [payload, mac, extra] = raw.split(".")
  if (!payload || !mac || extra !== undefined || !safeEqual(mac, sig(payload))) return null
  try {
    const v = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { exp: number }
    return typeof v.exp === "number" && v.exp > Date.now() ? v : null
  } catch {
    return null
  }
}

export async function setSession(value: string, maxAgeSec: number) {
  ;(await cookies()).set(COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: maxAgeSec })
}

export async function clearSession() {
  ;(await cookies()).delete(COOKIE)
}

/** The web app's session (its cookie), checked only for its signature and expiry. */
export async function getSession(): Promise<Session | null> {
  return readSession((await cookies()).get(COOKIE)?.value)
}

/** Not signed in (the console or app shows its sign-in screen). */
export class AuthError extends Error {}
/** Signed in, but not allowed to do this. */
export class ForbiddenError extends Error {}

export function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex")
  return `${salt}:${crypto.scryptSync(pin, salt, 32).toString("hex")}`
}

export function verifyPin(pin: string, stored?: string) {
  if (!stored) return false
  const [salt, hash] = stored.split(":")
  return safeEqual(crypto.scryptSync(pin, salt, 32).toString("hex"), hash)
}

export const randomToken = (n = 18) => crypto.randomBytes(n).toString("base64url")
