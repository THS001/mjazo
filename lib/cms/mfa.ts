import type { Role } from "./roles"

// Two-step sign-in (an authenticator app's 6-digit code, through Supabase Auth). Owners and Admins
// must use it; anyone else may turn it on, and then it's asked for every time. Set
// CMS_MFA_REQUIRED=false to stop requiring it (for example while the first Owner sets up).

export type MfaState = "ok" | "needs-code" | "needs-setup"
export const MFA_ROLES: Role[] = ["owner", "admin"]

/** Supabase's assurance levels: aal2 once a code was entered this session; nextLevel aal2 when the person has an authenticator set up. */
export type Aal = { currentLevel?: string | null; nextLevel?: string | null } | null

export const mfaRequired = (env: string | undefined = process.env.CMS_MFA_REQUIRED) => env?.trim().toLowerCase() !== "false"

/** Whether this sign-in may use the admin yet, or must first enter a code or set up an authenticator. */
export function mfaState(role: Role, aal: Aal, required = mfaRequired()): MfaState {
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return "needs-code"
  if (required && MFA_ROLES.includes(role) && aal?.currentLevel !== "aal2") return "needs-setup"
  return "ok"
}
