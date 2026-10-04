"use client"

import Link from "@/components/site/locale-link"
import { useEffect, useState } from "react"
import { ArrowUpRight, CalendarCheck, Crown, Gift, LifeBuoy, MapPin, RotateCcw } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { formatBookingDate, getBookings, karachiNow, type LocalBooking } from "@/lib/bookings"
import { track } from "@/lib/site"
import { useCart } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Field, inputCls } from "@/components/site/forms"
import { RateVisit, isRated } from "@/components/site/rate-visit"
import { useCatalog } from "@/components/cms/provider"

const BEAUTY = ["womens-salon", "hair", "makeup-mehndi", "nails-lashes", "spa-women"]

type Contact = { name?: string; phone?: string; area?: string; address?: string; landmark?: string }
const readContact = (): Contact => {
  try {
    return JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
  } catch {
    return {}
  }
}

export function AccountShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-50 min-h-screen pt-28 sm:pt-32 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <nav className="flex gap-2 overflow-x-auto no-scrollbar mb-8">
          {[["/account", "Overview"], ["/account/bookings", "Bookings"], ["/account/addresses", "Details"]].map(([h, l]) => (
            <Link key={h} href={h} className="shrink-0 rounded-full h-10 px-4 text-sm flex items-center border bg-white border-zinc-200 hover:border-zinc-400">{l}</Link>
          ))}
        </nav>
        <h1 className="font-serif text-5xl mb-2">{title}</h1>
        <p className="text-sm text-zinc-500 mb-10">Your bookings and details, saved securely on this device.</p>
        {children}
      </div>
    </div>
  )
}

export function AccountOverview() {
  const [c, setC] = useState<Contact>({})
  const [n, setN] = useState(0)
  useEffect(() => {
    setC(readContact())
    setN(getBookings().length)
  }, [])
  const tiles = [
    { href: "/account/bookings", icon: CalendarCheck, t: "Bookings", d: n ? `${n} on this device` : "None yet" },
    { href: "/account/addresses", icon: MapPin, t: "Saved details", d: c.address ? `${c.address}` : "Add your address" },
    { href: "/home-pulse", icon: CalendarCheck, t: "Home Pulse", d: "Your 90-day care plan" },
    { href: "/plus", icon: Crown, t: "Mjazo Plus", d: "Member prices on every visit" },
    { href: "/refer", icon: Gift, t: "Refer & earn", d: "Share your code, earn credit" },
    { href: "/help", icon: LifeBuoy, t: "Help", d: "Answers and support" },
  ]
  return (
    <AccountShell title={c.name ? `Hi, ${c.name.split(" ")[0]}.` : "Your account"}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="group rounded-3xl bg-white border border-zinc-200 p-6 hover:border-zinc-400 transition-colors">
            <div className="flex justify-between"><t.icon className="w-6 h-6" strokeWidth={1.5} /><ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-black rtl:-scale-x-100" /></div>
            <p className="font-medium mt-8">{t.t}</p>
            <p className="text-sm text-zinc-500 truncate">{t.d}</p>
          </Link>
        ))}
      </div>
    </AccountShell>
  )
}

export function BookingsList() {
  const [list, setList] = useState<LocalBooking[] | null>(null)
  const add = useCart((s) => s.add)
  const [rated, setRated] = useState<string[]>([])
  useEffect(() => {
    const l = getBookings()
    setList(l)
    setRated(l.filter((b) => isRated(b.id)).map((b) => b.id))
  }, [])
  const today = typeof window === "undefined" ? "" : karachiNow().date

  const rebook = (b: LocalBooking) => {
    b.items.forEach((i) => {
      for (let k = 0; k < i.qty; k++) add({ category: i.category, categoryName: i.categoryName, service: i.service, name: i.name, options: i.options, addOns: i.addOns, unitPrice: i.unitPrice, duration: i.duration }, { open: true })
    })
    track("rebook", { from: b.id })
  }

  return (
    <AccountShell title="Your bookings">
      {list === null ? null : list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="font-serif text-3xl">No bookings yet</p>
          <p className="text-zinc-500 mt-2">Book once and it shows up here, ready to rebook.</p>
          <Link href="/services/w/beauty-wellness" className="inline-flex mt-6 h-12 px-6 items-center rounded-full bg-foreground text-background">Book a service</Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {list.map((b) => {
            const upcoming = b.date >= today
            return (
              <li key={b.id} className="rounded-3xl bg-white border border-zinc-200 p-6 grid md:grid-cols-[1fr_auto] gap-4 items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={cn("text-[11px] rounded-full px-2.5 py-1", upcoming ? "bg-brand-soft text-brand-ink" : "bg-zinc-100 text-zinc-500")}>{upcoming ? "Upcoming" : "Past"}</span>
                    <span className="text-xs text-zinc-400">{b.id}</span>
                  </div>
                  <p className="font-medium">{b.items.map((i) => i.name).join(", ")}</p>
                  <p className="text-sm text-zinc-500 mt-1">{formatBookingDate(b.date)} · {b.window} · {[b.subArea, b.areaName].filter(Boolean).join(", ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{formatPKR(b.total)}</span>
                  {!upcoming && <Link href={`/complaint?id=${b.id}`} className="text-sm text-zinc-500 underline underline-offset-4 hover:text-black">Report a problem</Link>}
                  <button onClick={() => rebook(b)} className="h-10 px-4 rounded-full border border-zinc-300 text-sm flex items-center gap-1.5 hover:bg-foreground hover:text-background hover:border-foreground transition-colors"><RotateCcw className="w-4 h-4" />Rebook</button>
                </div>
                {!upcoming && !rated.includes(b.id) && (
                  <div className="md:col-span-2 border-t border-zinc-100 pt-4">
                    <p className="text-sm font-medium mb-1">How was this visit?</p>
                    <RateVisit bookingId={b.id} phone={b.phone} beauty={b.items.some((i) => BEAUTY.includes(i.category))} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </AccountShell>
  )
}

export function SavedDetails() {
  const { getArea, liveAreas } = useCatalog()
  const [c, setC] = useState<Contact>({})
  const [saved, setSaved] = useState(false)
  useEffect(() => setC(readContact()), [])
  const set = (k: keyof Contact, v: string) => setC((s) => ({ ...s, [k]: v }))
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      localStorage.setItem("mjazo-contact", JSON.stringify(c))
    } catch {}
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  return (
    <AccountShell title="Saved details">
      <form onSubmit={save} className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-8 grid sm:grid-cols-2 gap-5">
        <Field label="Name"><input className={inputCls} value={c.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="WhatsApp number"><input className={inputCls} value={c.phone ?? ""} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></Field>
        <Field label="Area">
          <select className={inputCls} value={c.area ?? ""} onChange={(e) => set("area", e.target.value)}>
            <option value="">Choose…</option>
            {liveAreas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="House no. & street"><input className={inputCls} value={c.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Landmark" className="sm:col-span-2"><input className={inputCls} value={c.landmark ?? ""} onChange={(e) => set("landmark", e.target.value)} /></Field>
        <div className="sm:col-span-2 flex items-center gap-4">
          <button className="h-12 px-6 rounded-full bg-foreground text-background">Save</button>
          {saved && <span className="text-sm text-brand-ink">Saved. We'll fill these in at checkout.</span>}
          {c.area && <span className="text-sm text-zinc-400">{getArea(c.area)?.name}</span>}
        </div>
      </form>
    </AccountShell>
  )
}
