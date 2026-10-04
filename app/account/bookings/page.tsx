import type { Metadata } from "next"
import { BookingsList } from "@/components/account/account-views"

export const metadata: Metadata = {
  alternates: { canonical: "/account/bookings" }, title: "Your bookings", robots: { index: false, follow: false } }

export default function BookingsPage() {
  return <BookingsList />
}
