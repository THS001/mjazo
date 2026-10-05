import { authMode, pageUser } from "@/lib/cms/auth"
import { ROLE_INFO } from "@/lib/cms/roles"
import { Card } from "@/components/admin/ui"
import { PasswordForm, TwoStepStatus } from "@/components/admin/account"

export const metadata = { title: "Your account" }

export default async function AccountPage() {
  const user = await pageUser()
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <p className="text-xs text-zinc-500">Account</p>
        <h1 className="mt-1 font-serif text-3xl">{user.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {user.email} · {ROLE_INFO[user.role].label}: {ROLE_INFO[user.role].summary}
        </p>
      </div>
      {authMode() === "supabase" ? (
        <Card className="p-5">
          <p className="font-medium">Password</p>
          <p className="mb-3 text-xs text-zinc-500">Set or change the password you sign in with. At least 10 characters.</p>
          <PasswordForm />
        </Card>
      ) : null}
      {authMode() === "supabase" ? (
        <Card className="p-5">
          <p className="font-medium">Two-step sign-in</p>
          <p className="mb-3 text-xs text-zinc-500">A code from an authenticator app on your phone, asked for at every sign-in. Owners and Admins must use it.</p>
          <TwoStepStatus />
        </Card>
      ) : (
        <Card className="p-5 text-sm text-zinc-500">You're signed in as the local development Owner. Passwords and two-step sign-in arrive with Supabase.</Card>
      )}
    </div>
  )
}
