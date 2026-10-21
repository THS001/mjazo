import type { Metadata } from "next"
import { ROLE_INFO } from "@/lib/cms/roles"
import { getStaff, staffMode } from "@/lib/server/staff"
import { OpsConsole, type OpsGate } from "@/components/staff/ops/console"

export const metadata: Metadata = { title: "Mission control", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

// Mission control. Staff sign in with their own email (the CMS sign-in); what they see depends on
// their role, and every action is checked again on the server.

export default async function OpsPage() {
  const staff = await getStaff()
  const gate: OpsGate = !staff ? "signed-out" : staff.mfa && staff.mfa !== "ok" ? "two-step" : staff.perms.includes("ops.view") ? "in" : "no-access"
  return <OpsConsole gate={gate} mode={staffMode()} who={staff ? { email: staff.email, role: ROLE_INFO[staff.role].label } : null} />
}
