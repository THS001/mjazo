import "server-only"
import { after } from "next/server"
import { formatAmount, formatPKR } from "@/lib/catalog"
import { getCatalog, getMessages, getSettings } from "@/lib/cms/read"
import { MESSAGES, type MessageKey, type MessageTexts } from "@/lib/cms/types/messages"
import { core, type Db } from "@/lib/core/db"
import * as store from "@/lib/core/automation"
import * as cj from "@/lib/core/jobs"
import { InputError } from "@/lib/core/errors"
import { rewardReferral } from "@/lib/core/growth"
import { draftPayoutRun } from "@/lib/core/money"
import { listOffers, offerJob } from "@/lib/core/offers"
import { pairRates } from "@/lib/core/pairs"
import { issueCredit } from "@/lib/core/ledger"
import { policy } from "@/lib/core/policy"
import { ratingsByPro } from "@/lib/core/pro-history"
import { packsDue } from "@/lib/core/packs"
import { ensureReceipt } from "@/lib/core/receipts"
import { normalisePhone } from "@/lib/core/phone"
import { rankPros } from "@/lib/ops/match"
import type { Job, Pro } from "@/lib/ops/types"
import { SITE_URL } from "@/lib/site"
import { formatBookingDate, karachiNow, WINDOW_HOURS, WINDOW_LABELS, windowLabel } from "@/lib/time"
import { visitEarning } from "./pro-api"
import { receiptUrl } from "./receipts"
import { listSubmissions, notifyOps } from "./store"

// Automation (platform stage 5). The outbox (`events`, written with every change in lib/core) is
// worked through here: booking messages to customers, visits offered to pros (auto-assign), and,
// on a timer, the day-before reminder, "rate your visit", the weekly payout run and the opt-in
// nudges. Every message is kept in `notifications`; until a WhatsApp, email or push provider is
// set, messages are only logged ("test mode"). Each rule is switched on or off in mission control
// → Automations. People still approve every payout and every money move.
//
// Runs: right after a change (kickAutomation, best effort), every 5 minutes from the external
// pinger (/api/cron/automation), once a day from Vercel's cron, and from mission control's
// "Run now". Everything it does is safe to repeat (one message per reason, one run a week).

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

export type RuleKey = "confirm" | "reminder" | "onTheWay" | "rateVisit" | "receipt" | "favouriteBusy" | "noProCredit" | "autoAssign" | "proOffer" | "weeklyPayout" | "pulseNudges" | "winBack" | "referralReward" | "plusWelcome" | "packWelcome" | "packDue"
export type AssignMode = "off" | "suggest" | "auto"

type RuleDef = {
  key: RuleKey
  label: string
  description: string
  on: boolean // switched on until someone changes it
  messages?: MessageKey[]
  /** WhatsApp template parameters, in order (the template's {{1}}, {{2}}, …). */
  params?: Partial<Record<MessageKey, string[]>>
  marketing?: boolean // opt-in only, quiet hours, "Reply STOP"
}

