"use client"

import { useEffect, useState } from "react"
import { BadgeCheck, Check, Clock, LogOut, MapPin, Phone, Star, X } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import type { Lang } from "@/lib/content"
import { fill } from "@/lib/cms/format"
import { cn } from "@/lib/utils"
import { api, Btn, mapsLink, usePoll } from "../kit"
import { T } from "./strings"
import { dayLabel, timeLabel, urCls, type Availability, type Earnings, type Offers, type Profile, type Ratings, type Schedule } from "./visit"

// The pro app's other tabs: the week ahead, offers, earnings and her profile (rating and
// availability). Each reads /api/v1/pro, the same API the phone app uses.

const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ur: ["اتوار", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ"],
  ro: ["Itwar", "Peer", "Mangal", "Budh", "Jumerat", "Juma", "Hafta"],
}

const KIND: Record<string, Record<Lang, string>> = {
  visit_completed: { en: "Visit completed", ur: "وزٹ مکمل", ro: "Visit mukammal" },
  payment: { en: "Payment collected", ur: "ادائیگی وصول", ro: "Payment wasool" },
  cash_handed_in: { en: "Cash handed in", ur: "نقد جمع کروایا", ro: "Cash jama karwaya" },
  payout: { en: "Payout", ur: "ادائیگی", ro: "Payout" },
  minimum_topup: T.minTopUpKind,
}

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("rounded-[28px] bg-white/[0.06] p-5", className)}>{children}</div>
const Title = ({ children, lang }: { children: React.ReactNode; lang: Lang }) => <h2 className={cn("text-sm text-white/50 mb-3", urCls(lang))}>{children}</h2>

/** Loads `url` (and again when `poll` ms pass, if given); the error is shown in place. */
function useData<D>(url: string, poll?: number) {
  const [data, setData] = useState<D | null>(null)
  const [error, setError] = useState("")
  const load = async () => {
    try {
      setData(await api<D>(url))
      setError("")
    } catch (e) {
      setError((e as Error).message)
    }
  }
  usePoll(load, poll ?? 10 * 60_000)
  return { data, error, load }
}

// ---------------------------------------------------------------------------
// The week ahead
// ---------------------------------------------------------------------------

