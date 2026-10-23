import "server-only"
import type { Db } from "./db"
import { writeAudit } from "./audit"
import { InputError } from "./errors"
import { ACC } from "./ledger"
import { DEFAULT_PILOT, type PilotSettings } from "@/lib/ops/pilot"

// What the pilot gates need besides the jobs (lib/ops/pilot.ts): the founder's inputs, kept as one
// row in core_meta ("pilot"): the start date, the sales tax assumptions and each month's ad and
// transport spend. Finance or an Owner enters them; every change is in the audit log. And Mjazo's
// net on each completed visit, straight from the ledger.

const KEY = "pilot"

export async function pilotSettings(db: Db): Promise<PilotSettings> {
  const r = await db.one<{ value: Partial<PilotSettings> }>("select value from core_meta where key = $1", [KEY])
  return { ...DEFAULT_PILOT, ...(r?.value ?? {}), months: { ...(r?.value?.months ?? {}) } }
}

async function update(db: Db, actor: string, action: string, detail: string, change: (s: PilotSettings) => void) {
  return db.tx(async (t) => {
    await t.query("insert into core_meta (key, value) values ($1, $2::jsonb) on conflict (key) do nothing", [KEY, JSON.stringify(DEFAULT_PILOT)])
    const row = await t.one<{ value: Partial<PilotSettings> }>("select value from core_meta where key = $1 for update", [KEY])
    const s: PilotSettings = { ...DEFAULT_PILOT, ...(row?.value ?? {}), months: { ...(row?.value?.months ?? {}) } }
    change(s)
    await t.query("update core_meta set value = $2::jsonb, at = now() where key = $1", [KEY, JSON.stringify(s)])
    await writeAudit(t, { actor, action, target: "pilot", detail })
    return s
  })
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** The start date and the sales tax assumptions. */
export async function savePilotSettings(db: Db, p: { startDate?: string | null; taxRate?: number; taxInclusive?: boolean; taxBase?: "total" | "commission" }, actor: string) {
  if (p.startDate && (!DATE.test(p.startDate) || Number.isNaN(Date.parse(p.startDate)))) throw new InputError("Pick a start date")
  if (p.taxRate !== undefined && !(p.taxRate >= 0 && p.taxRate <= 0.25)) throw new InputError("Sales tax must be between 0% and 25%")
  return update(db, actor, "changed the pilot settings", JSON.stringify(p), (s) => {
    if (p.startDate !== undefined) s.startDate = p.startDate || null
    if (p.taxRate !== undefined) s.taxRate = Math.round(p.taxRate * 1000) / 1000
    if (p.taxInclusive !== undefined) s.taxInclusive = p.taxInclusive
    if (p.taxBase !== undefined) s.taxBase = p.taxBase
  })
}

/** A month's ad and transport spend (whole rupees); `null` removes the month. */
export async function savePilotMonth(db: Db, month: string, v: { marketing: number; transport: number; note?: string } | null, actor: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new InputError("Pick a month")
  if (v && ![v.marketing, v.transport].every((n) => Number.isInteger(n) && n >= 0 && n <= 100_000_000)) throw new InputError("Enter amounts in whole rupees")
  return update(db, actor, v ? "entered the pilot spend" : "removed the pilot spend", v ? `${month}: ads ${v.marketing}, transport ${v.transport}` : month, (s) => {
    if (v) s.months[month] = { marketing: v.marketing, transport: v.transport, ...(v.note?.trim() ? { note: v.note.trim().slice(0, 200) } : {}), by: actor, at: new Date().toISOString() }
    else delete s.months[month]
  })
}

/** Mjazo's net on each completed visit, from its ledger entry: the commission less the discount Mjazo funded. */
export async function visitMargins(db: Db, bookingIds: string[]): Promise<Map<string, number>> {
  if (!bookingIds.length) return new Map()
  const rows = await db.query<{ booking_id: string; account_id: string; amount: number }>(
    `select e.booking_id, p.account_id, sum(p.amount)::int as amount from journal_entries e join postings p on p.entry_id = e.id
     where e.kind = 'visit_completed' and e.booking_id = any($1::text[]) and p.account_id in ($2, $3) group by e.booking_id, p.account_id`,
    [bookingIds, ACC.commission, ACC.discounts],
  )
  const out = new Map<string, number>()
  // The commission is a credit (negative) and adds to the net; a discount is a debit (positive)
  // and takes from it: both are the posting's amount with its sign flipped.
  for (const r of rows) out.set(r.booking_id, (out.get(r.booking_id) ?? 0) - r.amount)
  return out
}
