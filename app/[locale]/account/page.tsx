import type { Metadata } from "next"
import { AccountOverview } from "@/components/account/account-views"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/account", title: "Your account", noindex: true })
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <AccountOverview />
}
