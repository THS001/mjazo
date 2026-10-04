import type { Metadata } from "next"
import { SavedDetails } from "@/components/account/account-views"
import { pageLocale } from "@/lib/cms/locale"

export const metadata: Metadata = {
  alternates: { canonical: "/account/addresses" }, title: "Saved details", robots: { index: false, follow: false } }

export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <SavedDetails />
}
