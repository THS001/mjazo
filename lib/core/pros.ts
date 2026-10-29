import "server-only"
import type { Db } from "./db"
import { InputError } from "./errors"
import { VERIFICATION_ITEMS, type VerificationItem, type VerificationKey } from "@/lib/ops/types"
import { karachiNow, WINDOW_LABELS } from "@/lib/time"

// A pro's profile beyond the basics (lib/core/jobs.ts savePro): the areas she covers, her daily
// cap, commission, weekly windows, days off and the verification checklist; and the zones (the
// catalogue's areas) with their daily caps. Route Brain and checkout capacity respect all of it.

export type ProProfilePatch = {
  zones?: string[]
  dailyCap?: number
  commissionRate?: number
  /** Weekday ("0" = Sunday) → windows. null clears it (she works every window, every day). */
  availability?: Record<string, string[]> | null
  timeOff?: { add?: string[]; remove?: string[] }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** What's wrong with a profile change, if anything (`areas`: the catalogue's area slugs). */
export function profileIssues(p: ProProfilePatch, areas: string[]): string[] {
  const issues: string[] = []
  if (p.zones?.some((z) => !areas.includes(z))) issues.push("Pick areas from the list")
  if (p.dailyCap !== undefined && (!Number.isInteger(p.dailyCap) || p.dailyCap < 1 || p.dailyCap > 12)) issues.push("A daily cap is 1 to 12 visits")
  if (p.commissionRate !== undefined && (!(p.commissionRate >= 0 && p.commissionRate <= 0.5) || Math.round(p.commissionRate * 10000) !== p.commissionRate * 10000)) issues.push("Commission is between 0% and 50%")
  if (p.availability) {
    for (const [day, windows] of Object.entries(p.availability)) {
      if (!/^[0-6]$/.test(day)) issues.push("Weekdays are 0 (Sunday) to 6")
      if (windows.some((w) => !WINDOW_LABELS.includes(w))) issues.push("Pick arrival windows from the list")
    }
  }
  for (const d of [...(p.timeOff?.add ?? []), ...(p.timeOff?.remove ?? [])]) if (!DAY.test(d)) issues.push("Days off are dates (YYYY-MM-DD)")
  return [...new Set(issues)]
}

export async function setProProfile(db: Db, proId: string, p: ProProfilePatch, areas: string[]) {
  const issues = profileIssues(p, areas)
  if (issues.length) throw new InputError(issues.join(". "))
  await db.tx(async (t) => {
    if (!(await t.one("select 1 from pros where id = $1 for update", [proId]))) throw new InputError("Pro not found")
    const sets: string[] = []
    const vals: unknown[] = [proId]
    const set = (col: string, v: unknown) => {
      vals.push(v)
      sets.push(`${col} = $${vals.length}`)
    }
    if (p.zones) set("zones", [...new Set(p.zones)])
    if (p.dailyCap !== undefined) set("daily_cap", p.dailyCap)
    if (p.commissionRate !== undefined) set("commission_rate", p.commissionRate)
    if (sets.length) await t.query(`update pros set ${sets.join(", ")}, updated_at = now() where id = $1`, vals)
    // Pros' weekly minimum counts what she had open during the week (migration 0015 keeps the log).
    const log = await availabilityLogReady(t)
    if (p.availability !== undefined) {
      const before = log ? await hoursOf(t, proId) : null
      await t.query("delete from pro_availability where pro_id = $1", [proId])
      for (const [day, windows] of Object.entries(p.availability ?? {})) {
        const ordered = WINDOW_LABELS.filter((w) => windows.includes(w))
        await t.query("insert into pro_availability (pro_id, weekday, windows) values ($1, $2, $3)", [proId, Number(day), ordered])
      }
      const after = log ? await hoursOf(t, proId) : null
      if (log && JSON.stringify(before) !== JSON.stringify(after))
        await t.query("insert into pro_availability_log (pro_id, kind, hours_before, hours_after) values ($1, 'hours', $2::jsonb, $3::jsonb)", [proId, JSON.stringify(before), JSON.stringify(after)])
    }
    for (const d of p.timeOff?.add ?? []) await t.query("insert into pro_time_off (pro_id, day) values ($1, $2) on conflict do nothing", [proId, d])
    const today = karachiNow().date
    for (const d of p.timeOff?.remove ?? []) {
      const gone = await t.one("delete from pro_time_off where pro_id = $1 and day = $2 returning day", [proId, d])
      // Taken back once the day had begun: it still counts as off for the minimum.
      if (gone && log && d <= today) await t.query("insert into pro_availability_log (pro_id, kind, day) values ($1, 'day_off_undone', $2)", [proId, d])
    }
  })
}

