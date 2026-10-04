import "server-only"
import crypto from "crypto"
import { cookies } from "next/headers"

// Staff sessions: an HMAC-signed cookie (SESSION_SECRET). Ops log in with OPS_PASSCODE;
// pros log in with phone + PIN (scrypt-hashed, set by ops). Without both env vars the staff
// areas stay switched off.

const COOKIE = "mjz_staff"
export type Session = { role: "ops"; exp: number } | { role: "pro"; proId: string; exp: number }

export const staffEnabled = () => Boolean(process.env.SESSION_SECRET && process.env.OPS_PASSCODE)

function sig(data: string) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET!).update(data).digest("base64url")
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export async function setSession(s: { role: "ops" } | { role: "pro"; proId: string }, maxAgeSec: number) {
  const payload = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + maxAgeSec * 1000 })).toString("base64url")
  const jar = await cookies()
  jar.set(COOKIE, `${payload}.${sig(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: maxAgeSec })
}

export async function clearSession() {
  ;(await cookies()).delete(COOKIE)
}

export async function getSession(): Promise<Session | null> {
  if (!staffEnabled()) return null
  const raw = (await cookies()).get(COOKIE)?.value
  if (!raw) return null
  const [payload, mac] = raw.split(".")
  if (!payload || !mac || !safeEqual(mac, sig(payload))) return null
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session
    return s.exp > Date.now() ? s : null
  } catch {
    return null
  }
}

export class AuthError extends Error {}

export async function requireOps() {
  const s = await getSession()
  if (!s || s.role !== "ops") throw new AuthError("ops")
  return s
}

export async function requirePro() {
  const s = await getSession()
  if (!s || s.role !== "pro") throw new AuthError("pro")
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
