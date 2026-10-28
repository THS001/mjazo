"use client"

import Link from "@/components/site/locale-link"
import { useRouter } from "@/components/site/locale-link"
import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, CalendarCheck, Check, Crown, Gift, LifeBuoy, Loader2, MapPin as MapIcon, Pencil, ReceiptText, Repeat, RotateCcw, Star, Trash2, Wallet, X } from "lucide-react"
import { formatAmount, formatPKR } from "@/lib/catalog"
import { receiptPath } from "@/lib/receipts"
import { formatBookingDate, nextDays, windowAvailable, windowLabel, WINDOW_LABELS } from "@/lib/bookings"
import { ACCOUNT_EVENT, customerApi, CustomerApiError, deviceBookingIds, sendPhoneCode, signOut, signOutEverywhere, type CodeSent, type Me, type PhoneChannels } from "@/lib/client/customer"
import type { Address } from "@/lib/core/customers"
import type { CustomerBooking, CustomerPackView } from "@/lib/server/customer-api"
import { useCart } from "@/lib/store"
import { track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { Field, inputCls } from "@/components/site/forms"
import { PK_PHONE, normalisePhone } from "@/components/site/notify-form"
import { RateVisit, isRated } from "@/components/site/rate-visit"
import { fill, useCatalog, useLocale, useSite, useT } from "@/components/cms/provider"
import { MapPin, type Pin } from "./map-pin"
import { GiftRedeem, plusLine, ReferCard } from "./growth-views"
import { CodeStep, codeProblem, defaultVia, type Via } from "./phone-code"

// The signed-in client account: adding the phone number, live bookings (with their steps and
// changes within the policy), credit and saved addresses with a map pin. Every call goes through
// /api/v1/customer, the API the phone app will use too.

const BEAUTY = ["womens-salon", "hair", "makeup-mehndi", "nails-lashes", "spa-women"]
const card = "rounded-3xl bg-white border border-zinc-200"

export function SignInPrompt({ className }: { className?: string }) {
  const m = useT().myAccount
  return (
    <div className={cn(card, "p-6 flex flex-col sm:flex-row sm:items-center gap-4", className)}>
      <p className="flex-1 text-sm text-zinc-600">{m.signInToSee}</p>
      <Link href="/login" className="h-11 px-5 rounded-full bg-foreground text-background text-sm flex items-center justify-center shrink-0">
        {m.signIn}
      </Link>
    </div>
  )
}

export function AccountBar({ me }: { me: Me }) {
  const m = useT().myAccount
  const phone = me.by === "phone" ? me.customer?.phone : null
  return (
    <p className="text-sm text-zinc-500 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
      {phone ? <span dir="ltr">{fill(m.signedInPhone, { phone })}</span> : me.email && <span>{fill(m.signedInAs, { email: me.email })}</span>}
      <button onClick={() => void signOut()} className="underline underline-offset-4 hover:text-black">
        {m.signOut}
      </button>
      {me.customer && (
        <button onClick={() => void signOutEverywhere()} className="underline underline-offset-4 hover:text-black">
          {m.signOutAll}
        </button>
      )}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Adding the phone number
// ---------------------------------------------------------------------------

export function PhoneLink({ me }: { me: Me }) {
  const t = useT()
  const m = t.myAccount
  const locale = useLocale()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [proof, setProof] = useState("")
  const [needProof, setNeedProof] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // A number with bookings can also be proven with a code sent to it, where codes are set up.
  const [channels, setChannels] = useState<PhoneChannels>(null)
  const [sent, setSent] = useState<CodeSent | null>(null)
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
      if (c.name) setName(c.name)
      if (c.phone) setPhone(c.phone)
    } catch {}
    fetch("/api/v1/config")
      .then((r) => r.json())
      .then((c) => setChannels(c.phoneSignIn ?? null), () => {})
  }, [])
  const link = async (code?: string) => {
    if (name.trim().length < 2) return setError(t.checkout.errName)
    if (!PK_PHONE.test(normalisePhone(phone))) return setError(t.notify.errPhone)
    setBusy(true)
    setError("")
    try {
      await customerApi("/api/v1/customer/me/link", { name: name.trim(), phone: normalisePhone(phone), proof: [...deviceBookingIds(), proof.trim()].filter(Boolean), ...(code ? { code } : {}) })
      track("account_linked", { by: code ? "code" : "proof" })
      window.dispatchEvent(new Event(ACCOUNT_EVENT))
    } catch (err) {
      const code = err instanceof CustomerApiError ? err.code : undefined
      if (code === "proof") setNeedProof(true)
      setError(code === "proof" ? (proof ? m.proofSub : "") : code === "taken" ? m.linkTaken : code === "hasPhone" ? m.hasPhone : code === "slow" ? m.tooMany : codeProblem(err, t, channels))
      setBusy(false)
    }
  }
  const sendCode = async (via: Via) => {
    if (!channels) return
    setBusy(true)
    setError("")
    try {
      setSent(await sendPhoneCode(normalisePhone(phone), via, locale))
    } catch (err) {
      setError(codeProblem(err, t, channels))
    } finally {
      setBusy(false)
    }
  }
  if (sent && channels)
    return (
      <div className={cn(card, "p-6 sm:p-8 max-w-xl")}>
        <AccountBar me={me} />
        <h2 className="font-serif text-3xl">{m.phoneTitle}</h2>
        <CodeStep phone={normalisePhone(phone)} sent={sent} channels={channels} busy={busy} error={error} submitLabel={m.continue} onCode={(c) => void link(c)} onResend={(via) => void sendCode(via)} onBack={() => (setSent(null), setError(""))} />
      </div>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void link()
      }}
      className={cn(card, "p-6 sm:p-8 max-w-xl")}
      noValidate
    >
      <AccountBar me={me} />
      <h2 className="font-serif text-3xl">{m.phoneTitle}</h2>
      <p className="text-sm text-zinc-500 mt-2">{m.phoneSub}</p>
      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Field label={t.form.name}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label={t.form.phone}>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" />
        </Field>
        {needProof && (
          <Field label={m.proofLabel} className="sm:col-span-2" hint={m.proofSub}>
            <input className={inputCls} value={proof} onChange={(e) => setProof(e.target.value.toUpperCase())} placeholder="MJ-…" />
          </Field>
        )}
      </div>
      {needProof && channels && (
        <button type="button" onClick={() => void sendCode(defaultVia(channels))} disabled={busy} className="mt-3 text-sm underline underline-offset-4">
          {m.proofByCode}
        </button>
      )}
      {error && <p className="text-sm text-destructive mt-3">{error}</p>}
      <button disabled={busy} className="mt-6 h-12 px-6 rounded-full bg-foreground text-background disabled:opacity-60 flex items-center gap-2">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} {m.continue}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function LiveOverview({ me }: { me: Me }) {
  const a = useT().account
  const m = useT().myAccount
  const locale = useLocale()
  const [next, setNext] = useState<CustomerBooking | null | undefined>(undefined)
  const [addresses, setAddresses] = useState<number | null>(null)
  const [packs, setPacks] = useState<string | null>(null)
  const p = useT().packs
  useEffect(() => {
    customerApi<{ upcoming: CustomerBooking[] }>("/api/v1/customer/bookings").then((r) => setNext(r.upcoming[0] ?? null), () => setNext(null))
    customerApi<{ addresses: Address[] }>("/api/v1/customer/addresses").then((r) => setAddresses(r.addresses.length), () => setAddresses(0))
    // Their pack in use (visits left), or one waiting for payment, or what packs are.
    customerApi<{ mine: CustomerPackView[] }>("/api/v1/customer/packs").then(
      (r) => {
        const k = r.mine.find((x) => x.status === "active" && !x.expired && x.left > 0) ?? r.mine.find((x) => x.status === "requested")
        setPacks(k ? `${k.name}: ${k.status === "requested" ? fill(p.waiting, { total: formatPKR(k.total) }) : fill(p.left, { left: k.left, visits: k.visits })}` : p.sub)
      },
      () => setPacks(p.sub),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const tiles = [
    { href: "/account/bookings", icon: CalendarCheck, t: m.nextVisit, d: next === undefined ? "…" : next ? `${formatBookingDate(next.date, locale)} · ${windowLabel(next.window, locale)}` : m.noUpcoming },
    { href: "/account/bookings", icon: Wallet, t: m.credit, d: me.credit.available > 0 ? fill(m.creditSub, { amount: formatPKR(me.credit.available) }) : m.noCredit },
    { href: "/account/addresses", icon: MapIcon, t: m.addresses, d: addresses === null ? "…" : addresses ? fill(m.addressCount, { count: addresses }) : m.addAddress },
    { href: "/home-pulse", icon: CalendarCheck, t: a.homePulse, d: a.homePulseSub },
    { href: "/account/packs", icon: Repeat, t: p.title, d: packs ?? "…" },
    { href: "/plus", icon: Crown, t: a.plus, d: plusLine(me, m, locale) ?? a.plusSub },
    { href: "/refer", icon: Gift, t: a.refer, d: me.referral ? `${m.referTitle}: ${me.referral.code}` : a.referSub },
    { href: "/help", icon: LifeBuoy, t: a.help, d: a.helpSub },
  ]
  return (
    <>
      <AccountBar me={me} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((x) => (
          <Link key={x.t} href={x.href} className={cn(card, "group p-6 hover:border-zinc-400 transition-colors")}>
            <div className="flex justify-between">
              <x.icon className="w-6 h-6" strokeWidth={1.5} />
              <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-black rtl:-scale-x-100" />
            </div>
            <p className="font-medium mt-8">{x.t}</p>
            <p className="text-sm text-zinc-500 truncate">{x.d}</p>
          </Link>
        ))}
      </div>
      {me.customer && (
        <div className="mt-4 grid lg:grid-cols-2 gap-4">
          <ReferCard me={me} />
          <GiftRedeem />
        </div>
      )}
      {me.customer && <MessagesSwitch initial={me.customer.marketingOk} />}
    </>
  )
}

/** Win-back and offer messages: off until the customer switches them on (Reply STOP turns them off). */
function MessagesSwitch({ initial }: { initial: boolean }) {
  const m = useT().myAccount
  const [on, setOn] = useState(initial)
  const [busy, setBusy] = useState(false)
  const flip = async () => {
    setBusy(true)
    try {
      const r = await customerApi<{ customer: { marketingOk: boolean } }>("/api/v1/customer/me", { marketingOk: !on }, "PATCH")
      setOn(r.customer.marketingOk)
      track("messages_opt_in", { on: r.customer.marketingOk })
    } catch {
      // Unchanged; the switch shows what's saved.
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={cn(card, "mt-4 p-6 flex items-start gap-4")}>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{m.messagesTitle}</p>
        <p className="text-sm text-zinc-500 mt-1">{m.messagesSub}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={m.messagesTitle}
        disabled={busy}
        onClick={flip}
        className={cn("relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60", on ? "bg-black" : "bg-zinc-300")}
      >
        <span className="sr-only">{on ? m.messagesOn : m.messagesOff}</span>
        <span className={cn("absolute top-1 start-1 w-5 h-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5 rtl:-translate-x-5")} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bookings, live
// ---------------------------------------------------------------------------

export function LiveBookings({ me }: { me: Me }) {
  const a = useT().account
  const m = useT().myAccount
  const [data, setData] = useState<{ upcoming: CustomerBooking[]; past: CustomerBooking[] } | null>(null)
  const [error, setError] = useState("")
  const load = () => customerApi<{ upcoming: CustomerBooking[]; past: CustomerBooking[] }>("/api/v1/customer/bookings").then(setData, (e) => setError((e as Error).message))
  useEffect(() => {
    void load()
    // Keep the steps live while the page is open.
    const id = setInterval(() => document.visibilityState === "visible" && void load(), 30000)
    return () => clearInterval(id)
  }, [])
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <div className="h-40 rounded-3xl bg-white border border-zinc-200 animate-pulse" />
  if (!data.upcoming.length && !data.past.length)
    return (
      <>
        <AccountBar me={me} />
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="font-serif text-3xl">{a.noBookings}</p>
          <p className="text-zinc-500 mt-2">{a.noBookingsSub}</p>
          <Link href="/services/w/beauty-wellness" className="inline-flex mt-6 h-12 px-6 items-center rounded-full bg-foreground text-background">
            {a.bookService}
          </Link>
        </div>
      </>
    )
  return (
    <>
      <AccountBar me={me} />
      {[
        { title: m.upcomingTitle, list: data.upcoming },
        { title: m.pastTitle, list: data.past },
      ]
        .filter((g) => g.list.length)
        .map((g) => (
          <section key={g.title} className="mb-10">
            <h2 className="font-serif text-3xl mb-4">{g.title}</h2>
            <ul className="space-y-4">
              {g.list.map((b) => (
                <BookingCard key={b.id} b={b} phone={me.customer?.phone ?? ""} onChanged={load} />
              ))}
            </ul>
          </section>
        ))}
    </>
  )
}

const STEPS = [
  ["booked", "stepBooked"],
  ["assigned", "stepAssigned"],
  ["onTheWay", "stepOnTheWay"],
  ["arrived", "stepArrived"],
  ["done", "stepDone"],
] as const

function BookingCard({ b, phone, onChanged }: { b: CustomerBooking; phone: string; onChanged: () => void }) {
  const t = useT()
  const a = t.account
  const m = t.myAccount
  const pk = t.packs
  const locale = useLocale()
  const { whatsappLink } = useSite()
  const [mode, setMode] = useState<"" | "move" | "cancel">("")
  const [msg, setMsg] = useState("")
  const time = (iso: string) => new Date(iso).toLocaleString(locale === "ur" ? "ur-PK" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })
  const ended = ["cancelled", "no_show"].includes(b.status)
  const open = !ended && b.status !== "completed"
  return (
    <li className={cn(card, "p-6")}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={cn("text-[11px] rounded-full px-2.5 py-1", ended ? "bg-zinc-100 text-zinc-500" : b.status === "completed" ? "bg-emerald-50 text-emerald-800" : "bg-brand-soft text-brand-ink")}>
          {b.status === "cancelled" ? m.statusCancelled : b.status === "no_show" ? m.statusMissed : b.status === "completed" ? m.stepDone : a.upcoming}
        </span>
        <span className="text-xs text-zinc-400">{b.id}</span>
      </div>
      <p className="font-medium">{b.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(locale === "ur" ? "، " : ", ")}</p>
      <p className="text-sm text-zinc-500 mt-1">
        {formatBookingDate(b.date, locale)} · {windowLabel(b.window, locale)} · {[b.subArea, b.areaName].filter(Boolean).join(locale === "ur" ? "، " : ", ")}
      </p>

      {!ended && (
        <ol className="mt-5 grid grid-cols-5 gap-1" aria-label="Progress">
          {STEPS.map(([k, label]) => {
            const done = Boolean(b.steps[k])
            return (
              <li key={k} className="min-w-0">
                <span className={cn("block h-1.5 rounded-full", done ? "bg-brand" : "bg-zinc-200")} />
                <span className={cn("block mt-1.5 text-[11px] leading-tight", done ? "text-black" : "text-zinc-400")}>{m[label]}</span>
              </li>
            )
          })}
        </ol>
      )}

      <div className="mt-4 text-sm text-zinc-600 space-y-1">
        {b.pro && open && <p>{fill(m.yourPro, { name: b.pro.firstName })}</p>}
        {b.eta && ["assigned", "en_route"].includes(b.status) && <p>{fill(m.eta, { time: b.eta })}</p>}
        {b.live && b.status === "en_route" && b.live.minutes !== null && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{fill(m.liveAway, { name: b.pro?.firstName ?? "", minutes: b.live.minutes, km: b.live.km ?? "" })}</span>
            <a href={`https://www.google.com/maps/search/?api=1&query=${b.live.lat},${b.live.lng}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              {m.liveMap}
            </a>
          </p>
        )}
        {b.askedFor && !b.pro && open && <p>{fill(m.askedFor, { name: b.askedFor.firstName })}</p>}
        <p>
          <span className="font-medium text-black">{formatPKR(b.total)}</span>
          {(b.credit > 0 || b.pack) && !ended && (
            <>
              {b.pack && ` · ${pk.paidFromPack} (${b.pack.name}): ${formatPKR(b.pack.paid)}`}
              {b.credit > 0 && ` · ${fill(m.creditPaid, { amount: formatPKR(b.credit) })}`}
              {" · "}
              {fill(m.toPayAfter, { amount: formatAmount(b.due) })}
            </>
          )}
        </p>
        {b.changeUntil && open && <p className="text-xs text-zinc-500">{b.canChange ? fill(m.changeUntil, { time: time(b.changeUntil) }) : m.tooLate}</p>}
      </div>

      {msg && <p className="mt-3 rounded-2xl bg-emerald-50 text-emerald-800 px-4 py-2 text-sm">{msg}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {b.canChange && (
          <>
            <button onClick={() => setMode(mode === "move" ? "" : "move")} className="h-10 px-4 rounded-full border border-zinc-300 text-sm hover:border-black">
              {m.changeTime}
            </button>
            <button onClick={() => setMode(mode === "cancel" ? "" : "cancel")} className="h-10 px-4 rounded-full border border-zinc-300 text-sm text-red-700 hover:border-red-700">
              {m.cancel}
            </button>
          </>
        )}
        {open && !b.canChange && b.changeUntil && (
          <a href={whatsappLink(`Assalam o Alaikum, about my booking ${b.id}.`)} target="_blank" rel="noopener noreferrer" className="h-10 px-4 rounded-full border border-zinc-300 text-sm flex items-center">
            WhatsApp
          </a>
        )}
        {(b.status === "completed" || ended) && <BookAgain b={b} />}
        {b.receipt?.url && (
          <a href={receiptPath(b.receipt.url)} target="_blank" rel="noopener" className="h-10 px-4 rounded-full border border-zinc-300 text-sm flex items-center gap-1.5 hover:border-black">
            <ReceiptText className="w-4 h-4" /> {t.receipt.open}
          </a>
        )}
        {b.status === "completed" && (
          <Link href={`/complaint?id=${b.id}`} className="text-sm text-zinc-500 underline underline-offset-4 hover:text-black">
            {a.report}
          </Link>
        )}
      </div>

      {mode === "move" && (
        <Reschedule
          b={b}
          onDone={(text) => {
            setMode("")
            setMsg(text)
            onChanged()
          }}
        />
      )}
      {mode === "cancel" && (
        <CancelBox
          b={b}
          onKeep={() => setMode("")}
          onDone={() => {
            setMode("")
            setMsg(m.cancelledDone)
            onChanged()
          }}
        />
      )}

      {b.status === "completed" && !b.rating && phone && !isRated(b.id) && (
        <div className="border-t border-zinc-100 pt-4 mt-4">
          <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
            <Star className="w-4 h-4" /> {a.howWas}
          </p>
          <RateVisit bookingId={b.id} phone={phone} beauty={b.items.some((i) => BEAUTY.includes(i.category))} />
        </div>
      )}
    </li>
  )
}

function BookAgain({ b }: { b: CustomerBooking }) {
  const m = useT().myAccount
  const { getCategory, getService } = useCatalog()
  const add = useCart((s) => s.add)
  const router = useRouter()
  const go = () => {
    b.items.forEach((i) => {
      for (let k = 0; k < i.qty; k++)
        add({ category: i.category, categoryName: getCategory(i.category)?.name ?? i.category, service: i.service, name: i.name, options: i.options, addOns: i.addOns.map((n) => ({ id: n, name: n, price: 0 })), unitPrice: i.unitPrice, duration: getService(i.category, i.service)?.service.duration ?? 60 })
    })
    track("rebook", { from: b.id, pro: b.rebookWith?.id ?? "" })
    router.push(b.rebookWith ? `/checkout?with=${encodeURIComponent(b.rebookWith.id)}&name=${encodeURIComponent(b.rebookWith.firstName)}` : "/checkout")
  }
  return (
    <button onClick={go} className="h-10 px-4 rounded-full bg-foreground text-background text-sm flex items-center gap-1.5">
      <RotateCcw className="w-4 h-4" /> {b.rebookWith ? fill(m.bookAgainWith, { name: b.rebookWith.firstName }) : m.bookAgain}
    </button>
  )
}

function Reschedule({ b, onDone }: { b: CustomerBooking; onDone: (text: string) => void }) {
  const t = useT()
  const m = t.myAccount
  const locale = useLocale()
  const { policy } = useSite()
  const days = useMemo(() => nextDays(7, { locale, today: t.duration.today, tomorrow: t.duration.tomorrow }), [locale, t])
  const [date, setDate] = useState("")
  const [win, setWin] = useState("")
  const [slots, setSlots] = useState<Record<string, Record<string, boolean>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    fetch("/api/v1/slots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ area: b.area, items: b.items.map((i) => ({ category: i.category, service: i.service, qty: i.qty })) }) })
      .then((r) => r.json())
      .then((r: { mode: string; days: { date: string; windows: { label: string; open: boolean }[] }[] }) => setSlots(r.mode === "capacity" ? Object.fromEntries(r.days.map((d) => [d.date, Object.fromEntries(d.windows.map((w) => [w.label, w.open]))])) : null))
      .catch(() => {})
  }, [b])
  const open = (d: string, w: string, i: number) => windowAvailable(d, i, policy.leadHours) && slots?.[d]?.[w] !== false && !(d === b.date && w === b.window)
  const move = async () => {
    setBusy(true)
    setError("")
    try {
      await customerApi(`/api/v1/customer/bookings/${encodeURIComponent(b.id)}`, { action: "reschedule", date, window: win })
      onDone(fill(m.movedDone, { date: formatBookingDate(date, locale), window: windowLabel(win, locale) }))
    } catch (e) {
      setError(e instanceof CustomerApiError && e.code === "slotFull" ? m.windowFull : (e as Error).message)
      setBusy(false)
    }
  }
  return (
    <div className="mt-4 pt-4 border-t border-zinc-100">
      <p className="text-sm font-medium mb-2">{m.pickTime}</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {days.map((d) => (
          <button key={d.iso} type="button" aria-pressed={date === d.iso} onClick={() => (setDate(d.iso), setWin(""))} className={cn("shrink-0 w-[68px] rounded-2xl border py-2 text-center", date === d.iso ? "bg-foreground text-background border-foreground" : "border-zinc-200")}>
            <span className="block text-[11px] opacity-70">{d.label}</span>
            <span className="block text-xl font-light">{d.day}</span>
          </button>
        ))}
      </div>
      {date && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {WINDOW_LABELS.map((w, i) => (
            <button key={w} type="button" disabled={!open(date, w, i)} aria-pressed={win === w} onClick={() => setWin(w)} className={cn("rounded-2xl border h-11 text-sm disabled:opacity-35", win === w ? "bg-foreground text-background border-foreground" : "border-zinc-200")}>
              {windowLabel(w, locale)}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      <button onClick={move} disabled={!date || !win || busy} className="mt-3 h-10 px-5 rounded-full bg-foreground text-background text-sm disabled:opacity-40 flex items-center gap-2">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} {m.moveIt}
      </button>
    </div>
  )
}

function CancelBox({ b, onKeep, onDone }: { b: CustomerBooking; onKeep: () => void; onDone: () => void }) {
  const m = useT().myAccount
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const go = async () => {
    setBusy(true)
    try {
      await customerApi(`/api/v1/customer/bookings/${encodeURIComponent(b.id)}`, { action: "cancel", reason: reason.trim() || undefined })
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <div className="mt-4 pt-4 border-t border-zinc-100">
      <p className="text-sm font-medium">{m.cancelTitle}</p>
      <input className={cn(inputCls, "mt-2")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={m.cancelReason} />
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button onClick={go} disabled={busy} className="h-10 px-5 rounded-full bg-red-700 text-white text-sm disabled:opacity-50 flex items-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {m.cancelYes}
        </button>
        <button onClick={onKeep} className="h-10 px-5 rounded-full border border-zinc-300 text-sm">
          {m.keep}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Saved addresses
// ---------------------------------------------------------------------------

export function AddressBook({ me }: { me: Me }) {
  const m = useT().myAccount
  const { getArea } = useCatalog()
  const [list, setList] = useState<Address[] | null>(null)
  const [editing, setEditing] = useState<Address | "new" | null>(null)
  const [error, setError] = useState("")
  const load = () => customerApi<{ addresses: Address[] }>("/api/v1/customer/addresses").then((r) => setList(r.addresses), (e) => setError((e as Error).message))
  useEffect(() => {
    void load()
  }, [])
  const act = async (fn: () => Promise<unknown>) => {
    setError("")
    try {
      await fn()
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <>
      <AccountBar me={me} />
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {list && !list.length && !editing && <p className="text-zinc-500 mb-4">{m.noAddresses}</p>}
      <ul className="grid sm:grid-cols-2 gap-4">
        {list?.map((x) => (
          <li key={x.id} className={cn(card, "p-6")}>
            <div className="flex items-center gap-2">
              <p className="font-medium flex-1">{x.label || getArea(x.area)?.name}</p>
              {x.isDefault && <span className="text-[11px] rounded-full px-2.5 py-1 bg-brand-soft text-brand-ink">{m.isDefault}</span>}
            </div>
            <p className="text-sm text-zinc-600 mt-1">{[x.line, x.landmark, x.subArea, getArea(x.area)?.name].filter(Boolean).join(", ")}</p>
            {x.lat != null && (
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                <MapIcon className="w-3.5 h-3.5" /> {x.lat.toFixed(4)}, {x.lng?.toFixed(4)}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => setEditing(x)} className="h-9 px-3 rounded-full border border-zinc-300 text-xs flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" /> {m.edit}
              </button>
              {!x.isDefault && (
                <button onClick={() => act(() => customerApi(`/api/v1/customer/addresses/${x.id}`, { ...x, isDefault: true }, "PUT"))} className="h-9 px-3 rounded-full border border-zinc-300 text-xs flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {m.makeDefault}
                </button>
              )}
              <button onClick={() => act(() => customerApi(`/api/v1/customer/addresses/${x.id}`, undefined, "DELETE"))} className="h-9 px-3 rounded-full border border-zinc-300 text-xs text-red-700 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> {m.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <AddressForm
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      ) : (
        list &&
        list.length < 10 && (
          <button onClick={() => setEditing("new")} className="mt-6 h-12 px-6 rounded-full bg-foreground text-background">
            {m.addAddress}
          </button>
        )
      )}
    </>
  )
}

export function AddressForm({ initial, onSaved, onCancel }: { initial: Address | null; onSaved: (a: Address) => void; onCancel: () => void }) {
  const t = useT()
  const m = t.myAccount
  const a = t.account
  const { getArea, liveAreas } = useCatalog()
  const [label, setLabel] = useState(initial?.label ?? "")
  const [area, setArea] = useState(initial?.area ?? "")
  const [subArea, setSubArea] = useState(initial?.subArea ?? "")
  const [line, setLine] = useState(initial?.line ?? "")
  const [landmark, setLandmark] = useState(initial?.landmark ?? "")
  const [pin, setPin] = useState<Pin | null>(initial?.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng, area: initial.area } : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const body = { label: label.trim() || null, area: pin?.area ?? area, subArea: subArea || null, line: line.trim(), landmark: landmark.trim() || null, lat: pin?.lat ?? null, lng: pin?.lng ?? null, isDefault: initial?.isDefault }
      const r = initial ? await customerApi<{ address: Address }>(`/api/v1/customer/addresses/${initial.id}`, body, "PUT") : await customerApi<{ address: Address }>("/api/v1/customer/addresses", body)
      onSaved(r.address)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  const areaObj = getArea(pin?.area ?? area)
  return (
    <form onSubmit={save} className={cn(card, "p-6 sm:p-8 mt-6 grid sm:grid-cols-2 gap-5")} noValidate>
      <div className="sm:col-span-2">
        <p className="font-medium">{m.pinTitle}</p>
        <p className="text-sm text-zinc-500 mt-1 mb-3">{m.pinSub}</p>
        <MapPin value={pin} area={area} areas={liveAreas.map((x) => x.slug)} onChange={(p) => (setPin(p), p.area && setArea(p.area))} labels={{ myLocation: m.myLocation }} />
        {pin && <p className={cn("text-sm mt-2", pin.area ? "text-brand-ink" : "text-destructive")}>{pin.area ? fill(m.pinArea, { area: getArea(pin.area)?.name ?? pin.area }) : m.pinOutside}</p>}
      </div>
      <Field label={m.label}>
        <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field label={a.area}>
        <select className={inputCls} value={pin?.area ?? area} onChange={(e) => (setArea(e.target.value), setSubArea(""))} disabled={Boolean(pin?.area)}>
          <option value="">{a.choose}</option>
          {liveAreas.map((x) => (
            <option key={x.slug} value={x.slug}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
      {areaObj && areaObj.subAreas.length > 0 && (
        <Field label={fill(t.checkout.subArea, { area: areaObj.name })}>
          <select className={inputCls} value={subArea} onChange={(e) => setSubArea(e.target.value)}>
            <option value="">{a.choose}</option>
            {areaObj.subAreas.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label={m.line}>
        <input className={inputCls} value={line} onChange={(e) => setLine(e.target.value)} autoComplete="street-address" />
      </Field>
      <Field label={a.landmark} className="sm:col-span-2">
        <input className={inputCls} value={landmark} onChange={(e) => setLandmark(e.target.value)} />
      </Field>
      {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
      <div className="sm:col-span-2 flex gap-3">
        <button disabled={busy || line.trim().length < 5 || (pin ? !pin.area : !area)} className="h-12 px-6 rounded-full bg-foreground text-background disabled:opacity-40 flex items-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {m.saveAddress}
        </button>
        <button type="button" onClick={onCancel} className="h-12 w-12 rounded-full border border-zinc-300 flex items-center justify-center" aria-label={m.keep}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}
