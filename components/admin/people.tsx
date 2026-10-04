"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"
import { ROLE_INFO, ROLES, type Role } from "@/lib/cms/roles"
import type { CmsUserRow } from "@/lib/cms/users"
import { inviteAction, updateUserAction } from "@/app/(staff)/admin/actions"
import { Btn, Card, Notice, ago } from "./ui"
import { Switch } from "./fields"

export function People({ users, me, myRole, enabled }: { users: CmsUserRow[]; me: string; myRole: Role; enabled: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<Role>("editor")
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const [busy, setBusy] = useState("")
  const roles = ROLES.filter((r) => r !== "owner" || myRole === "owner")

  const invite = async () => {
    setBusy("invite")
    const r = await inviteAction(email, name, role)
    setBusy("")
    if (r.ok) {
      setMsg({ tone: "ok", text: `Invite sent to ${email}. They'll get an email to set their password.` })
      setEmail("")
      setName("")
      router.refresh()
    } else setMsg({ tone: "error", text: r.error })
  }
  const update = async (id: string, patch: { role?: Role; active?: boolean }) => {
    setBusy(id)
    const r = await updateUserAction(id, patch)
    setBusy("")
    if (!r.ok) setMsg({ tone: "error", text: r.error })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!enabled && <Notice tone="warn">Inviting people needs Supabase. Once it's connected, the Owner named in CMS_OWNER_EMAIL signs in first and invites everyone else here.</Notice>}

      <Card className="p-5">
        <p className="font-medium">Invite someone</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1.3fr_1fr_0.8fr_auto]">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" disabled={!enabled} className="h-10 rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-foreground" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" disabled={!enabled} className="h-10 rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-foreground" />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={!enabled} className="h-10 rounded-xl border border-zinc-300 px-3 text-sm">
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_INFO[r].label}
              </option>
            ))}
          </select>
          <Btn variant="primary" busy={busy === "invite"} disabled={!enabled || !email} onClick={invite}>
            <UserPlus className="w-4 h-4" /> Send invite
          </Btn>
        </div>
        <p className="mt-2 text-xs text-zinc-500">{ROLE_INFO[role].summary}</p>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Last seen</th>
              <th className="px-4 py-2.5 font-medium">Access</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me
              const locked = self || (u.role === "owner" && myRole !== "owner")
              return (
                <tr key={u.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">
                      {u.name || u.email.split("@")[0]} {self && <span className="text-xs font-normal text-zinc-400">(you)</span>}
                    </p>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <select value={u.role} disabled={locked || busy === u.id} onChange={(e) => update(u.id, { role: e.target.value as Role })} className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm disabled:bg-zinc-50">
                      {ROLES.filter((r) => r !== "owner" || myRole === "owner" || u.role === "owner").map((r) => (
                        <option key={r} value={r}>
                          {ROLE_INFO[r].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{u.last_seen ? ago(u.last_seen) : "Not yet"}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 text-xs text-zinc-500">
                      <Switch checked={u.active} disabled={locked || busy === u.id} onChange={(active) => update(u.id, { active })} />
                      {u.active ? "Active" : "Removed"}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!users.length && <p className="px-4 py-8 text-center text-sm text-zinc-500">No one yet.</p>}
      </Card>

      <Card className="p-5">
        <p className="font-medium">What each role can do</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r}>
              <dt className="text-sm font-medium">{ROLE_INFO[r].label}</dt>
              <dd className="text-xs text-zinc-500">{ROLE_INFO[r].summary}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
