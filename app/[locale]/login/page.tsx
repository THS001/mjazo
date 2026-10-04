import type { Metadata } from "next"
import { LoginView } from "@/components/account/login-view"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/login", title: "Log in", noindex: "follow" })
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <LoginView />
}
