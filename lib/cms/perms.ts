import "server-only"
import { AUTHOR_GROUPS, can, type Role } from "./roles"
import { writable } from "./store"
import type { EditorPerms } from "@/components/admin/editor"

/** What the signed-in person may do in an editor, and why it is read-only if it is. */
export function permsFor(role: Role, group: string, perm: "settings" | null): EditorPerms {
  let readOnlyReason: string | null = null
  if (!writable()) readOnlyReason = "Saving is switched off until Supabase is connected. You can look around, but changes won't be kept."
  else if (perm === "settings" && !can(role, "settings")) readOnlyReason = "Only Owners and Admins can change site settings."
  else if (role === "author" && !AUTHOR_GROUPS.includes(group)) readOnlyReason = "Authors can edit blog posts and help articles. Ask an Editor to change this."
  else if (!can(role, "edit")) readOnlyReason = "Your role can view content but not change it."
  return { canEdit: can(role, "edit") && !readOnlyReason, canPublish: can(role, "publish"), canPrices: can(role, "prices"), readOnlyReason }
}
