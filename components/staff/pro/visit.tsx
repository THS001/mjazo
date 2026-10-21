"use client"

import { useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, Check, ChevronRight, Clock, MapPin, Navigation, Phone, Wallet } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import type { Lang } from "@/lib/content"
import type { JobBrief } from "@/lib/ops/types"
import type { proAvailability, proEarnings, proOffers, proProfile, proRatingSummary, proSchedule } from "@/lib/server/pro-api"
import { locate, shrink } from "@/lib/client/media"
import { to12h } from "@/lib/shaadi"
import { cn } from "@/lib/utils"
import { api, Btn, mapsLink, useNow } from "../kit"
import { T } from "./strings"

// One visit in the pro app (the card, its brief and the payment sheet), and the shapes the
// /api/v1/pro endpoints answer with.

export type Schedule = Awaited<ReturnType<typeof proSchedule>>
export type Visit = Schedule["days"][number]["visits"][number]
export type Offers = Awaited<ReturnType<typeof proOffers>>["offers"]
export type Earnings = Awaited<ReturnType<typeof proEarnings>>
export type Ratings = Awaited<ReturnType<typeof proRatingSummary>>
export type Profile = Awaited<ReturnType<typeof proProfile>>
export type Availability = Awaited<ReturnType<typeof proAvailability>>

export const urCls = (lang: Lang) => (lang === "ur" ? "font-urdu leading-[2]" : "")

/** A day as the app shows it: "Thu 22 Oct" (Urdu numerals and names on the Urdu screen). */
export const dayLabel = (iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", { ...opts, timeZone: "UTC" })
export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })

