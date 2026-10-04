import type { Metadata, Viewport } from "next"
import { getSession, staffEnabled } from "@/lib/server/session"
import { ProApp } from "@/components/staff/pro/pro-app"

export const metadata: Metadata = { title: "Mjazo Pro", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"
export const viewport: Viewport = { themeColor: "#0b0b0b" }

export default async function ProPage() {
  const s = await getSession()
  return <ProApp authed={s?.role === "pro"} enabled={staffEnabled()} />
}
