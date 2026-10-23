import type { Metadata } from "next"
import { LoginView } from "@/components/account/login-view"
import { pageLocale } from "@/lib/cms/locale"
import { getUi } from "@/lib/cms/read"
import { pageMetadata } from "@/lib/cms/seo/metadata"
import { phoneOffer } from "@/lib/server/phone-sign-in"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const ui = await getUi()
  return pageMetadata({ path: "/login", title: ui.login.pageTitle, noindex: "follow" })
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <LoginView phone={phoneOffer()} />
}