export const RULES: RuleDef[] = [
  { key: "confirm", label: "Booking confirmed", description: "As soon as a booking is made.", on: true, messages: ["bookingConfirmed"], params: { bookingConfirmed: ["name", "services", "date", "window", "id", "link"] } },
  { key: "reminder", label: "Reminder, the day before", description: "From 6 pm the evening before the visit.", on: true, messages: ["reminder"], params: { reminder: ["name", "date", "window", "services", "link"] } },
  { key: "onTheWay", label: "Your pro is on the way", description: "When the pro taps \"On my way\".", on: true, messages: ["onTheWay"], params: { onTheWay: ["pro", "services", "arrive", "id"] } },
  { key: "rateVisit", label: "Rate your visit (review request)", description: "Two hours after the visit, between 10 am and 8 pm, if it isn't rated yet.", on: true, messages: ["rateVisit"], params: { rateVisit: ["name", "pro", "link"] } },
  { key: "receipt", label: "Your receipt", description: "When a visit is done: its receipt number, the total and a link to the receipt (it opens without signing in).", on: true, messages: ["receipt"], params: { receipt: ["name", "no", "amount", "link"] } },
  { key: "favouriteBusy", label: "Your pro can't make it", description: "When a visit booked with a pro the customer asked for goes to another pro: who's coming, her rating (or that she's new), and a link to move the visit to keep their own pro.", on: true, messages: ["favouriteBusy"], params: { favouriteBusy: ["name", "asked", "pro", "rating", "date", "window", "link"] } },
  { key: "noProCredit", label: "Nobody could come (credit)", description: "When ops cancel a visit no pro took and tick \"Nobody could come\", or its window started half an hour ago without a pro: the favourite-pro guarantee's credit (Money → Policies, when it's switched on) and this message; ops are told. Any other cancellation gets nothing.", on: true, messages: ["noProCredit"], params: { noProCredit: ["name", "date", "window", "amount", "link"] } },
  { key: "autoAssign", label: "Auto-assign", description: "Off; suggest the best pro on the board; or offer the visit to the best pro by itself (then the next if she declines). Only verified pros are offered automatically. Ops can always assign or offer by hand.", on: true },
  { key: "proOffer", label: "Tell a pro about an offer", description: "When a visit is offered to a pro: a push to the Mjazo Pro app, or WhatsApp.", on: true, messages: ["proOffer"], params: { proOffer: ["services", "area", "date", "window", "earn", "until", "link"] } },
  { key: "weeklyPayout", label: "Weekly payout run", description: "Every Monday from 9 am: a draft payout run for last week (Monday to Sunday). Finance approves it and marks each payout paid.", on: true },
  { key: "referralReward", label: "Referral credit message", description: "When a friend's first visit with someone's code is done, that customer gets their credit (always) and this message (when on).", on: true, messages: ["referralReward"], params: { referralReward: ["name", "friend", "amount", "link"] } },
  { key: "plusWelcome", label: "Welcome to Mjazo Plus", description: "When ops activate a Plus membership.", on: true, messages: ["plusWelcome"], params: { plusWelcome: ["name", "until", "pct", "link"] } },
  { key: "packWelcome", label: "Your pack is ready", description: "When ops activate a pack (prepaid visits).", on: true, messages: ["packWelcome"], params: { packWelcome: ["name", "pack", "visits", "until", "link"] } },
  { key: "packDue", label: "Time for your next pack visit", description: "To customers with a pack, when its next visit falls due (two days ahead) and none is booked: once per visit, 10 am to 8 pm, never after STOP.", on: true, messages: ["packDue"], params: { packDue: ["name", "pack", "left", "link"] } },
  { key: "pulseNudges", label: "Home Pulse reminders (opt-in)", description: "To customers who asked for Home Pulse reminders: what's due in the next 2 days. At most 2 a month, 10 am to 8 pm, never after STOP.", on: false, marketing: true, messages: ["pulseNudge"], params: { pulseNudge: ["name", "title", "date", "link"] } },
  { key: "winBack", label: "Win-back after 60 and 90 days (opt-in)", description: "To signed-in customers who said yes to messages, 60 and 90 days after their last visit if they haven't booked since. 10 am to 8 pm, never after STOP.", on: false, marketing: true, messages: ["winBack60", "winBack90"], params: { winBack60: ["name", "link"], winBack90: ["name", "link"] } },
]

export type Rule = RuleDef & { enabled: boolean; config: { waTemplates?: Partial<Record<MessageKey, string>>; mode?: AssignMode }; updatedBy: string | null; updatedAt: string | null }

export async function loadRules(db: Db): Promise<Record<RuleKey, Rule>> {
  const rows = await store.ruleRows(db)
  return Object.fromEntries(
    RULES.map((d) => {
      const r = rows.get(d.key)
      const config = (r?.config ?? {}) as Rule["config"]
      return [d.key, { ...d, enabled: r ? r.enabled : d.on, config: d.key === "autoAssign" ? { mode: "suggest", ...config } : config, updatedBy: r?.updatedBy ?? null, updatedAt: r?.updatedAt ?? null }]
    }),
  ) as Record<RuleKey, Rule>
}

export const assignMode = (rules: Record<RuleKey, Rule>): AssignMode => (rules.autoAssign.enabled ? (rules.autoAssign.config.mode ?? "suggest") : "off")

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0"}`
export const channels = () => ({
  whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  email: Boolean(process.env.RESEND_API_KEY && (process.env.MESSAGES_FROM || process.env.OPS_FROM)),
})
/** No provider set: messages are only written to the log. */
export const testMode = () => !channels().whatsapp && !channels().email

const waNumber = (phone: string) => `92${normalisePhone(phone).slice(1)}`

async function sendWhatsApp(m: store.Message) {
  const res = await fetch(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: waNumber(m.recipient),
      type: "template",
      template: { name: m.template, language: { code: m.lang === "ur" ? "ur" : "en" }, components: [{ type: "body", parameters: (m.params ?? []).map((text) => ({ type: "text", text: text || "-" })) }] },
    }),
  })
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } }
  if (!res.ok) throw new Error(data.error?.message ?? `WhatsApp ${res.status}`)
  return data.messages?.[0]?.id
}

async function sendEmail(m: store.Message) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.MESSAGES_FROM || process.env.OPS_FROM, to: m.recipient, subject: m.subject ?? "Mjazo", text: m.body }),
  })
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!res.ok) throw new Error(data.message ?? `Email ${res.status}`)
  return data.id
}

