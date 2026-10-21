import "server-only"
import type { Db } from "./db"
import { normalisePhone } from "./phone"

// The automation engine's storage (lib/server/automation.ts runs it): the rules and their settings,
// the outbox's events, the messages it queues and sends (`notifications`), numbers that replied
// STOP, the phone apps' push tokens, and one-off markers. Claiming uses `for update skip locked`,
// so two workers running at once never take the same event or message.

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export type RuleRow = { key: string; enabled: boolean; config: Record<string, unknown>; updatedBy: string | null; updatedAt: string | null }

export async function ruleRows(db: Db): Promise<Map<string, RuleRow>> {
  const rows = await db.query<{ key: string; enabled: boolean; config: Record<string, unknown>; updated_by: string | null; updated_at: string }>("select * from automation_rules")
  return new Map(rows.map((r) => [r.key, { key: r.key, enabled: r.enabled, config: r.config ?? {}, updatedBy: r.updated_by, updatedAt: r.updated_at }]))
}

/** Saves a rule's switch and settings (merged into what's there). */
export async function saveRule(db: Db, key: string, p: { enabled: boolean; config?: Record<string, unknown> }, by: string) {
  await db.query(
    `insert into automation_rules (key, enabled, config, updated_by, updated_at) values ($1, $2, $3::jsonb, $4, now())
     on conflict (key) do update set enabled = excluded.enabled, config = automation_rules.config || excluded.config, updated_by = excluded.updated_by, updated_at = now()`,
    [key, p.enabled, JSON.stringify(p.config ?? {}), by],
  )
}

// ---------------------------------------------------------------------------
// The outbox's events
// ---------------------------------------------------------------------------

export type OutboxEvent = { id: number; at: string; type: string; bookingId: string | null; proId: string | null; customerId: string | null; data: Record<string, unknown>; attempts: number }

/** Takes the next unprocessed events (each is tried up to 5 times). */
export async function claimEvents(db: Db, limit = 100): Promise<OutboxEvent[]> {
  return db.tx(async (t) => {
    const rows = await t.query<{ id: number; at: string; type: string; booking_id: string | null; pro_id: string | null; customer_id: string | null; data: Record<string, unknown>; attempts: number }>(
      `update events set attempts = attempts + 1 where id in (
         select id from events where processed_at is null and attempts < 5 order by id limit $1 for update skip locked
       ) returning *`,
      [limit],
    )
    return rows.sort((a, b) => a.id - b.id).map((r) => ({ id: r.id, at: r.at, type: r.type, bookingId: r.booking_id, proId: r.pro_id, customerId: r.customer_id, data: r.data ?? {}, attempts: r.attempts }))
  })
}

