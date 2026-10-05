import { authMode, pageUser } from "@/lib/cms/auth"
import { can } from "@/lib/cms/roles"
import { listUsers, twoStepOn } from "@/lib/cms/users"
import { People } from "@/components/admin/people"
import { Notice } from "@/components/admin/ui"

export const metadata = { title: "People & roles" }

export default async function PeoplePage() {
  const user = await pageUser()
  const users = can(user.role, "users") ? await listUsers() : []
  return (
    <div>
      <p className="text-xs text-zinc-500">Team</p>
      <h1 className="mt-1 font-serif text-3xl">People & roles</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">Everyone signs in with their own email, so the activity log shows who changed what.</p>
      {can(user.role, "users") ? (
        <People users={users} twoStep={await twoStepOn(users.map((u) => u.id))} me={user.id} myRole={user.role} enabled={authMode() === "supabase"} />
      ) : (
        <Notice>Only Owners and Admins can manage people.</Notice>
      )}
    </div>
  )
}
