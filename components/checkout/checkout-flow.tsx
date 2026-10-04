"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Banknote, Check, ClipboardCheck, Gift, Loader2, Lock, MessageCircle, ShieldCheck, ShoppingBag, Smartphone, Zap } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { getRef, submit, track } from "@/lib/site"
import { cartTotal, useCart, useLocation } from "@/lib/store"
import { getBookings, nextDays, saveBooking, windowAvailable, WINDOW_LABELS } from "@/lib/bookings"
import { cn } from "@/lib/utils"
import { clearBrief, loadBrief, type SavedBrief } from "@/lib/client/brief"
import { Field, inputCls } from "@/components/site/forms"
import { PK_PHONE, normalisePhone } from "@/components/site/notify-form"
import { CartLines, MinOrderBar } from "@/components/site/cart-drawer"
import { EASE } from "@/components/site/primitives"
import { useCatalog, useSite } from "@/components/cms/provider"

const PAYMENTS = [
  { id: "cash", label: "Cash", sub: "Pay your pro after the service", icon: Banknote },
  { id: "jazzcash", label: "JazzCash", sub: "Send after the service", icon: Smartphone },
  { id: "easypaisa", label: "Easypaisa", sub: "Send after the service", icon: Smartphone },
  { id: "raast", label: "Raast", sub: "Instant bank transfer after", icon: Zap },
] as const

type Errors = Partial<Record<"area" | "address" | "date" | "window" | "name" | "phone" | "cart", string>>

