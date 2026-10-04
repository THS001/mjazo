"use client"

// Bookings made on this device, kept in localStorage so the confirmation and account
// pages work without a login. The server copy lives in /api/submit.

import type { CartItem } from "./store"

export interface LocalBooking {
  id: string
  createdAt: string
  name: string
  phone: string
  area: string
  areaName: string
  subArea?: string
  address: string
  landmark?: string
  date: string // yyyy-mm-dd (Karachi)
  window: string
  payment: string
  notes?: string
  items: CartItem[]
  total: number
}

const KEY = "mjazo-bookings"

export function getBookings(): LocalBooking[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

export function saveBooking(b: LocalBooking) {
  try {
    localStorage.setItem(KEY, JSON.stringify([b, ...getBookings().filter((x) => x.id !== b.id)].slice(0, 50)))
  } catch {}
}

export const getBooking = (id: string) => getBookings().find((b) => b.id === id)

export { karachiNow, nextDays, WINDOW_HOURS, WINDOW_LABELS, windowAvailable, windowLabel, formatBookingDate } from "./time"
import { WINDOW_HOURS, WINDOW_LABELS } from "./time"

/** .ics calendar file for a booking (window is 2 hours, Karachi = UTC+5). */
export function icsFor(b: LocalBooking) {
  const idx = Math.max(0, WINDOW_LABELS.indexOf(b.window))
  const startUtcHour = WINDOW_HOURS[idx] - 5
  const d = b.date.replace(/-/g, "")
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mjazo//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@mjazo.pk`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${pad(startUtcHour)}0000Z`,
    `DTEND:${d}T${pad(startUtcHour + 2)}0000Z`,
    `SUMMARY:Mjazo: ${b.items.map((i) => i.name).join(", ").slice(0, 120)}`,
    `LOCATION:${[b.address, b.subArea, b.areaName, "Karachi"].filter(Boolean).join(", ").replace(/,/g, "\\,")}`,
    `DESCRIPTION:Booking ${b.id}. Your pro arrives within the ${b.window} window.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.join("\r\n")
}
