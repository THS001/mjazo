import "server-only"
import crypto from "crypto"
import type { Db } from "./db"
import { InputError } from "./errors"
import { coreId, normalisePhone } from "./phone"

// Phone-number sign-in codes (migration 0012). A customer asks for a code for their number; it goes
// by WhatsApp or SMS (lib/server/phone-sign-in.ts sends it), lives 10 minutes, takes 5 tries and
// works once. Asking again stops the earlier code. The limits are kept in the database, so they
// hold across servers: a new code at most every 30 seconds, 5 an hour and 10 a day for a number,
// 20 an hour from one internet address, and 300 an hour for the whole site (so nobody can run up
// the SMS bill from many addresses). Only the code's hash is stored, and rows older than two days
// are cleared. For SMS, Twilio Verify makes and checks the code itself; this table still keeps the
// limits and the tries.

export const CODE_MINUTES = 10
export const RESEND_SECONDS = 30
const TRIES = 5
const PER_HOUR = 5
const PER_DAY = 10
const PER_IP_HOUR = 20
const PER_SITE_HOUR = 300

export const PK_MOBILE = /^03\d{9}$/

export type Channel = "whatsapp" | "sms" | "test"

export class CodeError extends InputError {
  constructor(
    message: string,
    readonly code: "phone" | "wait" | "limit" | "wrong" | "expired" | "tries" | "send" | "off",
    readonly retryIn?: number,
  ) {
    super(message)
  }
}

const hashCode = (id: string, phone: string, code: string) => crypto.createHash("sha256").update(`${id}:${phone}:${code}`).digest("base64url")
const hashIp = (ip: string) => crypto.createHash("sha256").update(`mjazo-ip:${ip}`).digest("base64url").slice(0, 22)
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

/** Whether migration 0012 has run (remembered once it has). Until then phone sign-in is off. */
let ready = false
export async function codesReady(db: Db) {
  if (ready) return true
  ready = Boolean((await db.one<{ ok: boolean }>("select to_regclass('public.phone_codes') is not null as ok"))?.ok)
  return ready
}

/** The number as 03xxxxxxxxx, or a CodeError for anything but a Pakistani mobile number. */
export function mobileNumber(raw: string) {
  const phone = normalisePhone(raw)
  if (!PK_MOBILE.test(phone)) throw new CodeError("Enter a Pakistani mobile number (03xx xxxxxxx)", "phone")
  return phone
}

/** A new code for the number (its earlier codes stop working). `code` is null for SMS: Twilio Verify makes it. */
export async function newCode(db: Db, p: { phone: string; channel: Channel; ip?: string | null; now?: Date }) {
  const phone = mobileNumber(p.phone)
  const now = p.now ?? new Date()
  const ipHash = p.ip ? hashIp(p.ip) : null
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  return db.tx(async (t) => {
    // One request per number at a time, so two can't both slip under the limits.
    await t.query("select pg_advisory_xact_lock(hashtext($1))", [`phone-code:${phone}`])
    const recent = await t.query<{ created_at: string }>("select created_at from phone_codes where phone = $1 and created_at > $2 order by created_at desc", [phone, ago(86400_000)])
    const wait = recent[0] ? Math.ceil((new Date(recent[0].created_at).getTime() + RESEND_SECONDS * 1000 - now.getTime()) / 1000) : 0
    if (wait > 0) throw new CodeError(`Wait ${wait} seconds before asking for another code.`, "wait", wait)
    const lastHour = recent.filter((r) => new Date(r.created_at).getTime() > now.getTime() - 3600_000).length
    if (lastHour >= PER_HOUR || recent.length >= PER_DAY) throw new CodeError("Too many codes for this number. Try again later, or message us on WhatsApp.", "limit")
    if (ipHash) {
      const fromIp = (await t.one<{ n: number }>("select count(*)::int as n from phone_codes where ip_hash = $1 and created_at > $2", [ipHash, ago(3600_000)]))!.n
      if (fromIp >= PER_IP_HOUR) throw new CodeError("Too many codes asked for from here. Try again in an hour.", "limit")
    }
    const sitewide = (await t.one<{ n: number }>("select count(*)::int as n from phone_codes where created_at > $1", [ago(3600_000)]))!.n
    if (sitewide >= PER_SITE_HOUR) throw new CodeError("Sign-in codes are paused for a little while. Try again soon, or use your email.", "limit")
    await t.query("delete from phone_codes where created_at < $1", [ago(2 * 86400_000)])
    await t.query("update phone_codes set expires_at = $2 where phone = $1 and used_at is null and expires_at > $2", [phone, now.toISOString()])
    const id = coreId("PC")
    const code = p.channel === "sms" ? null : String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")
    await t.query("insert into phone_codes (id, phone, channel, code_hash, ip_hash, created_at, expires_at) values ($1, $2, $3, $4, $5, $6, $7)", [
      id,
      phone,
      p.channel,
      code ? hashCode(id, phone, code) : null,
      ipHash,
      now.toISOString(),
      new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(),
    ])
    return { id, phone, code }
  })
}

/** Takes back a code that couldn't be sent (it doesn't count towards the number's limits). */
export async function dropCode(db: Db, id: string) {
  await db.query("delete from phone_codes where id = $1", [id])
}

/**
 * Checks a code typed for the number against its latest code; `external` checks an SMS code with
 * Twilio Verify. Right: the code is used up and the number comes back. Wrong: one try fewer.
 */
export async function useCode(db: Db, p: { phone: string; code: string; now?: Date; external?: (phone: string, code: string) => Promise<boolean> }) {
  const phone = mobileNumber(p.phone)
  const code = p.code.replace(/\D/g, "")
  const now = p.now ?? new Date()
  const row = await db.one<{ id: string; channel: Channel; code_hash: string | null; expires_at: string }>("select id, channel, code_hash, expires_at from phone_codes where phone = $1 and used_at is null order by created_at desc limit 1", [phone])
  if (!row || new Date(row.expires_at) <= now) throw new CodeError("This code has expired. Ask for a new one.", "expired")
  // The try is counted before the code is checked, so tries sent together can't pass the limit.
  const tried = await db.one<{ attempts: number }>("update phone_codes set attempts = attempts + 1 where id = $1 and used_at is null and attempts < $2 returning attempts", [row.id, TRIES])
  if (!tried) throw new CodeError("Too many wrong codes. Ask for a new one.", "tries")
  const right = code.length === 6 && (row.channel === "sms" ? Boolean(await p.external?.(phone, code)) : same(row.code_hash ?? "", hashCode(row.id, phone, code)))
  if (!right) throw tried.attempts >= TRIES ? new CodeError("Too many wrong codes. Ask for a new one.", "tries") : new CodeError("That code isn't right. Check it and try again.", "wrong")
  if (!(await db.one("update phone_codes set used_at = $2 where id = $1 and used_at is null returning id", [row.id, now.toISOString()]))) throw new CodeError("This code has expired. Ask for a new one.", "expired")
  return phone
}
