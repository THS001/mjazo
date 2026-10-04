import type { Metadata } from "next"
import { LoginView } from "@/components/account/login-view"
import { pageLocale } from "@/lib/cms/locale"

export const metadata: Metadata = {
  alternates: { canonical: "/login" }, title: "Log in", robots: { index: false, follow: true } }

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <LoginView />
}
