import type { Metadata } from "next"
import { BookingsList } from "@/components/account/account-views"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/account/bookings", title: "Your bookings", noindex: true })
}

export default async function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <BookingsList />
}