async function sendPush(db: Db, m: store.Message) {
  const tokens = m.proId ? await store.pushTokens(db, "pro", m.proId) : m.customerId ? await store.pushTokens(db, "customer", m.customerId) : []
  if (!tokens.length) throw new Error("No phone app registered any more")
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(tokens.map((to) => ({ to, title: m.subject ?? "Mjazo", body: m.body, sound: "default", data: { bookingId: m.bookingId, rule: m.rule } }))),
  })
  const data = (await res.json().catch(() => ({}))) as { data?: { status: string; id?: string; details?: { error?: string } }[] }
  if (!res.ok) throw new Error(`Push ${res.status}`)
  // A phone that uninstalled the app: forget its token.
  for (const [i, r] of (data.data ?? []).entries()) if (r.details?.error === "DeviceNotRegistered") await store.dropPushToken(db, tokens[i])
  const ok = (data.data ?? []).find((r) => r.status === "ok")
  if (!ok) throw new Error(data.data?.[0]?.details?.error ?? "Push refused")
  return ok.id
}

/** Sends what's queued (or just logs it in test mode). */
async function deliver(db: Db) {
  const out = { sent: 0, logged: 0, failed: 0 }
  for (;;) {
    const batch = await store.claimMessages(db, 25)
    if (!batch.length) break
    for (const m of batch) {
      try {
        if (m.channel === "log") {
          await store.finishMessage(db, m.id, { status: "logged" })
          out.logged++
          continue
        }
        const providerId = m.channel === "whatsapp" ? await sendWhatsApp(m) : m.channel === "email" ? await sendEmail(m) : await sendPush(db, m)
        await store.finishMessage(db, m.id, { status: "sent", providerId: providerId ?? undefined })
        out.sent++
      } catch (e) {
        await store.finishMessage(db, m.id, { status: "failed", error: (e as Error).message })
        out.failed++
      }
    }
    if (batch.length < 25) break
  }
  return out
}

// ---------------------------------------------------------------------------
// Writing messages
// ---------------------------------------------------------------------------

type Ctx = {
  db: Db
  now: Date
  rules: Record<RuleKey, Rule>
  texts: { en: MessageTexts; ur: MessageTexts }
  cat: Awaited<ReturnType<typeof getCatalog>>
  pros: Pro[]
  settings: Awaited<ReturnType<typeof getSettings>>
}

const fillText = (text: string, vars: Record<string, string>) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "")
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`
}
/** "21 October 2027" (a Plus membership runs for a year, so the year matters). */
const longDate = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" })
const accountLink = (lang: string) => `${SITE_URL}${lang === "ur" ? "/ur" : ""}/account/bookings`
const packsLink = (lang: string) => `${SITE_URL}${lang === "ur" ? "/ur" : ""}/account/packs`

/** What a booking's messages say ({{tokens}}), in the customer's language. */
function bookingVars(j: Job, ctx: Ctx, lang: string) {
  const pro = ctx.pros.find((p) => p.id === j.proId)
  return {
    name: firstName(j.customer.name),
    services: j.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", "),
    date: formatBookingDate(j.date, lang),
    window: windowLabel(j.window, lang),
    id: j.id,
    link: accountLink(lang),
    pro: pro ? firstName(pro.name) : "",
    arrive: j.eta ? clock(j.eta) : windowLabel(j.window, lang),
  }
}

/**
 * Queues one message (once per `dedupeKey`). A pro's offer or a customer's booking message goes as
 * a push when they have the phone app; else by WhatsApp when that's set up and the rule has a
 * template; else by email when there's an address; else it's only logged.
 */
async function queue(ctx: Ctx, m: { rule: RuleKey; key: MessageKey; lang: string; vars: Record<string, string>; dedupeKey: string; phone?: string; email?: string | null; bookingId?: string; customerId?: string | null; proId?: string; eventId?: number; push?: boolean }) {
  const rule = ctx.rules[m.rule]
  const t = (m.lang === "ur" ? ctx.texts.ur : ctx.texts.en)[m.key]
  const template = rule.config.waTemplates?.[m.key]?.trim() || ""
  const ch = channels()
  // A pro's offer, or a customer's booking message, goes to their phone app when they have it.
  const owner = !m.push ? null : m.proId ? (["pro", m.proId] as const) : m.customerId ? (["customer", m.customerId] as const) : null
  const pushTo = owner ? (await store.pushTokens(ctx.db, owner[0], owner[1])).length > 0 : false
  const channel: store.Channel = pushTo ? "push" : ch.whatsapp && template && m.phone ? "whatsapp" : ch.email && m.email ? "email" : "log"
  return store.queueMessage(ctx.db, {
    rule: m.rule,
    dedupeKey: m.dedupeKey,
    channel,
    recipient: channel === "email" ? m.email! : (m.phone ?? m.email ?? "unknown"),
    template: template || m.key,
    subject: fillText(t.subject, m.vars),
    body: fillText(t.text, m.vars),
    params: (rule.params?.[m.key] ?? []).map((k) => m.vars[k] ?? ""),
    lang: m.lang,
    bookingId: m.bookingId,
    customerId: m.customerId ?? null,
    proId: m.proId,
    eventId: m.eventId,
  })
}

type CustomerRow = { id: string; lang: string; email: string | null; marketing_ok: boolean }
const customerOf = (db: Db, id: string | null | undefined) => (id ? db.one<CustomerRow>("select id, lang, email, marketing_ok from customers where id = $1", [id]) : Promise.resolve(null))
const bookingCustomer = async (db: Db, bookingId: string) => (await db.one<{ customer_id: string | null }>("select customer_id from bookings where id = $1", [bookingId]))?.customer_id ?? null

async function messageForBooking(ctx: Ctx, rule: RuleKey, key: MessageKey, j: Job, dedupeKey: string, extra: Record<string, string> = {}, eventId?: number) {
  if (!ctx.rules[rule].enabled) return null
  const c = await customerOf(ctx.db, await bookingCustomer(ctx.db, j.id))
  const lang = c?.lang === "ur" ? "ur" : "en"
  return queue(ctx, { rule, key, lang, vars: { ...bookingVars(j, ctx, lang), ...extra }, dedupeKey, phone: j.customer.phone, email: c?.email, bookingId: j.id, customerId: c?.id, eventId, push: true })
}

// ---------------------------------------------------------------------------
// Auto-assign: offer the visit to the best pro
// ---------------------------------------------------------------------------

/** Offers an open visit to the best pro who hasn't turned it down; tells ops when there's nobody. */
async function autoOffer(ctx: Ctx, bookingId: string) {
  const j = await cj.getJob(ctx.db, bookingId)
  if (!j || j.status !== "new" || j.proId) return "not open"
  const offers = await listOffers(ctx.db, { bookingIds: [bookingId] })
  if (offers.some((o) => o.status === "pending")) return "offered already"
  const turnedDown = offers.filter((o) => o.status === "declined" || o.status === "expired").map((o) => o.proId)
  const day = (await cj.listJobs(ctx.db, { sinceDays: 0 })).filter((x) => x.date === j.date)
  const best = rankPros(j, ctx.pros, day, ctx.cat, { exclude: turnedDown, verifiedOnly: true, standIn: await standInFor(ctx.db, j) })
  for (const c of best) {
    try {
      await offerJob(ctx.db, { bookingId, proId: c.proId, by: "automation", now: ctx.now })
      return `offered to ${c.proId}`
    } catch (e) {
      if (!(e instanceof InputError)) throw e
      // Too close to offer, or she just became busy: try the next one, or hand it to ops.
      if (/too close/i.test(e.message)) break
    }
  }
  const tried = turnedDown.length
  if (await store.markOnce(ctx.db, `nopro:${bookingId}:${tried}`)) void notifyOps(`[Mjazo] Needs a pro: ${bookingId}`, `Auto-assign couldn't place ${bookingId} (${j.date}, ${j.window}, ${j.area}). ${tried ? `${tried} pro(s) turned it down. ` : ""}Assign it in mission control.`)
  return "nobody"
}

