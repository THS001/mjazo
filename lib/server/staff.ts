import "server-only"
import { authMode, getCmsUser, type CmsUser } from "@/lib/cms/auth"
import { canOps, opsPermsOf, type OpsPerm } from "@/lib/ops/access"
import { AuthError, ForbiddenError } from "./session"

// Who is using mission control (/ops). Everyone signs in with their own email on the CMS sign-in
// (Supabase + cms_users; lib/cms/auth.ts), so every action is recorded with the person's email.
// Locally without Supabase, a "local" person of any role can sign in (the CMS's local owner),
// which is never accepted in production. Permissions by role are in lib/ops/access.ts.

export type Staff = CmsUser & { perms: OpsPerm[] }

/** The signed-in person and what they may do in mission control; null when signed out. */
export async function getStaff(): Promise<Staff | null> {
  const u = await getCmsUser()
  return u ? { ...u, perms: opsPermsOf(u.role) } : null
}

/** Signed in, two-step sign-in done, and the role holds at least one of `perms`. Throws why not. */
export function allowStaff(u: CmsUser | null, ...perms: OpsPerm[]): Staff {
  if (!u) throw new AuthError("ops")
  if (u.mfa && u.mfa !== "ok") throw new ForbiddenError("Finish two-step sign-in first, then reload.")
  if (!perms.length || !perms.some((p) => canOps(u.role, p))) throw new ForbiddenError("Your role can't do that. Ask an Owner if you need it.")
  return { ...u, perms: opsPermsOf(u.role) }
}

/** Call at the top of every /api/ops handler (and per action for the stricter ones). */
export async function requireStaff(...perms: OpsPerm[]): Promise<Staff> {
  return allowStaff(await getCmsUser(), ...perms)
}

/** "supabase": email sign-in; "dev": local people of any role; "off": not set up. */
export const staffMode = authMode
