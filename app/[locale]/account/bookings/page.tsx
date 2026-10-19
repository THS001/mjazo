import type { Metadata } from "next"
import { BookingsList } from "@/components/account/account-views"
import { pageLocale } from "@/lib/cms/locale"
import { getUi } from "@/lib/cms/read"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const ui = await getUi()
  return pageMetadata({ path: "/account/bookings", title: ui.account.yourBookings, noindex: true })
}

export default async function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <BookingsList />
}