// ---------------------------------------------------------------------------
// The favourite-pro guarantee
// ---------------------------------------------------------------------------

/** Who can stand in when the customer asked for a pro: everyone's ratings, and the policy's bar. */
async function standInFor(db: Db, j: Job) {
  const g = await policy(db, "guarantee")
  return g.on && j.preferredProId ? { ratings: await ratingsByPro(db), minStars: g.minStars, minRatings: g.minRatings } : undefined
}

/** Their visit went to another pro than the one they asked for: who's coming (her rating, or that she's new), and how to keep their own. */
async function favouriteBusy(ctx: Ctx, j: Job, eventId: number) {
  const asked = ctx.pros.find((p) => p.id === j.preferredProId)
  if (!asked) return
  const r = (await ratingsByPro(ctx.db, [j.proId!])).get(j.proId!)
  const ur = (await customerOf(ctx.db, await bookingCustomer(ctx.db, j.id)))?.lang === "ur"
  const rating = r ? (ur ? `ریٹنگ ${r.stars}★` : `rated ${r.stars}★`) : ur ? "مجازو پر نئی" : "new to Mjazo"
  await messageForBooking(ctx, "favouriteBusy", "favouriteBusy", j, `favouriteBusy:${j.id}:${j.proId}`, { asked: firstName(asked.name), rating }, eventId)
}

/**
 * Nobody could come: the guarantee's credit, once per visit (when it's switched on in Money →
 * Policies), a message, and a note to ops.
 */
async function noProCredit(ctx: Ctx, j: Job, why: string, eventId?: number) {
  const g = await policy(ctx.db, "guarantee")
  if (!g.on || !g.creditOn || g.credit <= 0) return false
  const customerId = await bookingCustomer(ctx.db, j.id)
  if (!customerId) return false
  const entry = await issueCredit(ctx.db, { customerId, amount: g.credit, reason: `Favourite-pro guarantee: nobody could come to ${j.id} (${why})`, bookingId: j.id, actor: "automation", key: `guarantee:${j.id}` })
  if (!entry) return false
  await messageForBooking(ctx, "noProCredit", "noProCredit", j, `noProCredit:${j.id}`, { amount: formatPKR(g.credit) }, eventId)
  void notifyOps(`[Mjazo] Nobody could come: ${j.id}`, `${j.id} (${j.date}, ${j.window}, ${j.area}): ${why}. ${formatPKR(g.credit)} credit was given to the customer by the favourite-pro guarantee.`)
  return true
}

