import "server-only"
import { CmsAuthError, requireCms, requireSession, type CmsUser } from "./auth"
import { MediaError } from "./media"
import type { Perm } from "./roles"
import { ConflictError } from "./store"

// The shape every /admin server action returns. Errors thrown in server actions are hidden in
// production, so actions never rely on throwing: they return { ok: false, error } instead.

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; issues?: string[]; conflict?: boolean }

/** A problem the person can fix (shown as a list). */
export class ValidationError extends Error {
  constructor(public issues: string[]) {
    super(issues.join("\n"))
  }
}

export async function run<T>(perm: Perm, fn: (user: CmsUser) => Promise<T>): Promise<Result<T>> {
  return wrap(() => requireCms(perm), fn)
}

/** Like run(), for the two-step sign-in screen: signed in, but two-step may not be done yet. */
export async function runSession<T>(fn: (user: CmsUser) => Promise<T>): Promise<Result<T>> {
  return wrap(requireSession, fn)
}

async function wrap<T>(who: () => Promise<CmsUser>, fn: (user: CmsUser) => Promise<T>): Promise<Result<T>> {
  try {
    const user = await who()
    return { ok: true, data: await fn(user) }
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: "Please fix the highlighted problems.", issues: e.issues }
    if (e instanceof ConflictError) return { ok: false, conflict: true, error: `Someone else changed this${e.current?.updated_by ? ` (${e.current.updated_by})` : ""} since you opened it. Reload to see their version.` }
    if (e instanceof CmsAuthError || e instanceof MediaError) return { ok: false, error: e.message }
    console.error("[cms action]", e)
    return { ok: false, error: e instanceof Error && /Supabase|needs/.test(e.message) ? e.message : "Something went wrong. Please try again." }
  }
}
