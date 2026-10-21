import type { Metadata, Viewport } from "next"
import { authMode } from "@/lib/cms/auth"
import { core } from "@/lib/core/db"
import { currentPro } from "@/lib/server/pro-auth"
import { proEnabled } from "@/lib/server/session"
import { ProApp } from "@/components/staff/pro/pro-app"

export const metadata: Metadata = { title: "Mjazo Pro", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"
export const viewport: Viewport = { themeColor: "#0b0b0b" }

// Mjazo Pro on the web. ?error= comes back from an emailed sign-in link that didn't work.

export default async function ProPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [pro, sp] = await Promise.all([currentPro(), searchParams])
  return <ProApp authed={Boolean(pro)} enabled={proEnabled() && Boolean(await core())} emailSignIn={authMode() === "supabase"} error={typeof sp.error === "string" ? sp.error : undefined} />
}