/** Her weekly hours as stored (null: none set, so every window, every day). Weekdays in order. */
async function hoursOf(db: Db, proId: string): Promise<Record<string, string[]> | null> {
  const rows = await db.query<{ weekday: number; windows: string[] }>("select weekday, windows from pro_availability where pro_id = $1 order by weekday", [proId])
  return rows.length ? Object.fromEntries(rows.map((r) => [String(r.weekday), r.windows])) : null
}

/** Whether migration 0015 (the availability log) has run. Remembered once it has. */
let logReady = false
export async function availabilityLogReady(db: Db) {
  if (logReady) return true
  logReady = Boolean(await db.one("select 1 from information_schema.tables where table_name = 'pro_availability_log'"))
  return logReady
}

/**
 * The pro behind an email sign-in (a Supabase account): the one linked to that account, or else the
 * one with that email, which is then linked to it. Null when no pro has that email.
 */
export async function proForSignIn(db: Db, a: { userId: string; email: string }): Promise<string | null> {
  const linked = await db.one<{ id: string }>("select id from pros where auth_user_id = $1", [a.userId])
  if (linked) return linked.id
  const byEmail = await db.one<{ id: string; auth_user_id: string | null }>("select id, auth_user_id from pros where lower(email) = lower($1)", [a.email.trim()])
  if (!byEmail) return null
  // An email moved to another pro keeps pointing at the pro who now has it.
  if (byEmail.auth_user_id !== a.userId) await db.query("update pros set auth_user_id = $2, updated_at = now() where id = $1", [byEmail.id, a.userId])
  return byEmail.id
}

/** Digits that look like a CNIC (13 digits, with or without dashes) or any long number. */
const LONG_NUMBER = /\d[\d\s-]{7,}\d/

/**
 * Ticks (or unticks) one checklist item, recording who and when. The CNIC item keeps only its
 * last 4 digits; a full CNIC (or any long number in a note) is refused, never stored.
 */
export async function setVerification(db: Db, proId: string, key: VerificationKey, v: { done: boolean; last4?: string; note?: string }, actor: string): Promise<VerificationItem | null> {
  if (!VERIFICATION_ITEMS.some((i) => i.key === key)) throw new InputError("Unknown checklist item")
  const note = v.note?.trim().slice(0, 200) || undefined
  if (note && LONG_NUMBER.test(note)) throw new InputError("Don't type ID or phone numbers in the note: only the last 4 digits of the CNIC are kept")
  if (!v.done) {
    const r = await db.one("update pros set verification = verification - $2, updated_at = now() where id = $1 returning id", [proId, key])
    if (!r) throw new InputError("Pro not found")
    return null
  }
  const item: VerificationItem = { by: actor, at: new Date().toISOString() }
  if (key === "cnic") {
    const last4 = (v.last4 ?? "").trim()
    if (!/^\d{4}$/.test(last4)) throw new InputError("Enter only the CNIC's last 4 digits (never the full number)")
    item.last4 = last4
  } else if (v.last4) throw new InputError("Only the CNIC item takes digits")
  if (note) item.note = note
  const r = await db.one("update pros set verification = verification || $2::jsonb, updated_at = now() where id = $1 returning id", [proId, JSON.stringify({ [key]: item })])
  if (!r) throw new InputError("Pro not found")
  return item
}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

export type Zone = { slug: string; name: string; dailyCap: number | null }

/** Keeps the zones table in step with the catalogue's areas (names follow the CMS). */
export async function ensureZones(db: Db, areas: { slug: string; name: string }[]) {
  for (const a of areas) await db.query("insert into zones (slug, name) values ($1, $2) on conflict (slug) do update set name = excluded.name where zones.name <> excluded.name", [a.slug, a.name])
}

export const listZones = async (db: Db): Promise<Zone[]> => (await db.query<{ slug: string; name: string; daily_cap: number | null }>("select slug, name, daily_cap from zones order by name")).map((z) => ({ slug: z.slug, name: z.name, dailyCap: z.daily_cap }))

export async function setZoneCap(db: Db, slug: string, cap: number | null) {
  if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 500)) throw new InputError("A zone cap is 1 to 500 visits a day (or no cap)")
  const r = await db.one("update zones set daily_cap = $2, updated_at = now() where slug = $1 returning slug", [slug, cap])
  if (!r) throw new InputError("Zone not found")
}

/** Zone caps for Route Brain and checkout capacity (zones without a cap are left out). */
export async function zoneCaps(db: Db): Promise<Record<string, number>> {
  const rows = await db.query<{ slug: string; daily_cap: number }>("select slug, daily_cap from zones where daily_cap is not null")
  return Object.fromEntries(rows.map((r) => [r.slug, r.daily_cap]))
}
