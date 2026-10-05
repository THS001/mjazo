import { redirect } from "next/navigation"
import { authMode, getCmsUser } from "@/lib/cms/auth"
import { TwoStep } from "@/components/admin/two-step"

export const metadata = { title: "Two-step sign-in" }

// Where Owners and Admins go until two-step sign-in is done (pageUser and the panel layout send
// them here). ?setup=1: anyone turning it on from Your account.

export default async function TwoStepPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const user = await getCmsUser()
  if (!user) redirect("/admin/login")
  const optional = (await searchParams).setup === "1"
  if ((!user.mfa || user.mfa === "ok") && !optional) redirect("/admin")
  const mode = user.mfa === "needs-code" ? "needs-code" : "needs-setup"
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F4F2] px-6 py-16">
      <TwoStep mode={mode} available={authMode() === "supabase"} email={user.email} back={optional ? "/admin/account" : "/admin"} />
    </div>
  )
}
