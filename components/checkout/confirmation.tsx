"use client"

import Link from "@/components/site/locale-link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { CalendarPlus, MapPin, MessageCircle, Wallet } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { formatBookingDate, getBooking, icsFor, windowLabel, type LocalBooking } from "@/lib/bookings"
import { track } from "@/lib/site"
import { EASE } from "@/components/site/primitives"
import { fill, fillNodes, useLocale, useSite, useT } from "@/components/cms/provider"

const bookingMessage = (b: LocalBooking) =>
  [
    `Hi Mjazo! Booking ${b.id}`,
    ...b.items.map((i) => `• ${i.name}${i.options.length ? ` (${i.options.join(", ")})` : ""}${i.addOns.length ? ` + ${i.addOns.map((a) => a.name).join(", ")}` : ""} x${i.qty}`),
    `When: ${formatBookingDate(b.date)}, ${b.window}`,
    `Where: ${[b.address, b.landmark, b.subArea, b.areaName].filter(Boolean).join(", ")}`,
    `Name: ${b.name} · ${b.phone}`,
    `Total: ${formatPKR(b.total)} (${b.payment}, pay after)`,
    b.notes ? `Notes: ${b.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n")

export function Confirmation() {
  const { whatsappLink } = useSite()
  const t = useT()
  const locale = useLocale()
  const id = useSearchParams().get("id") ?? ""
  const [b, setB] = useState<LocalBooking | null | undefined>(undefined)
  useEffect(() => setB(getBooking(id) ?? null), [id])

  const downloadIcs = () => {
    if (!b) return
    const url = URL.createObjectURL(new Blob([icsFor(b)], { type: "text/calendar" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `mjazo-${b.id}.ics`
    a.click()
    URL.revokeObjectURL(url)
    track("add_to_calendar", { id: b.id })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
      <motion.svg viewBox="0 0 52 52" className="w-24 h-24 mx-auto" initial="hidden" animate="visible" aria-hidden>
        <motion.circle cx="26" cy="26" r="24" fill="var(--brand)" variants={{ hidden: { scale: 0 }, visible: { scale: 1, transition: { duration: 0.5, ease: EASE } } }} style={{ transformOrigin: "center" }} />
        <motion.path d="M15 27l7 7 15-16" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1, transition: { delay: 0.4, duration: 0.6, ease: EASE } } }} />
      </motion.svg>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6, ease: EASE }}>
        <h1 className="font-serif text-5xl sm:text-6xl mt-8">{b?.name ? fill(t.confirmation.bookedName, { name: b.name.split(" ")[0] }) : t.confirmation.booked}</h1>
        <p className="text-zinc-600 mt-4">{fillNodes(t.confirmation.confirmShortly, { ref: <b className="text-black">{id || "—"}</b> })}</p>
      </motion.div>

      {b && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6, ease: EASE }} className="mt-12 text-start rounded-[2rem] bg-white border border-zinc-200 overflow-hidden">
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
            <div className="p-6"><p className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5"><CalendarPlus className="w-3.5 h-3.5" />{t.confirmation.when}</p><p className="font-medium">{formatBookingDate(b.date, locale)}</p><p className="text-sm text-zinc-600">{windowLabel(b.window, locale)}</p></div>
            <div className="p-6"><p className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{t.confirmation.where}</p><p className="font-medium">{b.address}</p><p className="text-sm text-zinc-600">{[b.subArea, b.areaName].filter(Boolean).join(", ")}</p></div>
            <div className="p-6"><p className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />{t.confirmation.payAfter}</p><p className="font-medium">{formatPKR(b.total)}</p><p className="text-sm text-zinc-600 capitalize">{b.payment === "online" ? "Online" : b.payment}</p></div>
          </div>
          <ul className="border-t border-zinc-100 p-6 space-y-2">
            {b.items.map((i) => (
              <li key={i.key} className="flex justify-between text-sm"><span>{i.name}{i.qty > 1 ? ` × ${i.qty}` : ""}{i.options.length ? <span className="text-zinc-500"> · {i.options.join(", ")}</span> : null}</span><span>{formatPKR(i.unitPrice * i.qty)}</span></li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="flex flex-wrap justify-center gap-3 mt-8">
        {b && <button onClick={downloadIcs} className="h-12 px-6 rounded-full bg-foreground text-background text-sm flex items-center gap-2 hover:bg-brand hover:text-foreground transition-colors"><CalendarPlus className="w-4 h-4" />{t.confirmation.addCalendar}</button>}
        <a href={whatsappLink(b ? bookingMessage(b) : `Hi Mjazo! About my booking ${id}.`)} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { placement: "confirmation", id })} className="h-12 px-6 rounded-full bg-[#25D366] text-foreground text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4" />{t.confirmation.confirmWa}</a>
        <Link href="/account/bookings" className="h-12 px-6 rounded-full border border-zinc-300 text-sm flex items-center hover:border-black">{t.confirmation.myBookings}</Link>
      </motion.div>

      <div className="mt-20 text-start">
        <p className="font-serif text-3xl text-center mb-10">{t.confirmation.nextTitle}</p>
        <ol className="relative border-s border-zinc-200 ms-4 space-y-8">
          {t.confirmation.next.map((s, i) => (
            <motion.li key={s.title} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="ps-8 relative">
              <span className="absolute -start-[13px] top-0 w-6 h-6 rounded-full bg-white border border-zinc-300 text-xs flex items-center justify-center">{i + 1}</span>
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-zinc-500">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  )
}