/** Done with an event; with `error`, it's left for another try (until its attempts run out). */
export async function finishEvent(db: Db, id: number, error?: string) {
  if (error) await db.query("update events set error = $2 where id = $1", [id, error.slice(0, 500)])
  else await db.query("update events set processed_at = now(), error = null where id = $1", [id])
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type Channel = "whatsapp" | "email" | "push" | "log"
export type NewMessage = {
  rule: string
  dedupeKey: string
  channel: Channel
  recipient: string
  template: string
  subject?: string
  body: string
  params?: string[]
  lang?: string
  bookingId?: string | null
  customerId?: string | null
  proId?: string | null
  eventId?: number | null
}

/** Queues a message once per reason (`dedupeKey`): the id, or null when it was already queued. */
export async function queueMessage(db: Db, m: NewMessage): Promise<number | null> {
  const r = await db.one<{ id: number }>(
    `insert into notifications (rule, dedupe_key, channel, recipient, template, subject, body, params, lang, booking_id, customer_id, pro_id, event_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
     on conflict (dedupe_key) where dedupe_key is not null do nothing returning id`,
    [m.rule, m.dedupeKey, m.channel, m.recipient, m.template, m.subject ?? null, m.body, JSON.stringify(m.params ?? []), m.lang ?? "en", m.bookingId ?? null, m.customerId ?? null, m.proId ?? null, m.eventId ?? null],
  )
  return r?.id ?? null
}

export type Message = NewMessage & { id: number; status: string; attempts: number; error: string | null; createdAt: string; sentAt: string | null }
type MessageRow = { id: number; rule: string | null; dedupe_key: string | null; channel: Channel; recipient: string; template: string; subject: string | null; body: string; params: string[] | null; lang: string; booking_id: string | null; customer_id: string | null; pro_id: string | null; event_id: number | null; status: string; attempts: number; error: string | null; created_at: string; sent_at: string | null }
const toMessage = (r: MessageRow): Message => ({ id: r.id, rule: r.rule ?? "", dedupeKey: r.dedupe_key ?? "", channel: r.channel, recipient: r.recipient, template: r.template, subject: r.subject ?? undefined, body: r.body, params: r.params ?? [], lang: r.lang, bookingId: r.booking_id, customerId: r.customer_id, proId: r.pro_id, eventId: r.event_id, status: r.status, attempts: r.attempts, error: r.error, createdAt: r.created_at, sentAt: r.sent_at })

/** Takes the next queued messages to send; ones stuck "sending" for 10 minutes go back to the queue. */
export async function claimMessages(db: Db, limit = 25): Promise<Message[]> {
  await db.query("update notifications set status = case when attempts >= 3 then 'failed' else 'queued' end, error = coalesce(error, 'Stopped while sending') where status = 'sending' and created_at < now() - interval '10 minutes'")
  return db.tx(async (t) => {
    const rows = await t.query<MessageRow>(
      `update notifications set status = 'sending', attempts = attempts + 1 where id in (
         select id from notifications where status = 'queued' order by id limit $1 for update skip locked
       ) returning *`,
      [limit],
    )
    return rows.sort((a, b) => a.id - b.id).map(toMessage)
  })
}

/** How sending went. A failed message goes back to the queue until it has had 3 tries. */
export async function finishMessage(db: Db, id: number, r: { status: "sent" | "logged" | "skipped" | "failed"; error?: string; providerId?: string }) {
  if (r.status === "failed") {
    await db.query("update notifications set status = case when attempts >= 3 then 'failed' else 'queued' end, error = $2 where id = $1", [id, r.error?.slice(0, 500) ?? "Failed"])
    return
  }
  await db.query("update notifications set status = $2, error = $3, provider_id = $4, sent_at = case when $2 in ('sent', 'logged') then now() else sent_at end where id = $1", [id, r.status, r.error?.slice(0, 500) ?? null, r.providerId ?? null])
}

export async function listMessages(db: Db, f: { status?: string; rule?: string; limit?: number } = {}): Promise<Message[]> {
  const where: string[] = []
  const vals: unknown[] = []
  if (f.status) {
    vals.push(f.status)
    where.push(`status = $${vals.length}`)
  }
  if (f.rule) {
    vals.push(f.rule)
    where.push(`rule = $${vals.length}`)
  }
  vals.push(Math.min(f.limit ?? 100, 500))
  return (await db.query<MessageRow>(`select * from notifications ${where.length ? `where ${where.join(" and ")}` : ""} order by id desc limit $${vals.length}`, vals)).map(toMessage)
}

/** How many messages of a rule went to someone since an ISO time (e.g. at most 2 reminders a month). */
export const sentSince = async (db: Db, rule: string, recipients: string[], since: string) =>
  (await db.one<{ n: number }>("select count(*)::int as n from notifications where rule = $1 and recipient = any($2::text[]) and created_at >= $3 and status <> 'skipped'", [rule, recipients, since]))!.n

// ---------------------------------------------------------------------------
// STOP replies, push tokens, markers
// ---------------------------------------------------------------------------

export async function optOut(db: Db, phone: string, via: string) {
  const p = normalisePhone(phone)
  await db.query("insert into message_optouts (phone, via) values ($1, $2) on conflict (phone) do nothing", [p, via])
  await db.query("update customers set marketing_ok = false, updated_at = now() where phone = $1", [p])
}

/** They switched messages back on (their account): an earlier STOP no longer applies. */
export const optIn = (db: Db, phone: string) => db.query("delete from message_optouts where phone = $1", [normalisePhone(phone)])

export const optedOut = async (db: Db, phone: string) => Boolean(await db.one("select 1 from message_optouts where phone = $1", [normalisePhone(phone)]))

export async function savePushToken(db: Db, t: { token: string; ownerType: "pro" | "customer"; ownerId: string; platform?: string }) {
  if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(t.token)) throw new Error("Not an Expo push token")
  await db.query(
    `insert into push_tokens (token, owner_type, owner_id, platform) values ($1, $2, $3, $4)
     on conflict (token) do update set owner_type = excluded.owner_type, owner_id = excluded.owner_id, platform = excluded.platform, last_seen = now()`,
    [t.token, t.ownerType, t.ownerId, t.platform ?? null],
  )
}

export const pushTokens = async (db: Db, ownerType: "pro" | "customer", ownerId: string) => (await db.query<{ token: string }>("select token from push_tokens where owner_type = $1 and owner_id = $2", [ownerType, ownerId])).map((r) => r.token)
export const dropPushToken = (db: Db, token: string) => db.query("delete from push_tokens where token = $1", [token])
export const pushTokenCount = async (db: Db) => (await db.one<{ n: number }>("select count(*)::int as n from push_tokens"))!.n

/** Sets a one-off marker; true when it wasn't set before (e.g. this week's payout run is drafted). */
export async function markOnce(db: Db, key: string, value: Record<string, unknown> = {}) {
  return Boolean(await db.one("insert into core_meta (key, value) values ($1, $2::jsonb) on conflict (key) do nothing returning key", [key, JSON.stringify(value)]))
}
