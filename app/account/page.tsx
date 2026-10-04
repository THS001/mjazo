import type { Metadata } from "next"
import { AccountOverview } from "@/components/account/account-views"

export const metadata: Metadata = {
  alternates: { canonical: "/account" }, title: "Your account", robots: { index: false, follow: false } }

export default function AccountPage() {
  return <AccountOverview />
}
