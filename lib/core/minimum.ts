import "server-only"
import type { Db } from "./db"
import { listPros } from "./jobs"
import { availabilityLogReady } from "./pros"
import { minimumWeek, openWindows, type HoursChange, type MinimumPolicy, type MinimumWeek } from "@/lib/ops/minimum"
import { WINDOW_LABELS } from "@/lib/time"

// Pros' weekly minimum (migration 0015) on the real records: what each pro earned in a week (the
// ledger), the windows she was open for (her weekly hours, less days off, as logged during the
// week by lib/core/pros.ts) and the offers she answered. The rules are in lib/ops/minimum.ts; the payout run tops up (lib/core/money.ts).

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)
/** Midnight in Karachi, as an ISO time. */
const karachiMidnight = (day: string) => new Date(`${day}T00:00:00+05:00`).toISOString()

/**
 * Whether migration 0015 has run. Until it has, the minimum is simply off and payout runs work as
 * before. Remembered once it's there.
 */
let ready = false
export async function minimumReady(db: Db) {
  if (ready) return true
  ready = Boolean(await db.one("select 1 from information_schema.columns where table_name = 'payouts' and column_name = 'top_up'"))
  return ready
}

/**
 * Each pro's week (from the Monday `weekStart`) against the minimum. Her open windows count the
 * fewest she had open on each day (her weekly hours now, and the logged changes since the week
 * began); her days off are the week's own, with any she took back once the day had begun.
 */
export async function minimumWeeks(db: Db, p: MinimumPolicy, weekStart: string, o: { proIds?: string[] } = {}): Promise<Map<string, MinimumWeek>> {
  const from = karachiMidnight(weekStart)
  const to = karachiMidnight(addDays(weekStart, 7))
  const pros = (await listPros(db)).filter((x) => !o.proIds || o.proIds.includes(x.id))
  // Every change from the week's start on (a later one tells what she had as a day of this week began).
  const log = (await availabilityLogReady(db))
    ? await db.query<{ pro_id: string; at: string; kind: "hours" | "day_off_undone"; hours_before: HoursChange["before"]; hours_after: HoursChange["after"]; day: string | null }>(
        "select pro_id, at, kind, hours_before, hours_after, day from pro_availability_log where at >= $1 order by at, id",
        [from],
      )
    : []
  const earned = await db.query<{ account_id: string; n: number }>(
    `select p.account_id, (-sum(p.amount))::int as n from postings p join journal_entries e on e.id = p.entry_id
     where e.kind = 'visit_completed' and e.at >= $1 and e.at < $2 and p.account_id like 'pro:%:payable' group by p.account_id`,
    [from, to],
  )
  const earnedBy = new Map(earned.map((r) => [r.account_id.split(":")[1], r.n]))
  const off = await db.query<{ pro_id: string; day: string }>("select pro_id, day from pro_time_off where day >= $1 and day <= $2", [weekStart, addDays(weekStart, 6)])
  const offers = await db.query<{ pro_id: string; status: string; n: number }>(
    "select pro_id, status, count(*)::int as n from job_offers where offered_at >= $1 and offered_at < $2 and status in ('accepted', 'declined', 'expired') group by pro_id, status",
    [from, to],
  )
  const out = new Map<string, MinimumWeek>()
  const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)))
  for (const pro of pros) {
    const mine = offers.filter((x) => x.pro_id === pro.id)
    const changes = log.filter((x) => x.pro_id === pro.id)
    const daysOff = [...off.filter((x) => x.pro_id === pro.id).map((x) => x.day), ...changes.filter((x) => x.kind === "day_off_undone" && x.day && week.has(x.day)).map((x) => x.day!)]
    const hours = changes.filter((x) => x.kind === "hours").map((x) => ({ at: x.at, before: x.hours_before, after: x.hours_after }))
    out.set(
      pro.id,
      minimumWeek(p, {
        pro,
        weekStart,
        earned: earnedBy.get(pro.id) ?? 0,
        windows: openWindows(pro, weekStart, daysOff, WINDOW_LABELS.length, hours),
        offersMade: mine.reduce((s, x) => s + x.n, 0),
        offersAccepted: mine.find((x) => x.status === "accepted")?.n ?? 0,
      }),
    )
  }
  return out
}

/** What each pro is topped up for the week (only those who are owed one, and not topped up for it already). */
export async function minimumTopUps(db: Db, p: MinimumPolicy, weekStart: string): Promise<Map<string, number>> {
  if (!p.on || p.amount <= 0 || !(await minimumReady(db))) return new Map()
  const done = new Set((await db.query<{ pro_id: string }>("select pro_id from journal_entries where kind = 'minimum_topup' and idempotency_key like $1", [`minimum:%:${weekStart}`])).map((r) => r.pro_id))
  const weeks = await minimumWeeks(db, p, weekStart)
  return new Map([...weeks].filter(([id, w]) => w.topUp > 0 && !done.has(id)).map(([id, w]) => [id, w.topUp]))
}