// ---------------------------------------------------------------------------
// The outbox
// ---------------------------------------------------------------------------

/**
 * How old an event can be and still send its message. The outbox kept every event from before
 * automation existed: those (and anything a long outage left behind) are marked done without
 * messaging anyone about the past.
 */
const FRESH = { confirm: 6 * 3600_000, onTheWay: 3600_000, proOffer: 2 * 3600_000 }

async function handleEvents(ctx: Ctx) {
  let n = 0
  const mode = assignMode(ctx.rules)
  for (;;) {
    const events = await store.claimEvents(ctx.db, 100)
    if (!events.length) break
    for (const e of events) {
      try {
        const j = e.bookingId ? await cj.getJob(ctx.db, e.bookingId) : null
        const age = ctx.now.getTime() - Date.parse(e.at)
        if (e.type === "booking.created" && j) {
          if (age < FRESH.confirm) await messageForBooking(ctx, "confirm", "bookingConfirmed", j, `confirm:${j.id}`, {}, e.id)
          if (mode === "auto") await autoOffer(ctx, j.id)
        } else if (e.type === "booking.en_route" && j && age < FRESH.onTheWay) {
          await messageForBooking(ctx, "onTheWay", "onTheWay", j, `onTheWay:${j.id}:${e.id}`, {}, e.id)
        } else if ((e.type === "booking.new" || e.type === "offer.declined" || e.type === "offer.expired") && j && mode === "auto") {
          await autoOffer(ctx, j.id)
        } else if ((e.type === "booking.assigned" || e.type === "booking.reassigned") && j?.proId && j.preferredProId && j.proId !== j.preferredProId && age < FRESH.confirm) {
          await favouriteBusy(ctx, j, e.id)
        } else if (e.type === "booking.cancelled" && j && !j.proId && age < FRESH.confirm) {
          // Ops cancelled a visit no pro took because nobody could come (they say so when cancelling;
          // a cancellation the customer asked for, or a duplicate, gets nothing).
          if (await store.nobodyCame(ctx.db, j.id)) await noProCredit(ctx, j, "ops cancelled it: nobody could come", e.id)
        } else if (e.type === "booking.completed" && j) {
          // The visit's receipt, with its link.
          if (ctx.rules.receipt.enabled && age < FRESH.confirm) {
            const r = await ensureReceipt(ctx.db, j)
            const c = r ? await customerOf(ctx.db, await bookingCustomer(ctx.db, j.id)) : null
            const lang = c?.lang === "ur" ? "ur" : "en"
            const link = r && receiptUrl(r, lang)
            if (r && link) await messageForBooking(ctx, "receipt", "receipt", j, `receipt:${j.id}`, { no: r.number, amount: formatAmount(r.total), link }, e.id)
          }
          // A friend's first visit with someone's code: their credit (always), and a message.
          const r = await rewardReferral(ctx.db, j.id, ctx.settings.referral?.youGet ?? 0)
          const c = r && ctx.rules.referralReward.enabled ? await ctx.db.one<{ id: string; name: string; phone: string | null; email: string | null; lang: string }>("select id, name, phone, email, lang from customers where id = $1", [r.referrerId]) : null
          if (r && c) {
            const lang = c.lang === "ur" ? "ur" : "en"
            await queue(ctx, { rule: "referralReward", key: "referralReward", lang, vars: { name: firstName(c.name), friend: firstName(j.customer.name), amount: formatPKR(r.amount), link: accountLink(lang) }, dedupeKey: `referral:${r.friendId}`, phone: c.phone ?? undefined, email: c.email, customerId: c.id, eventId: e.id, push: true })
          }
        } else if (e.type === "plus.activated" && e.customerId && ctx.rules.plusWelcome.enabled && age < FRESH.confirm) {
          const c = await customerOf(ctx.db, e.customerId)
          const who = await ctx.db.one<{ name: string; phone: string | null }>("select name, phone from customers where id = $1", [e.customerId])
          const m = await ctx.db.one<{ discount_pct: number; ends_at: string }>("select discount_pct, ends_at from plus_memberships where id = $1", [String(e.data.membershipId ?? "")])
          if (c && who && m) {
            const lang = c.lang === "ur" ? "ur" : "en"
            await queue(ctx, { rule: "plusWelcome", key: "plusWelcome", lang, vars: { name: firstName(who.name), until: longDate(m.ends_at, lang), pct: String(m.discount_pct), link: `${SITE_URL}${lang === "ur" ? "/ur" : ""}/services` }, dedupeKey: `plus:${String(e.data.membershipId)}`, phone: who.phone ?? undefined, email: c.email, customerId: c.id, eventId: e.id, push: true })
          }
        } else if (e.type === "pack.activated" && e.customerId && ctx.rules.packWelcome.enabled && age < FRESH.confirm) {
          const c = await customerOf(ctx.db, e.customerId)
          const who = await ctx.db.one<{ name: string; phone: string | null }>("select name, phone from customers where id = $1", [e.customerId])
          const k = await ctx.db.one<{ name: string; visits: number; ends_at: string }>("select name, visits, ends_at from customer_packs where id = $1", [String(e.data.packId ?? "")])
          if (c && who && k) {
            const lang = c.lang === "ur" ? "ur" : "en"
            await queue(ctx, { rule: "packWelcome", key: "packWelcome", lang, vars: { name: firstName(who.name), pack: k.name, visits: String(k.visits), until: longDate(k.ends_at, lang), link: packsLink(lang) }, dedupeKey: `pack:${String(e.data.packId)}`, phone: who.phone ?? undefined, email: c.email, customerId: c.id, eventId: e.id, push: true })
          }
        } else if (e.type === "offer.made" && j && e.proId && ctx.rules.proOffer.enabled && age < FRESH.proOffer) {
          const pro = ctx.pros.find((p) => p.id === e.proId)
          const until = typeof e.data.expiresAt === "string" ? new Date(e.data.expiresAt).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : ""
          // What she earns, at the regular-customer rate when it applies (as the pro app shows it).
          const rate = pro && (await pairRates(ctx.db, [{ bookingId: j.id, proId: pro.id, proRate: pro.commissionRate }])).get(j.id)
          if (pro)
            await queue(ctx, {
              rule: "proOffer",
              key: "proOffer",
              lang: "en",
              vars: { ...bookingVars(j, ctx, "en"), area: ctx.cat.getArea(j.area)?.name ?? j.area, earn: formatPKR(visitEarning(j, pro, rate || undefined)), until, link: `${SITE_URL}/pro` },
              dedupeKey: `proOffer:${String(e.data.offerId ?? e.id)}`,
              phone: pro.phone,
              bookingId: j.id,
              proId: pro.id,
              eventId: e.id,
              push: true,
            })
        }
        await store.finishEvent(ctx.db, e.id)
      } catch (err) {
        console.error(`[automation] event ${e.id} (${e.type}) failed`, err)
        await store.finishEvent(ctx.db, e.id, (err as Error).message)
      }
      n++
    }
    if (events.length < 100) break
  }
  return n
}

