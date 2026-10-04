import type { Metadata } from "next"
import { LoginView } from "@/components/account/login-view"

export const metadata: Metadata = {
  alternates: { canonical: "/login" }, title: "Log in", robots: { index: false, follow: true } }

export default function LoginPage() {
  return <LoginView />
}
