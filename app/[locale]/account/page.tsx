import type { Metadata } from "next"
import { AccountOverview } from "@/components/account/account-views"
import { pageLocale } from "@/lib/cms/locale"

export const metadata: Metadata = {
  alternates: { canonical: "/account" }, title: "Your account", robots: { index: false, follow: false } }

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <AccountOverview />
}