export function ScheduleTab({ schedule, lang }: { schedule: Schedule | null; lang: Lang }) {
  const ur = urCls(lang)
  if (!schedule) return <div className="h-40 rounded-[28px] bg-white/[0.04] animate-pulse" />
  return (
    <div className="space-y-5">
      {schedule.days.map((d, i) => (
        <section key={d.date}>
          <h2 className={cn("text-sm text-white/50 mb-2", ur)}>
            {i === 0 ? T.tabToday[lang] : i === 1 ? T.tomorrow[lang] : dayLabel(d.date, lang, { weekday: "long" })} · {dayLabel(d.date, lang, { day: "numeric", month: "short" })}
          </h2>
          {!d.visits.length ? (
            <p className={cn("rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white/40", ur)}>{T.noVisits[lang]}</p>
          ) : (
            <ul className="space-y-2">
              {d.visits.map((v) => (
                <li key={v.id} className={cn("rounded-2xl bg-white/[0.06] p-4", v.status === "completed" && "opacity-50")}>
                  <p className="flex items-center gap-2 text-sm text-white/60">
                    <Clock className="w-3.5 h-3.5" /> {v.window}
                    {v.status === "completed" && <Check className="w-4 h-4 text-emerald-300" />}
                    <span className="ml-auto">{formatPKR(v.earn)}</span>
                  </p>
                  <p className="font-semibold mt-1">
                    {v.customer.name.split(" ")[0]} · {v.subArea ?? v.area}
                  </p>
                  <p className="text-sm text-white/60 mt-0.5">{v.items.map((x) => `${x.name}${x.qty > 1 ? ` ×${x.qty}` : ""}`).join(" · ")}</p>
                  {i > 0 && (
                    <div className="flex gap-2 mt-3">
                      <a href={mapsLink([v.address, v.subArea, v.area, "Karachi"].filter(Boolean).join(", "))} target="_blank" rel="noreferrer" className="h-9 px-4 rounded-full bg-white/10 inline-flex items-center gap-1.5 text-xs">
                        <MapPin className="w-3.5 h-3.5" /> {T.map[lang]}
                      </a>
                      <a href={`tel:${v.customer.phone}`} className="h-9 px-4 rounded-full bg-white/10 inline-flex items-center gap-1.5 text-xs">
                        <Phone className="w-3.5 h-3.5" /> {T.call[lang]}
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export function OffersTab({ lang, onAnswered, toast }: { lang: Lang; onAnswered: () => void; toast: (t: string) => void }) {
  const ur = urCls(lang)
  const { data, error, load } = useData<{ offers: Offers }>("/api/v1/pro/offers", 30_000)
  const [busy, setBusy] = useState("")
  const [declining, setDeclining] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const answer = async (id: string, accept: boolean) => {
    setBusy(`${id}:${accept}`)
    try {
      await api(`/api/v1/pro/offers/${encodeURIComponent(id)}`, { accept, reason: accept ? undefined : reason.trim() || undefined })
      toast(accept ? T.accepted[lang] : T.declined[lang])
      setDeclining(null)
      setReason("")
      onAnswered()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy("")
      await load()
    }
  }
  if (error && !data) return <p className="text-sm text-red-300">{error}</p>
  if (!data) return <div className="h-40 rounded-[28px] bg-white/[0.04] animate-pulse" />
  const open = data.offers.filter((o) => o.status === "pending")
  const past = data.offers.filter((o) => o.status !== "pending")
  const label = { accepted: T.acceptedShort[lang], declined: T.declined[lang], expired: T.expired[lang], withdrawn: T.withdrawn[lang], pending: "" }
  return (
    <div className="space-y-4">
      {!open.length && <p className={cn("rounded-[28px] bg-white/[0.05] p-6 text-white/60", ur)}>{T.noOffers[lang]}</p>}
      {open.map((o) => {
        const v = o.visit!
        return (
          <Card key={o.id} className="bg-white text-black">
            <p className="text-sm text-black/60 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> {dayLabel(v.date, lang)} · {v.window}
            </p>
            <p className="text-xl font-semibold mt-1">
              {v.subArea ? `${v.subArea}, ` : ""}
              {v.area}
            </p>
            {v.askedForYou && <p className={cn("mt-2 inline-flex rounded-full bg-black text-[var(--brand)] text-xs font-medium px-2.5 py-1", ur)}>{T.askedForYou[lang]}</p>}
            {v.regular && <p className={cn("mt-2 ms-1 inline-flex rounded-full bg-emerald-100 text-emerald-900 text-xs font-medium px-2.5 py-1", ur)}>{fill(T.regularKeep[lang], { pct: String(v.regular.keepPct) })}</p>}
            <ul className="mt-3 space-y-0.5 text-[15px]">
              {v.services.map((s, k) => (
                <li key={k}>
                  {s.name}
                  {s.options.length > 0 && <span className="text-black/50"> · {s.options.join(", ")}</span>}
                  {s.addOns.length > 0 && <span className="text-black/50"> + {s.addOns.join(", ")}</span>}
                  {s.qty > 1 && <span className="text-black/50"> ×{s.qty}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-black/60">
              ~{v.minutes} {T.min[lang]} · {v.payment}
            </p>
            <div className="mt-4 rounded-2xl bg-[var(--brand)] px-4 py-3 flex items-baseline justify-between">
              <span className={cn("text-sm", ur)}>{T.youEarn[lang]}</span>
              <span className="font-serif text-2xl">{formatPKR(v.earn)}</span>
            </div>
            <p className={cn("mt-3 text-xs text-black/50", ur)}>
              {T.answerBy[lang]}: {timeLabel(o.expiresAt)} · {T.whoLater[lang]}
            </p>
            {declining === o.id ? (
              <div className="mt-4 space-y-2">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={T.declineWhy[lang]} className="w-full h-12 rounded-2xl border border-black/15 px-4 outline-none focus:border-black" />
                <div className="flex gap-2">
                  <Btn variant="danger" size="lg" className="flex-1" busy={busy === `${o.id}:false`} onClick={() => answer(o.id, false)}>
                    <span className={ur}>{T.sendDecline[lang]}</span>
                  </Btn>
                  <Btn variant="ghost" size="lg" onClick={() => setDeclining(null)}>
                    <X className="w-5 h-5" />
                  </Btn>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <Btn variant="dark" size="lg" className="flex-1" busy={busy === `${o.id}:true`} onClick={() => answer(o.id, true)}>
                  <Check className="w-5 h-5" />
                  <span className={ur}>{T.accept[lang]}</span>
                </Btn>
                <Btn variant="light" size="lg" onClick={() => setDeclining(o.id)}>
                  <span className={ur}>{T.decline[lang]}</span>
                </Btn>
              </div>
            )}
          </Card>
        )
      })}
      {past.length > 0 && (
        <section>
          <Title lang={lang}>{T.earlier[lang]}</Title>
          <ul className="space-y-2">
            {past.map((o) => (
              <li key={o.id} className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm flex items-center gap-3">
                <span className="flex-1 min-w-0 truncate text-white/70">
                  {dayLabel(o.visit!.date, lang)} · {o.visit!.window} · {o.visit!.subArea ?? o.visit!.area}
                </span>
                <span className={cn("shrink-0 text-xs", o.status === "accepted" ? "text-emerald-300" : "text-white/45", ur)}>{label[o.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Earnings
// ---------------------------------------------------------------------------

/** Her week so far against the weekly minimum: each condition, and what Mjazo would add. */
function MinimumCard({ m, lang }: { m: NonNullable<Earnings["minimum"]>; lang: Lang }) {
  const ur = urCls(lang)
  const checks = [
    { ok: m.checks.verified, text: T.minVerified[lang] },
    // Shown only in the week she joined: it counts from her first full week.
    { ok: m.checks.fullWeek, text: T.minFullWeek[lang], hide: m.checks.fullWeek },
    { ok: m.checks.firstWeeks, text: fill(T.minFirstWeeks[lang], { weeks: m.weeks }), hide: !m.weeks },
    { ok: m.checks.windows, text: fill(T.minWindows[lang], { n: m.windows, min: m.minWindows }) },
    { ok: m.checks.offers, text: fill(T.minOffers[lang], { n: m.offers.accepted, made: m.offers.made }), hide: !m.offers.made },
  ].filter((c) => !c.hide)
  return (
    <Card>
      <Title lang={lang}>{T.minTitle[lang]}</Title>
      <p className={cn("text-sm text-white/70", ur)}>{fill(T.minBody[lang], { amount: formatPKR(m.amount), windows: m.minWindows, pct: Math.round(m.minAcceptance * 100) })}</p>
      <p className={cn("mt-3 font-medium", ur)}>{fill(T.minEarned[lang], { amount: formatPKR(m.earned) })}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {checks.map((c) => (
          <li key={c.text} className={cn("flex gap-2", c.ok ? "text-emerald-300" : "text-amber-300", ur)}>
            <span aria-hidden>{c.ok ? "✓" : "•"}</span>
            {c.text}
          </li>
        ))}
      </ul>
      {m.eligible && <p className={cn("mt-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm", ur)}>{m.topUp > 0 ? fill(T.minTopUp[lang], { amount: formatPKR(m.topUp) }) : T.minReached[lang]}</p>}
    </Card>
  )
}

export function MoneyTab({ lang }: { lang: Lang }) {
  const ur = urCls(lang)
  const { data, error } = useData<Earnings>("/api/v1/pro/earnings", 60_000)
  if (error && !data) return <p className="text-sm text-red-300">{error}</p>
  if (!data) return <div className="h-40 rounded-[28px] bg-white/[0.04] animate-pulse" />
  const { balances: b } = data
  return (
    <div className="space-y-4">
      <Card className="bg-white text-black">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={cn("text-xs text-black/55", ur)}>{T.owed[lang]}</p>
            <p className="font-serif text-3xl mt-1">{formatPKR(b.owed)}</p>
          </div>
          <div>
            <p className={cn("text-xs text-black/55", ur)}>{T.cashHeld[lang]}</p>
            <p className="font-serif text-3xl mt-1">{formatPKR(b.cashHeld)}</p>
          </div>
        </div>
        <p className={cn("mt-4 rounded-2xl px-4 py-3 text-sm", b.net === 0 ? "bg-black/[0.05]" : b.net > 0 ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900", ur)}>
          {b.net === 0 ? T.settled[lang] : `${b.net > 0 ? T.netPay[lang] : T.netHandIn[lang]} ${formatPKR(Math.abs(b.net))}`}
        </p>
      </Card>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { k: T.thisWeek[lang], v: data.week },
          { k: T.last30[lang], v: data.month },
        ].map((x) => (
          <div key={x.k} className="rounded-3xl bg-white/[0.06] px-4 py-3.5">
            <p className="font-serif text-2xl">{formatPKR(x.v.earned)}</p>
            <p className={cn("text-[11px] text-white/50 mt-1", ur)}>
              {x.k} · {x.v.visits} {T.visitsWord[lang]}
            </p>
          </div>
        ))}
      </div>
      {data.minimum && <MinimumCard m={data.minimum} lang={lang} />}
      <section>
        <Title lang={lang}>{T.payouts[lang]}</Title>
        {!data.payouts.length ? (
          <p className={cn("text-sm text-white/45", ur)}>{T.noPayouts[lang]}</p>
        ) : (
          <ul className="space-y-2">
            {data.payouts.map((p) => (
              <li key={p.id} className="rounded-2xl bg-white/[0.06] p-4 text-sm">
                <p className="flex items-center gap-2">
                  <span className="flex-1">
                    {dayLabel(p.periodStart, lang, { day: "numeric", month: "short" })} – {dayLabel(p.periodEnd, lang, { day: "numeric", month: "short" })}
                  </span>
                  <span className="font-semibold">{formatPKR(Math.abs(p.amount))}</span>
                </p>
                <p className={cn("text-xs text-white/50 mt-1", ur)}>
                  {p.status === "paid" ? `${p.amount >= 0 ? T.paidYou[lang] : T.handedIn[lang]}${p.reference ? ` · ${p.reference}` : ""}` : `${p.amount >= 0 ? T.payYou[lang] : T.handIn[lang]} · ${T.approved[lang]}`}
                  {p.topUp > 0 && ` · ${T.minTopUpKind[lang]} +${formatPKR(p.topUp)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <Title lang={lang}>{T.statement[lang]}</Title>
        {!data.statement.length ? (
          <p className={cn("text-sm text-white/45", ur)}>{T.noStatement[lang]}</p>
        ) : (
          <div className="rounded-2xl bg-white/[0.04] overflow-hidden">
            <div className={cn("grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-[11px] text-white/40", ur)}>
              <span />
              <span className="w-20 text-right">{T.earnedCol[lang]}</span>
              <span className="w-20 text-right">{T.cashCol[lang]}</span>
            </div>
            <ul className="divide-y divide-white/[0.06]">
              {data.statement.map((l) => (
                <li key={l.entryId} className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className={cn("block truncate", ur)}>{KIND[l.kind]?.[lang] ?? l.kind}</span>
                    <span className="block text-[11px] text-white/40">
                      {dayLabel(l.at.slice(0, 10), lang, { day: "numeric", month: "short" })}
                      {l.bookingId && ` · ${l.bookingId}`}
                    </span>
                  </span>
                  <span className={cn("w-20 text-right tabular-nums", !l.earned && "text-white/25")}>{l.earned ? `${l.earned > 0 ? "+" : ""}${l.earned.toLocaleString("en-PK")}` : "–"}</span>
                  <span className={cn("w-20 text-right tabular-nums", !l.cash && "text-white/25")}>{l.cash ? `${l.cash > 0 ? "+" : ""}${l.cash.toLocaleString("en-PK")}` : "–"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile: rating and availability
// ---------------------------------------------------------------------------

export function MeTab({ lang, langSwitch, onLogout }: { lang: Lang; langSwitch: React.ReactNode; onLogout: () => void }) {
  const ur = urCls(lang)
  const me = useData<Profile>("/api/v1/pro/me")
  const ratings = useData<Ratings>("/api/v1/pro/ratings")
  const p = me.data
  const r = ratings.data
  return (
    <div className="space-y-4">
      {me.error && <p className="text-sm text-red-300">{me.error}</p>}
      {p && (
        <Card>
          <p className="font-serif text-3xl">{p.name}</p>
          <p className={cn("mt-2 inline-flex items-center gap-1.5 text-sm", p.verified ? "text-emerald-300" : "text-amber-300", ur)}>
            <BadgeCheck className="w-4 h-4" /> {p.verified ? T.verified[lang] : T.notVerified[lang]}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className={cn("text-white/45 text-xs", ur)}>{T.areas[lang]}</dt>
              <dd>{[p.area, ...p.zones].join(", ")}</dd>
            </div>
            <div>
              <dt className={cn("text-white/45 text-xs", ur)}>{T.skills[lang]}</dt>
              <dd>{p.skills.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-white/45 text-xs">
                {T.phone[lang]}
                {p.email && ` · ${T.email[lang]}`}
              </dt>
              <dd>
                {p.phone}
                {p.email && ` · ${p.email}`}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      <Card>
        <Title lang={lang}>{T.rating[lang]}</Title>
        {!r ? (
          <div className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />
        ) : !r.count ? (
          <p className={cn("text-sm text-white/55", ur)}>{T.noRatings[lang]}</p>
        ) : (
          <>
            <p className="flex items-baseline gap-2">
              <span className="font-serif text-5xl">{r.average?.toFixed(1)}</span>
              <Star className="w-5 h-5 fill-[var(--brand)] text-[var(--brand)]" />
              <span className="text-sm text-white/50">
                {r.count} {T.ratings[lang]}
              </span>
            </p>
            <div className="mt-3 space-y-1">
              {([5, 4, 3, 2, 1] as const).map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs text-white/50">
                  <span className="w-3">{s}</span>
                  <span className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <span className="block h-full bg-[var(--brand)]" style={{ width: `${(r.stars[s] / r.count) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right">{r.stars[s]}</span>
                </div>
              ))}
            </div>
            <ul className="mt-4 space-y-3">
              {r.recent.slice(0, 8).map((x) => (
                <li key={x.bookingId} className="text-sm">
                  <p className="flex items-center gap-1 text-[var(--brand)]">
                    {"★".repeat(x.stars)}
                    <span className="text-white/20">{"★".repeat(5 - x.stars)}</span>
                    <span className="ml-2 text-xs text-white/40">
                      {dayLabel(x.day, lang, { day: "numeric", month: "short" })} · {x.services.join(", ")}
                    </span>
                  </p>
                  {x.tags.length > 0 && <p className="text-xs text-white/55 mt-0.5">{x.tags.join(" · ")}</p>}
                  {x.comment && (
                    <p className="text-white/80 mt-1" dir="auto">
                      “{x.comment}”
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <AvailabilityCard lang={lang} />

      <Card className="flex items-center gap-3">
        <div className="flex-1">{langSwitch}</div>
        <Btn variant="ghost" className="text-white/80" onClick={onLogout}>
          <LogOut className="w-4 h-4" />
          <span className={ur}>{T.logout[lang]}</span>
        </Btn>
      </Card>
    </div>
  )
}

function AvailabilityCard({ lang }: { lang: Lang }) {
  const ur = urCls(lang)
  const { data, error, load } = useData<Availability>("/api/v1/pro/availability")
  const [avail, setAvail] = useState<Record<string, string[]> | null>(null)
  const [dirty, setDirty] = useState(false)
  const [off, setOff] = useState("")
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => {
    if (data && !dirty) setAvail(data.availability)
  }, [data, dirty])
  if (!data) return <Card>{error ? <p className="text-sm text-red-300">{error}</p> : <div className="h-24 rounded-2xl bg-white/[0.04] animate-pulse" />}</Card>
  const windows = data.windows
  const has = (day: number, w: string) => (avail ? Boolean(avail[String(day)]?.includes(w)) : true)
  const toggle = (day: number, w: string) => {
    setDirty(true)
    setAvail((a) => {
      const base = a ?? Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [...windows]]))
      const cur = base[String(day)] ?? []
      const next = { ...base, [String(day)]: cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w] }
      if (!next[String(day)].length) delete next[String(day)]
      return next
    })
  }
  const put = async (key: string, body: Record<string, unknown>, after?: () => void) => {
    setBusy(key)
    setMsg(null)
    try {
      await api("/api/v1/pro/availability", body, "PUT")
      setMsg({ ok: true, text: T.saved[lang] })
      after?.()
      setDirty(false)
      await load()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy("")
    }
  }
  const short = (w: string) => w.replace(/\s?(am|pm)/g, "").replace("–", "-")
  return (
    <Card>
      <Title lang={lang}>{T.availability[lang]}</Title>
      {msg && <p className={cn("mb-3 rounded-2xl px-4 py-2 text-sm", msg.ok ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-200")}>{msg.text}</p>}
      <p className={cn("font-medium text-sm", ur)}>{T.weekly[lang]}</p>
      <p className={cn("text-xs text-white/45 mt-0.5", ur)}>{avail ? T.ticked[lang] : T.everyWindow[lang]}</p>
      <div className="mt-3 space-y-2">
        {WEEKDAYS[lang].map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={cn("w-12 shrink-0 text-xs text-white/60", ur)}>{d}</span>
            <div className="flex-1 grid grid-cols-6 gap-1">
              {windows.map((w) => (
                <button key={w} type="button" onClick={() => toggle(i, w)} aria-pressed={has(i, w)} aria-label={`${WEEKDAYS.en[i]} ${w}`} className={cn("h-8 rounded-lg text-[10px] tabular-nums transition-colors", has(i, w) ? "bg-[var(--brand)] text-black" : "bg-white/[0.06] text-white/40")}>
                  {short(w)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Btn variant="brand" size="sm" disabled={!dirty} busy={busy === "weekly"} onClick={() => put("weekly", { availability: avail })}>
          <span className={ur}>{T.save[lang]}</span>
        </Btn>
        {avail && (
          <button
            type="button"
            className={cn("text-xs underline text-white/60", ur)}
            onClick={() => {
              setDirty(true)
              setAvail(null)
            }}
          >
            {T.clearAll[lang]}
          </button>
        )}
      </div>

      <p className={cn("font-medium text-sm mt-6", ur)}>{T.daysOff[lang]}</p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {data.timeOff.map((d) => (
          <span key={d} className="h-9 pl-3 pr-1 rounded-full bg-white/[0.08] text-xs inline-flex items-center gap-1">
            {dayLabel(d, lang)}
            <button type="button" aria-label={`Remove ${d}`} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center" onClick={() => put(`rm-${d}`, { timeOff: { remove: [d] } })}>
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        {!data.timeOff.length && <span className={cn("text-xs text-white/45", ur)}>{T.noDaysOff[lang]}</span>}
      </div>
      <div className="flex gap-2 mt-3">
        <input type="date" value={off} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setOff(e.target.value)} aria-label={T.daysOff.en} className="h-11 flex-1 min-w-0 rounded-2xl bg-white/[0.07] border border-white/10 px-4 text-sm outline-none focus:border-[var(--brand)] [color-scheme:dark]" />
        <Btn variant="light" size="sm" className="h-11" disabled={!off} busy={busy === "off"} onClick={() => put("off", { timeOff: { add: [off] } }, () => setOff(""))}>
          <span className={ur}>{T.addDayOff[lang]}</span>
        </Btn>
      </div>
      <p className={cn("text-xs text-white/40 mt-2", ur)}>{T.busyHint[lang]}</p>
      <p className={cn("text-xs text-white/40 mt-4", ur)}>
        {T.mostADay[lang]}: {data.dailyCap}
      </p>
    </Card>
  )
}