// ---------------------------------------------------------------------------
// On a timer (Karachi time)
// ---------------------------------------------------------------------------

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)

async function runSchedules(ctx: Ctx) {
  const k = karachiNow(ctx.now)
  const today = k.date
  const hour = k.hour
  const daytime = hour >= 10 && hour < 20 // when marketing-type messages may go
  const out: Record<string, number | string> = {}
  const jobs = await cj.listJobs(ctx.db, { sinceDays: 3 })

  // The day before, from 6 pm.
  if (ctx.rules.reminder.enabled && hour >= 18 && hour < 22) {
    let n = 0
    for (const j of jobs.filter((x) => x.date === addDays(today, 1) && ["new", "assigned"].includes(x.status))) if (await messageForBooking(ctx, "reminder", "reminder", j, `reminder:${j.id}:${j.date}`)) n++
    out.reminders = n
  }

  // The guarantee: a visit whose window started half an hour ago with no pro (once per visit;
  // today's and yesterday's only, so switching the credit on never pays for older ones).
  const g = await policy(ctx.db, "guarantee")
  if (g.on && g.creditOn && g.credit > 0) {
    let n = 0
    const started = (x: Job) => x.date === addDays(today, -1) || (x.date === today && (WINDOW_HOURS[WINDOW_LABELS.indexOf(x.window)] ?? 24) + 0.5 <= hour)
    for (const j of jobs.filter((x) => x.status === "new" && !x.proId && started(x)))
      if (await noProCredit(ctx, j, "no pro half an hour into the window")) n++
    if (n) out.guarantee = n
  }

  // "Rate your visit": two hours after it was done, within three days, if not rated.
  if (ctx.rules.rateVisit.enabled && daytime) {
    let n = 0
    for (const j of jobs.filter((x) => x.status === "completed" && !x.rating)) {
      const doneAt = j.events.filter((e) => e.type === "completed").at(-1)?.at
      if (!doneAt) continue
      const age = ctx.now.getTime() - Date.parse(doneAt)
      if (age < 2 * 3600_000 || age > 3 * 86400_000) continue
      if (await messageForBooking(ctx, "rateVisit", "rateVisit", j, `rate:${j.id}`, { link: `${SITE_URL}/rate?id=${encodeURIComponent(j.id)}` })) n++
    }
    out.reviews = n
  }

  // Monday from 9 am: last week's payout run, drafted for Finance to approve.
  if (ctx.rules.weeklyPayout.enabled && new Date(`${today}T12:00:00Z`).getUTCDay() === 1 && hour >= 9) {
    const end = addDays(today, -1)
    const start = addDays(today, -7)
    const key = `payout-week:${end}`
    if (!(await ctx.db.one("select 1 from core_meta where key = $1", [key]))) {
      try {
        const run = await draftPayoutRun(ctx.db, { periodStart: start, periodEnd: end, by: "automation", now: ctx.now })
        await store.markOnce(ctx.db, key, { runId: run.id })
        out.payoutRun = run.id
        const topUps = run.payouts.filter((x) => x.topUp > 0)
        const minimum = topUps.length ? ` It tops up ${topUps.length} pro${topUps.length === 1 ? "" : "s"} to the weekly minimum (${formatPKR(topUps.reduce((s, x) => s + x.topUp, 0))} in all).` : ""
        void notifyOps(`[Mjazo] Payout run ${run.id} ready to approve`, `Last week's payout run (${start} to ${end}, ${run.payouts.length} pros) is drafted.${minimum} Finance: approve it in mission control → Money, then mark each payout paid.`)
      } catch (e) {
        if (!(e instanceof InputError)) throw e
        // Nothing owed: done for the week. A run still open: try again later (and say so once).
        if (/Nobody is owed/i.test(e.message)) await store.markOnce(ctx.db, key, { nothing: true })
        else if (await store.markOnce(ctx.db, `${key}:blocked`)) void notifyOps("[Mjazo] Weekly payout run waiting", `This week's payout run couldn't be drafted: ${e.message}`)
        out.payoutRun = e.message
      }
    }
  }

  // Home Pulse reminders: to people who asked for them; what's due in the next 2 days; at most 2 a month.
  if (ctx.rules.pulseNudges.enabled && daytime) {
    let n = 0
    const subs = (await listSubmissions("enquiry", new Date(ctx.now.getTime() - 400 * 86400000).toISOString())).filter((s) => s.data.kind === "pulse")
    const seen = new Set<string>()
    for (const s of subs.sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const phone = normalisePhone(String(s.data.phone ?? ""))
      if (!/^03\d{9}$/.test(phone) || seen.has(phone)) continue
      seen.add(phone) // their latest plan only
      if (await store.optedOut(ctx.db, phone)) continue
      if ((await store.sentSince(ctx.db, "pulseNudges", [phone], new Date(ctx.now.getTime() - 30 * 86400000).toISOString())) >= 2) continue
      const details = (s.data.details ?? {}) as { lang?: string; plan?: string[] }
      const due = (details.plan ?? [])
        .map((p) => {
          const [date, ...rest] = p.split(" · ")
          return { date, title: rest.join(" · ") }
        })
        .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.date >= today && p.date <= addDays(today, 2) && p.title)
        .sort((a, b) => a.date.localeCompare(b.date))[0]
      if (!due) continue
      const lang = details.lang === "ur" ? "ur" : "en"
      const id = await queue(ctx, { rule: "pulseNudges", key: "pulseNudge", lang, vars: { name: firstName(String(s.data.name ?? "")), title: due.title, date: formatBookingDate(due.date, lang), link: `${SITE_URL}${lang === "ur" ? "/ur" : ""}/home-pulse` }, dedupeKey: `pulse:${phone}:${due.date}:${due.title}`, phone })
      if (id) n++
    }
    out.pulse = n
  }

  // Packs: their next visit is due (two days ahead) and none is booked. Once per visit.
  if (ctx.rules.packDue.enabled && daytime) {
    let n = 0
    for (const k of await packsDue(ctx.db, addDays(today, 2), ctx.now)) {
      if (!k.phone || (await store.optedOut(ctx.db, k.phone))) continue
      const lang = k.lang === "ur" ? "ur" : "en"
      const id = await queue(ctx, { rule: "packDue", key: "packDue", lang, vars: { name: firstName(k.customerName), pack: k.name, left: String(k.left), link: packsLink(lang) }, dedupeKey: `packDue:${k.id}:${k.used}`, phone: k.phone, email: k.email, customerId: k.customerId, push: true })
      if (id) n++
    }
    out.packDue = n
  }

  // Win-back: signed-in customers who said yes to messages, 60 and 90 days after their last visit.
  if (ctx.rules.winBack.enabled && daytime) {
    let n = 0
    const rows = await ctx.db.query<{ id: string; phone: string; name: string; lang: string; email: string | null; last_id: string; last_day: string }>(
      `select c.id, c.phone, c.name, c.lang, c.email, b.id as last_id, b.day as last_day
       from customers c
       join lateral (select id, day from bookings where customer_id = c.id and status = 'completed' order by day desc limit 1) b on true
       where c.marketing_ok and c.auth_user_id is not null and c.phone is not null
         and not exists (select 1 from bookings x where x.customer_id = c.id and x.day > b.day and x.status <> 'cancelled')`,
    )
    for (const c of rows) {
      const days = daysBetween(c.last_day, today)
      const key: MessageKey | null = days >= 90 && days < 120 ? "winBack90" : days >= 60 && days < 90 ? "winBack60" : null
      if (!key || (await store.optedOut(ctx.db, c.phone))) continue
      const lang = c.lang === "ur" ? "ur" : "en"
      const id = await queue(ctx, { rule: "winBack", key, lang, vars: { name: firstName(c.name), link: `${SITE_URL}${lang === "ur" ? "/ur" : ""}/services` }, dedupeKey: `${key}:${c.id}:${c.last_id}`, phone: c.phone, email: c.email, customerId: c.id })
      if (id) n++
    }
    out.winBack = n
  }
  return out
}

