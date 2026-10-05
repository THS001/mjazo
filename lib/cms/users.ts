import "server-only"
import { db } from "@/lib/server/store"
import { SITE_URL } from "@/lib/site"
import { addAudit } from "./store"
import { CmsAuthError, type CmsUser } from "./auth"
import { ROLES, type Role } from "./roles"

// People who can sign in to /admin (Supabase Auth users + a role in cms_users).

export type CmsUserRow = { id: string; email: string; name: string | null; role: Role; active: boolean; created_at: string; last_seen: string | null; invited_by: string | null }

export async function listUsers(): Promise<CmsUserRow[]> {
  if (!db) return []
  const { data, error } = await db.from("cms_users").select("*").order("created_at")
  if (error) throw error
  return data as CmsUserRow[]
}

/** Who has two-step sign-in on (a confirmed authenticator), by user id. */
export async function twoStepOn(ids: string[]): Promise<Record<string, boolean>> {
  if (!db) return {}
  const out: Record<string, boolean> = {}
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await db!.auth.admin.mfa.listFactors({ userId: id })
      out[id] = (data?.factors ?? []).some((f) => f.status === "verified")
    }),
  )
  return out
}

/** Only Owners may create or change Owners; nobody can demote or deactivate themselves. */
export function guard(actor: CmsUser, role: Role, targetId?: string) {
  if (!ROLES.includes(role)) throw new CmsAuthError("Unknown role.")
  if (role === "owner" && actor.role !== "owner") throw new CmsAuthError("Only an Owner can make someone an Owner.")
  if (targetId && targetId === actor.id) throw new CmsAuthError("You can't change your own role or access. Ask another Owner.")
}

export async function inviteUser(actor: CmsUser, email: string, name: string, role: Role) {
  if (!db) throw new Error("Inviting people needs Supabase.")
  guard(actor, role)
  const clean = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new CmsAuthError("That email address doesn't look right.")
  const redirectTo = `${SITE_URL}/admin/auth/callback?next=/admin/account`
  let userId: string | undefined
  const invited = await db.auth.admin.inviteUserByEmail(clean, { redirectTo, data: { name } })
  if (invited.data.user) userId = invited.data.user.id
  else {
    // Already has a Supabase account (e.g. a past invite): find it and just grant access.
    for (let page = 1; page < 50 && !userId; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 200 })
      userId = data.users.find((u) => u.email?.toLowerCase() === clean)?.id
      if (data.users.length < 200) break
    }
    if (!userId) throw new Error(invited.error?.message ?? "Couldn't send the invite.")
  }
  const { error } = await db.from("cms_users").upsert({ id: userId, email: clean, name: name.trim() || null, role, active: true, invited_by: actor.name })
  if (error) throw error
  await addAudit({ user_id: actor.id, user_name: actor.name, action: "invited", type: "user", entry_id: userId, title: clean, detail: `Role: ${role}` })
}

export async function updateUser(actor: CmsUser, id: string, patch: { role?: Role; active?: boolean; name?: string }) {
  if (!db) throw new Error("Managing people needs Supabase.")
  const { data: target } = await db.from("cms_users").select("*").eq("id", id).maybeSingle()
  if (!target) throw new CmsAuthError("That person isn't in the CMS.")
  if (target.role === "owner" && actor.role !== "owner") throw new CmsAuthError("Only an Owner can change another Owner.")
  guard(actor, patch.role ?? target.role, patch.role !== undefined || patch.active !== undefined ? id : undefined)
  const { error } = await db.from("cms_users").update(patch).eq("id", id)
  if (error) throw error
  await addAudit({ user_id: actor.id, user_name: actor.name, action: patch.active === false ? "removed access" : "updated person", type: "user", entry_id: id, title: target.email, detail: JSON.stringify(patch) })
}
