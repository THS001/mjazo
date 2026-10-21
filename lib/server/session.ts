import "server-only"
import crypto from "crypto"
import { cookies } from "next/headers"

// Pro app sessions: an HMAC-signed cookie (SESSION_SECRET). Pros log in with phone + PIN
// (scrypt-hashed, set by ops). Without SESSION_SECRET in production the pro app stays switched
// off; locally a fixed development secret is used. Staff (mission control and the CMS) sign in
// with their own email instead: lib/server/staff.ts.

const COOKIE = "mjz_staff"
export type Session = { role: "pro"; proId: string; exp: number }

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

export async function setSession(s: { role: "pro"; proId: string }, maxAgeSec: number) {
  const payload = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + maxAgeSec * 1000 })).toString("base64url")
  const jar = await cookies()
  jar.set(COOKIE, `${payload}.${sig(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: maxAgeSec })
}

export async function clearSession() {
  ;(await cookies()).delete(COOKIE)
}

export async function getSession(): Promise<Session | null> {
  if (!proEnabled()) return null
  const raw = (await cookies()).get(COOKIE)?.value
  if (!raw) return null
  const [payload, mac] = raw.split(".")
  if (!payload || !mac || !safeEqual(mac, sig(payload))) return null
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session
    return s.exp > Date.now() && s.role === "pro" ? s : null
  } catch {
    return null
  }
}

/** Not signed in (the console or app shows its sign-in screen). */
export class AuthError extends Error {}
/** Signed in, but not allowed to do this. */
export class ForbiddenError extends Error {}

export async function requirePro() {
  const s = await getSession()
  if (!s) throw new AuthError("pro")
  return s
}

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