// ---------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------

async function context(db: Db, now: Date): Promise<Ctx> {
  const [rules, en, ur, cat, pros, settings] = await Promise.all([loadRules(db), getMessages("en"), getMessages("ur"), getCatalog("en"), cj.listPros(db), getSettings("en")])
  return { db, now, rules, texts: { en: en ?? MESSAGES, ur: ur ?? MESSAGES }, cat, pros, settings }
}

export type RunSummary = { events: number; scheduled: Record<string, number | string>; sent: number; logged: number; failed: number; testMode: boolean }

let running: Promise<RunSummary | null> | null = null
let again = false

/** Works through the outbox, the timed rules and the send queue once. Null when the core is off. */
export async function runAutomation(now = new Date()): Promise<RunSummary | null> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      const db = await core()
      if (!db) return null
      const ctx = await context(db, now)
      const events = await handleEvents(ctx)
      const scheduled = await runSchedules(ctx)
      // Events the timed rules just made (e.g. an offer), then everything queued.
      const more = await handleEvents(ctx)
      const d = await deliver(db)
      return { events: events + more, scheduled, ...d, testMode: testMode() }
    } finally {
      running = null
    }
  })()
  const r = await running
  if (again) {
    again = false
    void runAutomation().catch((e) => console.error("[automation] rerun failed", e))
  }
  return r
}

