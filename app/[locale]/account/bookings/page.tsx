import type { Metadata } from "next"
import { BookingsList } from "@/components/account/account-views"
import { pageLocale } from "@/lib/cms/locale"

export const metadata: Metadata = {
  alternates: { canonical: "/account/bookings" }, title: "Your bookings", robots: { index: false, follow: false } }

export default async function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <BookingsList />
}
