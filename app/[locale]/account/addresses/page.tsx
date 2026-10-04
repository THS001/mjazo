import type { Metadata } from "next"
import { SavedDetails } from "@/components/account/account-views"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/account/addresses", title: "Saved details", noindex: true })
}

export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <SavedDetails />
}