function Step({ n, title, done, children, id }: { n: number; title: string; done: boolean; children: React.ReactNode; id: string }) {
  return (
    <section id={id} className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-8 scroll-mt-28">
      <div className="flex items-center gap-3 mb-6">
        <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors", done ? "bg-brand text-foreground" : "bg-foreground text-background")}>
          {done ? <Check className="w-4 h-4" strokeWidth={3} /> : n}
        </span>
        <h2 className="font-serif text-2xl sm:text-3xl">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function CheckoutFlow() {
  const { MIN_ORDER, getArea, liveAreas } = useCatalog()
  const { policy, referral, whatsappLink } = useSite()
  const router = useRouter()
  const { items, clear } = useCart()
  const loc = useLocation()
  const [mounted, setMounted] = useState(false)
  const [area, setArea] = useState("")
  const [subArea, setSubArea] = useState("")
  const [address, setAddress] = useState("")
  const [landmark, setLandmark] = useState("")
  const [date, setDate] = useState("")
  const [win, setWin] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [payment, setPayment] = useState("cash")
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState("")
  const [ref, setRef] = useState<string | null>(null)
  const [brief, setBrief] = useState<SavedBrief | null>(null)
  const [sendBrief, setSendBrief] = useState(true)
  const started = useRef(false)
  const days = useMemo(() => nextDays(7), [])

  useEffect(() => {
    setMounted(true)
    let mine: string | null = null
    try {
      mine = localStorage.getItem("mjazo-my-ref")
    } catch {}
    const r = getRef()
    if (r && r !== mine && getBookings().length === 0) setRef(r)
    const a = loc.area && getArea(loc.area)?.status === "live" ? loc.area : ""
    setArea(a)
    setSubArea(a ? loc.subArea ?? "" : "")
    try {
      const saved = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
      if (saved.name) setName(saved.name)
      if (saved.phone) setPhone(saved.phone)
      if (saved.address && saved.area === a) setAddress(saved.address)
      if (saved.landmark && saved.area === a) setLandmark(saved.landmark)
      // A Ghar Scan diagnosis or Glam Mirror Look Card travels with the booking to the pro.
      const b = loadBrief()
      if (b) setBrief(b)
      // Older Look Cards (saved before briefs) go into the notes.
      const look = JSON.parse(localStorage.getItem("mjazo-look") ?? "null")
      if (!b && look?.title && Date.now() - (look.at ?? 0) < 14 * 86400000) setNotes((n) => n || `Look card: ${look.title}. ${look.brief ?? ""}`.trim())
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const list = mounted ? items : []
  const subtotal = cartTotal(list)
  const discount = ref && subtotal > 0 ? Math.min(referral.friendOff, subtotal) : 0
  const total = subtotal - discount
  useEffect(() => {
    if (mounted && list.length && !started.current) {
      started.current = true
      track("start_checkout", { total, items: list.length })
    }
  }, [mounted, list.length, total])

  const areaObj = area ? getArea(area) : undefined
  const done = {
    where: !!area && address.trim().length >= 5,
    when: !!date && !!win,
    who: name.trim().length >= 2 && PK_PHONE.test(normalisePhone(phone)),
    pay: !!payment,
  }

  const place = async () => {
    const e: Errors = {}
    if (!area) e.area = "Choose your area"
    if (address.trim().length < 5) e.address = "Add your house number and street"
    if (!date) e.date = "Pick a date"
    if (!win) e.window = "Pick a time window"
    if (name.trim().length < 2) e.name = "Enter your name"
    if (!PK_PHONE.test(normalisePhone(phone))) e.phone = "Enter a Pakistani mobile number, e.g. 0300 1234567"
    if (subtotal < MIN_ORDER) e.cart = `Minimum per visit is ${formatPKR(MIN_ORDER)}`
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) {
      const target = first === "area" || first === "address" ? "step-where" : first === "date" || first === "window" ? "step-when" : first === "cart" ? "summary" : "step-who"
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    setBusy(true)
    setServerError("")
    try {
      const data = {
        name: name.trim(),
        phone: normalisePhone(phone),
        area,
        subArea: subArea || undefined,
        address: address.trim(),
        landmark: landmark.trim() || undefined,
        date,
        window: win,
        payment: payment as "cash",
        notes: [notes.trim(), ref ? `Referral ${ref}: ${formatPKR(discount)} off` : ""].filter(Boolean).join(" · ") || undefined,
        items: list.map((i) => ({ name: i.name, category: i.category, service: i.service, options: i.options, addOns: i.addOns.map((a) => a.name), qty: i.qty, unitPrice: i.unitPrice })),
        total,
        brief: brief && sendBrief ? { kind: brief.kind, title: brief.title, text: brief.text, causes: brief.causes, parts: brief.parts, pins: brief.pins, hasPhotos: brief.photos.length > 0 } : undefined,
      }
      const { id } = await submit("booking", data)
      if (brief && sendBrief) {
        // Photos for the pro: best effort, the booking is already placed.
        if (brief.photos.length) await fetch("/api/booking/attach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId: id, phone: data.phone, photos: brief.photos.slice(0, 3) }) }).catch(() => {})
        clearBrief()
      }
      saveBooking({ id, createdAt: new Date().toISOString(), ...data, areaName: areaObj?.name ?? area, items: list })
      try {
        localStorage.setItem("mjazo-contact", JSON.stringify({ name: data.name, phone: data.phone, area, address: data.address, landmark: data.landmark }))
      } catch {}
      track("submit_booking", { id, total, payment, area })
      clear()
      router.push(`/booking/confirmed?id=${encodeURIComponent(id)}`)
    } catch (err) {
      setServerError((err as Error).message)
      setBusy(false)
    }
  }

  const waMessage = useMemo(() => {
    const lines = list.map((i) => `• ${i.name}${i.options.length ? ` (${i.options.join(", ")})` : ""} x${i.qty}`)
    return [`Hi Mjazo! I'd like to book:`, ...lines, `Total: ${formatPKR(total)}`, area ? `Area: ${areaObj?.name}${subArea ? `, ${subArea}` : ""}` : "", date && win ? `When: ${date}, ${win}` : ""].filter(Boolean).join("\n")
  }, [list, total, area, areaObj, subArea, date, win])

  if (mounted && list.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <ShoppingBag className="w-12 h-12 mx-auto text-zinc-300" strokeWidth={1} />
        <h1 className="font-serif text-4xl mt-6">Your cart is empty</h1>
        <p className="text-zinc-500 mt-3">Add a service first, then come back to book a time.</p>
        <Link href="/services/w/beauty-wellness" className="inline-flex mt-8 h-12 items-center rounded-full bg-foreground text-background px-6 text-sm">Browse Beauty & Wellness</Link>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
      <div className="space-y-5 min-w-0">
        <Step n={1} title="Where should we come?" done={done.where} id="step-where">
          <div className="space-y-5 min-w-0">
            <div>
              <p className="text-sm font-medium mb-2">Area</p>
              <div className="flex flex-wrap gap-2">
                {liveAreas.map((a) => (
                  <button key={a.slug} type="button" aria-pressed={area === a.slug} onClick={() => { setArea(a.slug); setSubArea(""); loc.set(a.slug, null) }} className={cn("rounded-full border h-11 px-5 text-sm transition-colors", area === a.slug ? "bg-foreground text-background border-foreground" : "border-zinc-300 hover:border-zinc-500")}>
                    {a.name}
                  </button>
                ))}
                <Link href="/karachi" className="h-11 px-4 text-sm text-zinc-500 underline underline-offset-4 flex items-center">Somewhere else?</Link>
              </div>
              {errors.area && <p className="text-xs text-destructive mt-2">{errors.area}</p>}
            </div>
            {areaObj && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.3, ease: EASE }}>
                <p className="text-sm font-medium mb-2">{areaObj.name} sub-area</p>
                <div className="flex flex-wrap gap-2">
                  {areaObj.subAreas.map((s) => (
                    <button key={s} type="button" aria-pressed={subArea === s} onClick={() => { setSubArea(s); loc.set(area, s) }} className={cn("rounded-full border h-9 px-4 text-sm transition-colors", subArea === s ? "bg-brand border-brand" : "border-zinc-300 hover:border-zinc-500")}>{s}</button>
                  ))}
                </div>
              </motion.div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="House no. & street" error={errors.address}>
                <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" placeholder="e.g. 24-C, Khayaban-e-Ittehad" aria-invalid={!!errors.address} />
              </Field>
              <Field label="Landmark (optional)">
                <input className={inputCls} value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Near…" />
              </Field>
            </div>
          </div>
        </Step>

        <Step n={2} title="When suits you?" done={done.when} id="step-when">
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {days.map((d) => (
              <button key={d.iso} type="button" aria-pressed={date === d.iso} onClick={() => { setDate(d.iso); if (win && !windowAvailable(d.iso, WINDOW_LABELS.indexOf(win), policy.leadHours)) setWin("") }} className={cn("shrink-0 w-[76px] rounded-2xl border py-3 text-center transition-colors", date === d.iso ? "bg-foreground text-background border-foreground" : "border-zinc-200 hover:border-zinc-400")}>
                <span className={cn("block text-xs", date === d.iso ? "text-white/70" : "text-zinc-500")}>{d.label}</span>
                <span className="block text-2xl font-light leading-tight">{d.day}</span>
                <span className={cn("block text-xs", date === d.iso ? "text-white/70" : "text-zinc-500")}>{d.month}</span>
              </button>
            ))}
          </div>
          {errors.date && <p className="text-xs text-destructive mt-2">{errors.date}</p>}
          <p className="text-sm font-medium mt-6 mb-2">Arrival window</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {WINDOW_LABELS.map((w, i) => {
              const ok = !date || windowAvailable(date, i, policy.leadHours)
              return (
                <button key={w} type="button" disabled={!ok} aria-pressed={win === w} onClick={() => setWin(w)} className={cn("rounded-2xl border h-12 text-sm transition-colors disabled:opacity-35 disabled:line-through", win === w ? "bg-foreground text-background border-foreground" : "border-zinc-200 hover:border-zinc-400")}>
                  {w}
                </button>
              )
            })}
          </div>
          {errors.window && <p className="text-xs text-destructive mt-2">{errors.window}</p>}
          <p className="text-xs text-zinc-500 mt-3">Your pro arrives within the window. Free changes up to {policy.freeChangeHours} hours before.</p>
        </Step>

        <Step n={3} title="Who are we visiting?" done={done.who} id="step-who">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Your name" error={errors.name}>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} />
            </Field>
            <Field label="WhatsApp number" error={errors.phone} hint="We'll confirm your booking here.">
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" aria-invalid={!!errors.phone} />
            </Field>
            {brief && (
              <div className="sm:col-span-2 rounded-2xl border border-zinc-200 p-4 flex gap-4 items-start">
                {brief.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brief.photos[0]} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                ) : (
                  <span className="w-16 h-16 rounded-xl bg-brand-soft flex items-center justify-center shrink-0"><ClipboardCheck className="w-6 h-6 text-brand-ink" /></span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">{brief.kind === "scan" ? "Ghar Scan brief for your technician" : "Look Card for your pro"}</p>
                  <p className="font-medium truncate" dir="auto">{brief.title}</p>
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={sendBrief} onChange={(e) => setSendBrief(e.target.checked)} className="w-4 h-4 accent-black" />
                    Send it{brief.photos.length ? ` with ${brief.photos.length} photo${brief.photos.length > 1 ? "s" : ""}` : ""} to my pro (photos are deleted after the visit)
                  </label>
                </div>
              </div>
            )}
            <Field label="Notes for your pro (optional)" className="sm:col-span-2">
              <textarea className={cn(inputCls, "h-24 py-3")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, a favourite pro, parking tips…" />
            </Field>
          </div>
        </Step>

        <Step n={4} title="How will you pay?" done={done.pay} id="step-pay">
          <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
            {PAYMENTS.map((p) => {
              return (
                <button key={p.id} type="button" role="radio" aria-checked={payment === p.id} onClick={() => setPayment(p.id)} className={cn("flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors", payment === p.id ? "border-foreground ring-1 ring-foreground" : "border-zinc-200 hover:border-zinc-400")}>
                  <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center", payment === p.id ? "bg-brand" : "bg-zinc-100")}><p.icon className="w-5 h-5" strokeWidth={1.5} /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="block text-xs text-zinc-500">{p.sub}</span>
                  </span>
                  <span className={cn("w-5 h-5 rounded-full border-2 transition-colors", payment === p.id ? "border-foreground bg-foreground shadow-[inset_0_0_0_3px_white]" : "border-zinc-300")} />
                </button>
              )
            })}
          </div>
          <p className="text-xs text-zinc-500 mt-4 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Nothing to pay now. You pay after your service, once you're happy.</p>
        </Step>
      </div>

      {/* Summary */}
      <aside id="summary" className="lg:sticky lg:top-28 space-y-4 scroll-mt-28 min-w-0">
        <div className="rounded-3xl bg-white border border-zinc-200 p-6">
          <p className="font-serif text-2xl">Your booking</p>
          <CartLines items={list} />
          <div className="pt-4 border-t border-zinc-100 space-y-2 text-sm">
            <div className="flex justify-between text-zinc-500"><span>Visit fee</span><span>Free</span></div>
            {discount > 0 && <div className="flex justify-between text-brand-ink"><span className="flex items-center gap-1.5"><Gift className="w-4 h-4" />Friend's welcome ({ref})</span><span>− {formatPKR(discount)}</span></div>}
            <div className="flex justify-between text-base"><span>Total</span><span className="font-medium">{formatPKR(total)}</span></div>
          </div>
          <div className="mt-4"><MinOrderBar total={subtotal} /></div>
          {errors.cart && <p className="text-xs text-destructive mt-2">{errors.cart}</p>}
          <button onClick={place} disabled={busy} className="mt-6 w-full h-14 rounded-full bg-foreground text-background text-base font-medium flex items-center justify-center gap-2 hover:bg-brand hover:text-foreground transition-colors disabled:opacity-60">
            {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Booking…</> : "Confirm booking"}
          </button>
          {serverError && <p className="text-sm text-destructive mt-3 text-center">{serverError}</p>}
          <p className="text-xs text-zinc-500 mt-3 text-center">By confirming you agree to our <Link href="/terms" className="underline">terms</Link> and <Link href="/cancellation-refund" className="underline">cancellation policy</Link>.</p>
        </div>
        <a href={whatsappLink(waMessage)} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { placement: "checkout_request", total })} className="flex items-center gap-3 rounded-3xl bg-[#25D366]/10 p-5 text-sm hover:bg-[#25D366]/20 transition-colors">
          <MessageCircle className="w-5 h-5 text-[#128C7E] shrink-0" />
          <span><b>Prefer to chat?</b> Send this cart to us on WhatsApp and we'll book it for you.</span>
        </a>
        <div className="flex items-center gap-2 text-xs text-zinc-500 px-2"><ShieldCheck className="w-4 h-4" />Women-only beauty pros · CNIC-verified · Sealed kits</div>
      </aside>

      {/* Phones: confirm without scrolling back to the summary */}
      <div className="lg:hidden fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2">
        <div className="flex items-center gap-3 rounded-full bg-white/95 backdrop-blur border border-zinc-200 shadow-lg pl-5 pr-1.5 py-1.5">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-zinc-500">Total · pay after</p>
            <p className="text-sm font-medium">{formatPKR(total)}</p>
          </div>
          <button onClick={place} disabled={busy} className="h-11 px-5 rounded-full bg-foreground text-background text-sm font-medium disabled:opacity-60 flex items-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Confirm booking
          </button>
        </div>
      </div>
    </div>
  )
}
