import type { Metadata } from "next"
import { SavedDetails } from "@/components/account/account-views"

export const metadata: Metadata = {
  alternates: { canonical: "/account/addresses" }, title: "Saved details", robots: { index: false, follow: false } }

export default function AddressesPage() {
  return <SavedDetails />
}
