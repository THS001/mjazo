"use client"

import { useEffect, useState } from "react"
import { getBooking } from "@/lib/bookings"
import { Field, inputCls } from "./forms"
import { RateVisit } from "./rate-visit"

/** /rate: for links sent after a visit. Prefills from this device's bookings when it can. */
export function RatePage() {
  const [id, setId] = useState("")
  const [phone, setPhone] = useState("")
  const [beauty, setBeauty] = useState(false)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("id") ?? ""
    setId(q)
    const b = q ? getBooking(q) : undefined
    if (b) {
      setPhone(b.phone)
      setBeauty(b.items.some((i) => ["womens-salon", "hair", "makeup-mehndi", "nails-lashes", "spa-women"].includes(i.category)))
    } else {
      try {
        const c = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
        if (c.phone) setPhone(c.phone)
      } catch {}
    }
  }, [])
  const ready = id.trim().length >= 4 && phone.replace(/\D/g, "").length >= 10
  return (
    <div className="rounded-[32px] bg-white border border-zinc-200 p-6 sm:p-10 space-y-6">
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Booking ID">
          <input className={inputCls} value={id} onChange={(e) => setId(e.target.value)} placeholder="MJ-…" autoCapitalize="characters" />
        </Field>
        <Field label="Phone used for the booking">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="03xx xxxxxxx" />
        </Field>
      </div>
      {ready ? <RateVisit bookingId={id.trim()} phone={phone.replace(/[\s-]/g, "")} beauty={beauty} /> : <p className="text-sm text-zinc-500">Enter your booking ID and phone number to rate the visit.</p>}
    </div>
  )
}