/** Runs the automation soon after a change (best effort: the pinger catches anything missed). */
export function kickAutomation() {
  if (process.env.NODE_ENV === "test") return
  const go = () => runAutomation().catch((e) => console.error("[automation] run failed", e))
  try {
    // After the response is sent (Vercel keeps the function alive for it).
    after(go)
  } catch {
    void go()
  }
}

let lastTick = 0
/** At most every 5 minutes per server, from screens staff keep open (in case the pinger isn't set up). */
export function tickAutomation() {
  if (Date.now() - lastTick < 5 * 60_000) return
  lastTick = Date.now()
  kickAutomation()
}

/** A message as it would read, for mission control's preview. */
export function previewMessage(texts: MessageTexts, key: MessageKey, lang = "en") {
  const sample: Record<string, string> = { name: "Ayesha", services: "Full body waxing", date: formatBookingDate("2026-10-23", lang), window: windowLabel("3–5 pm", lang), id: "MJ-EXAMPLE", link: accountLink(lang), pro: "Sana", arrive: "3:40 pm", title: "AC service", area: "DHA", earn: "PKR 3,375", until: key === "plusWelcome" ? longDate("2027-10-21T12:00:00Z", lang) : "1:30 pm", amount: key === "receipt" ? "PKR 4,500" : "PKR 500", friend: "Sana", pct: "10", no: "MJR-000123", asked: "Hina", rating: lang === "ur" ? "ریٹنگ 4.8★" : "rated 4.8★" }
  return { subject: fillText(texts[key].subject, sample), text: fillText(texts[key].text, sample) }
}

/**
 * The board's suggestion for each unassigned visit (auto-assign set to "suggest" or "auto"): the
 * best pro and why. Empty when auto-assign is off or the core isn't on.
 */
export async function boardSuggestions(dayJobs: Job[], pros: Pro[]): Promise<{ mode: AssignMode; byJob: Record<string, { proId: string; reasons: string[] }> }> {
  const db = await core()
  if (!db) return { mode: "off", byJob: {} }
  const mode = assignMode(await loadRules(db))
  if (mode === "off") return { mode, byJob: {} }
  const cat = await getCatalog("en")
  const byJob: Record<string, { proId: string; reasons: string[] }> = {}
  const g = await policy(db, "guarantee")
  const ratings = g.on ? await ratingsByPro(db) : new Map()
  for (const j of dayJobs.filter((x) => x.status === "new" && !x.proId)) {
    const best = rankPros(j, pros, dayJobs, cat, { standIn: g.on && j.preferredProId ? { ratings, minStars: g.minStars, minRatings: g.minRatings } : undefined })[0]
    if (best) byJob[j.id] = { proId: best.proId, reasons: best.reasons }
  }
  return { mode, byJob }
}