export function VisitCard({ visit: j, n, lang, focus, busy, onAct, onPay }: { visit: Visit; n: number; lang: Lang; focus: boolean; busy: string | null; onAct: (j: Visit, a: string) => void; onPay: () => void }) {
  const now = useNow(30000)
  const ur = urCls(lang)
  const done = j.status === "completed"
  const place = [j.address, j.landmark && `near ${j.landmark}`, j.subArea, j.area, "Karachi"].filter(Boolean).join(", ")
  const checkedIn = j.status === "checked_in"
  const elapsed = checkedIn && j.checkedInAt ? Math.max(0, Math.round((now - new Date(j.checkedInAt).getTime()) / 60000)) : 0
  return (
    <motion.li layout className={cn("rounded-[28px] p-5 transition-colors", done ? "bg-white/[0.03] text-white/50" : focus ? "bg-white text-black" : "bg-white/[0.06]")}>
      <div className="flex items-start gap-3">
        <span className={cn("w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-semibold text-sm", done ? "bg-emerald-500/20 text-emerald-300" : focus ? "bg-black text-[var(--brand)]" : "bg-[var(--brand)] text-black")}>{done ? <Check className="w-4 h-4" /> : n}</span>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-2 text-sm opacity-70">
            <Clock className="w-3.5 h-3.5" /> {j.window}
            {j.eta && !done && <span>· ETA {j.eta}</span>}
          </p>
          <p className="text-lg font-semibold leading-snug mt-0.5">
            {j.customer.name.split(" ")[0]} · {j.subArea ?? j.area}
          </p>
          <p className="text-sm opacity-70 mt-0.5 leading-snug">{place}</p>
        </div>
      </div>

      {!done && (
        <>
          <ul className="mt-4 space-y-1 text-[15px]">
            {j.items.map((i, k) => (
              <li key={k} className="flex gap-2">
                <ChevronRight className="w-4 h-4 mt-1 shrink-0 opacity-50" />
                <span>
                  {i.name}
                  {i.options.length > 0 && <span className="opacity-60"> · {i.options.join(", ")}</span>}
                  {i.addOns.length > 0 && <span className="opacity-60"> + {i.addOns.join(", ")}</span>}
                  {i.qty > 1 && <span className="opacity-60"> ×{i.qty}</span>}
                </span>
              </li>
            ))}
          </ul>
          {j.event && (
            <div className={cn("mt-4 rounded-2xl p-3.5 text-sm", focus ? "bg-[var(--brand-soft)]" : "bg-[var(--brand)]/15")}>
              <p className="font-semibold">
                {j.event.name} · photos at {to12h(j.event.readyBy)} · {j.event.track}
              </p>
              <ol className="mt-2 space-y-1">
                {j.event.people.map((p, k) => (
                  <li key={k} className="flex gap-2">
                    <span className="font-mono text-xs opacity-70 mt-0.5 shrink-0">
                      {to12h(p.start)}–{to12h(p.end)}
                    </span>
                    <span>
                      {p.name}: <span className="opacity-70">{p.services.join(", ")}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {j.brief && <BriefCard brief={j.brief} photos={j.photos} focus={focus} />}
          {(j.notes || j.lastNotes.length > 0) && (
            <div className={cn("mt-4 rounded-2xl p-3.5 text-sm space-y-2", focus ? "bg-black/[0.05]" : "bg-white/[0.05]")}>
              {j.notes && (
                <p>
                  <span className={cn("font-semibold", ur)}>{T.notes[lang]}: </span>
                  {j.notes}
                </p>
              )}
              {j.lastNotes.length > 0 && (
                <div>
                  <p className={cn("font-semibold", ur)}>{T.last[lang]}</p>
                  {j.lastNotes.map((x, k) => (
                    <p key={k} className="opacity-75">
                      {x}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 opacity-60" />
            <span className="font-semibold">{formatPKR(j.total)}</span>
            <span className="opacity-60">· {j.payment} after service</span>
          </p>
          <p className={cn("mt-1 pl-6 text-sm opacity-60", ur)}>
            {T.youEarn[lang]} {formatPKR(j.earn)}
          </p>
          {checkedIn && (
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div className="h-full bg-[var(--brand)] transition-[width] duration-700" style={{ width: `${Math.min(100, (elapsed / j.minutes) * 100)}%` }} />
              </div>
              <p className="text-xs opacity-60 mt-1.5">
                {elapsed} {T.of[lang]} ~{j.minutes} {T.min[lang]}
              </p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {j.status === "assigned" && (
              <Btn variant={focus ? "dark" : "brand"} size="lg" className="flex-1" busy={busy === `${j.id}:en_route`} onClick={() => onAct(j, "en_route")}>
                <Navigation className="w-5 h-5" />
                <span className={ur}>{T.onWay[lang]}</span>
              </Btn>
            )}
            {(j.status === "en_route" || j.status === "assigned") && (
              <Btn variant={j.status === "en_route" ? "dark" : "light"} size="lg" className={cn("flex-1", j.status === "assigned" && "bg-white/10 text-white border-white/15")} busy={busy === `${j.id}:check_in`} onClick={() => onAct(j, "check_in")}>
                <MapPin className="w-5 h-5" />
                <span className={ur}>{T.checkIn[lang]}</span>
              </Btn>
            )}
            {(j.status === "checked_in" || j.status === "checked_out") && (
              <Btn variant="dark" size="lg" className="flex-1" onClick={onPay}>
                <Wallet className="w-5 h-5" />
                <span className={ur}>{T.finish[lang]}</span>
              </Btn>
            )}
            <div className="flex gap-2 w-full">
              <a href={mapsLink(place)} target="_blank" rel="noreferrer" className={cn("flex-1 h-11 rounded-full inline-flex items-center justify-center gap-2 text-sm font-medium", focus ? "bg-black/[0.06]" : "bg-white/10")}>
                <MapPin className="w-4 h-4" /> {T.map[lang]}
              </a>
              <a href={`tel:${j.customer.phone}`} className={cn("flex-1 h-11 rounded-full inline-flex items-center justify-center gap-2 text-sm font-medium", focus ? "bg-black/[0.06]" : "bg-white/10")}>
                <Phone className="w-4 h-4" /> {T.call[lang]}
              </a>
            </div>
          </div>
        </>
      )}
      {done && j.paid && (
        <p className="mt-3 text-sm">
          {T.done[lang]} · {formatPKR(j.paid.amount)} {j.paid.method}
          {j.paid.status === "matched" && " · ✓"}
          {["mismatch", "unreadable", "pending"].includes(j.paid.status) && " · ops checking"}
        </p>
      )}
    </motion.li>
  )
}

const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "jazzcash", label: "JazzCash" },
  { id: "easypaisa", label: "Easypaisa" },
  { id: "raast", label: "Raast / Bank" },
] as const

export function PaySheet({ visit, lang, onDone }: { visit: Visit; lang: Lang; onDone: (msg: string) => void }) {
  const initial = METHODS.find((m) => m.id === visit.payment)?.id ?? "cash"
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>(initial)
  const [amount, setAmount] = useState(String(visit.total))
  const [shot, setShot] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const file = useRef<HTMLInputElement>(null)
  const ur = urCls(lang)
  const save = async () => {
    setBusy(true)
    setError("")
    try {
      const where = await locate(4000)
      const r = await api<{ message: string | null }>(`/api/v1/pro/jobs/${encodeURIComponent(visit.id)}`, { action: "complete", ...where, payment: { method, amount: Number(amount) || 0, screenshot: method === "cash" ? undefined : shot } })
      onDone(r.message ?? T.done[lang])
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <div>
      <p className={cn("text-2xl font-semibold", ur)}>{T.pay[lang]}</p>
      <p className="text-white/55 mt-1">
        {T.total[lang]}: <span className="text-white font-semibold">{formatPKR(visit.total)}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 mt-5">
        {METHODS.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} aria-pressed={method === m.id} className={cn("h-14 rounded-2xl border text-[15px] font-medium transition-colors", method === m.id ? "bg-[var(--brand)] text-black border-transparent" : "border-white/15 text-white/80")}>
            {m.label}
          </button>
        ))}
      </div>
      <label className="block mt-5">
        <span className={cn("text-sm text-white/60", ur)}>{T.amount[lang]}</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-2 w-full h-14 rounded-2xl bg-white/[0.07] border border-white/10 px-5 text-[20px] outline-none focus:border-[var(--brand)]" />
      </label>
      {method !== "cash" && (
        <div className="mt-5">
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => e.target.files?.[0] && setShot(await shrink(e.target.files[0], 1100, 0.8))} />
          <button onClick={() => file.current?.click()} className="w-full rounded-2xl border border-dashed border-white/25 p-4 flex items-center gap-4 text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {shot ? <img src={shot} alt="Payment screenshot" className="w-14 h-20 object-cover rounded-lg" /> : <span className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center"><Camera className="w-6 h-6" /></span>}
            <span>
              <span className={cn("block font-medium", ur)}>{T.shot[lang]}</span>
              <span className={cn("block text-sm text-white/50", ur)}>{T.shotHint[lang]}</span>
            </span>
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
      <Btn variant="brand" size="lg" className="w-full mt-6" busy={busy} disabled={method !== "cash" && !shot} onClick={save}>
        <Check className="w-5 h-5" />
        <span className={ur}>{T.saveFinish[lang]}</span>
      </Btn>
    </div>
  )
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[65] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-lenis-prevent>
          <button aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: "spring", damping: 28, stiffness: 320 }} className="relative w-full max-w-md max-h-[92svh] overflow-y-auto rounded-t-[32px] bg-[#161616] text-white px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" role="dialog">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-2 mb-5" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Ghar Scan diagnosis or Look Card sent by the customer, with their photos and the parts checklist. */
function BriefCard({ brief, photos, focus }: { brief: JobBrief; photos: string[]; focus: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const [have, setHave] = useState<string[]>([])
  return (
    <div className={cn("mt-4 rounded-2xl p-3.5 text-sm", focus ? "bg-black/[0.05]" : "bg-white/[0.05]")}>
      <p className="text-[11px] uppercase tracking-wider opacity-60">{brief.kind === "scan" ? "Ghar Scan brief from the customer" : "Look Card from the customer"}</p>
      <p className="font-semibold mt-1" dir="auto">
        {brief.title}
      </p>
      <p className="opacity-80 mt-1 leading-relaxed" dir="auto">
        {brief.text}
      </p>
      {photos.length > 0 && (
        <div className="flex gap-2 mt-3">
          {photos.map((p, i) => (
            <button key={i} onClick={() => setOpen(open === i ? null : i)} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0" aria-label={`Photo ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="w-full h-full object-cover" />
              {(brief.pins ?? [])
                .filter((x) => x.photo === i)
                .map((x, k) => (
                  <span key={k} className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-[var(--brand)] ring-2 ring-black/50" style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%` }} />
                ))}
            </button>
          ))}
        </div>
      )}
      {open !== null && photos[open] && (
        <div className="relative mt-3 rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open]} alt="Customer photo" className="w-full" />
          {(brief.pins ?? [])
            .filter((x) => x.photo === open)
            .map((x, k) => (
              <span key={k} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%` }}>
                <span className="w-6 h-6 rounded-full bg-[var(--brand)] text-black text-xs font-bold flex items-center justify-center ring-2 ring-black/50">{k + 1}</span>
                <span className="mt-1 rounded-full bg-black/80 text-white text-[11px] px-2 py-0.5 whitespace-nowrap">{x.label}</span>
              </span>
            ))}
        </div>
      )}
      {(brief.causes?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="font-semibold text-xs opacity-70">Likely causes</p>
          <ol className="list-decimal pl-5 mt-1 space-y-0.5" dir="auto">
            {brief.causes!.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </div>
      )}
      {(brief.parts?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="font-semibold text-xs opacity-70">Parts to carry</p>
          <ul className="mt-1.5 space-y-1.5">
            {brief.parts!.map((p) => (
              <li key={p}>
                <label className="flex items-center gap-2.5">
                  <input type="checkbox" checked={have.includes(p)} onChange={() => setHave((h) => (h.includes(p) ? h.filter((x) => x !== p) : [...h, p]))} className="w-5 h-5 accent-[var(--brand)]" />
                  <span className={cn(have.includes(p) && "line-through opacity-60")}>{p}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
