import type { Metadata } from "next"
import { getSession, staffEnabled } from "@/lib/server/session"
import { OpsConsole } from "@/components/staff/ops/console"

export const metadata: Metadata = { title: "Ops console", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function OpsPage() {
  const s = await getSession()
  return <OpsConsole authed={s?.role === "ops"} enabled={staffEnabled()} />
}
