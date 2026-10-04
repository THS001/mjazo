"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { authMode, CmsAuthError, DEV_COOKIE, requireCms, supabaseAuth, type CmsUser } from "@/lib/cms/auth"
import type { Perm, Role } from "@/lib/cms/roles"
import type { Data } from "@/lib/cms/store"
import { getVersion, listVersions } from "@/lib/cms/store"
import { inviteUser, updateUser } from "@/lib/cms/users"
import * as w from "@/lib/cms/write"

// Server actions for /admin. Each checks the signed-in person's permission and returns a result
// object (errors in server actions are hidden in production, so we never rely on throwing).

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; issues?: string[]; conflict?: boolean }

async function run<T>(perm: Perm, fn: (user: CmsUser) => Promise<T>): Promise<Result<T>> {
  try {
    const user = await requireCms(perm)
    return { ok: true, data: await fn(user) }
  } catch (e) {
    if (e instanceof w.ValidationError) return { ok: false, error: "Please fix the highlighted problems.", issues: e.issues }
    if (e instanceof w.ConflictError) return { ok: false, conflict: true, error: `Someone else changed this${e.current?.updated_by ? ` (${e.current.updated_by})` : ""} since you opened it. Reload to see their version.` }
    if (e instanceof CmsAuthError) return { ok: false, error: e.message }
    console.error("[cms action]", e)
    return { ok: false, error: e instanceof Error && /Supabase|needs/.test(e.message) ? e.message : "Something went wrong. Please try again." }
  }
}

const reload = async (type: string, id: string) => (await w.loadEntry(type, id))!

export async function saveDraftAction(type: string, id: string, data: Data, version: number, manual = false) {
  return run("edit", async (u) => {
    await w.saveDraft(u, type, id, data, version, { manual })
    return reload(type, id)
  })
}

export async function submitForReviewAction(type: string, id: string, data: Data, version: number) {
  return run("edit", async (u) => {
    await w.saveDraft(u, type, id, data, version, { manual: true, review: true })
    return reload(type, id)
  })
}

export async function publishAction(type: string, id: string, data: Data, version: number) {
  return run("publish", async (u) => {
    // Save what's on screen first, then publish it.
    const saved = await w.saveDraft(u, type, id, data, version)
    await w.publish(u, type, id, saved.version)
    return reload(type, id)
  })
}

export async function discardAction(type: string, id: string, version: number) {
  return run("edit", async (u) => {
    await w.discardDraft(u, type, id, version)
    return w.loadEntry(type, id)
  })
}

export async function scheduleAction(type: string, id: string, data: Data, version: number, at: string) {
  return run("publish", async (u) => {
    const saved = await w.saveDraft(u, type, id, data, version)
    await w.schedule(u, type, id, saved.version, at)
    return reload(type, id)
  })
}

export async function unscheduleAction(type: string, id: string, version: number) {
  return run("publish", async (u) => {
    await w.unschedule(u, type, id, version)
    return reload(type, id)
  })
}

export async function createAction(type: string, data: Data) {
  return run("edit", async (u) => {
    const row = await w.createEntry(u, type, data)
    return { id: row.id }
  })
}

export async function archiveAction(type: string, id: string, version: number) {
  return run("publish", async (u) => {
    await w.archive(u, type, id, version)
    return null
  })
}

export async function unarchiveAction(type: string, id: string, version: number) {
  return run("publish", async (u) => {
    await w.unarchive(u, type, id, version)
    return reload(type, id)
  })
}

export async function reorderAction(type: string, ids: string[]) {
  return run("publish", async (u) => {
    await w.reorder(u, type, ids)
    return null
  })
}

export async function versionsAction(type: string, id: string) {
  return run("view", async () => listVersions(type, id))
}

export async function versionDataAction(seq: number) {
  return run("view", async () => (await getVersion(seq))?.data ?? null)
}

export async function restoreAction(type: string, id: string, seq: number, version: number) {
  return run("edit", async (u) => {
    await w.restoreVersion(u, type, id, seq, version)
    return reload(type, id)
  })
}

export async function inviteAction(email: string, name: string, role: Role) {
  return run("users", async (u) => inviteUser(u, email, name, role))
}

export async function updateUserAction(id: string, patch: { role?: Role; active?: boolean; name?: string }) {
  return run("users", async (u) => updateUser(u, id, patch))
}

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

/** Local development only: sign in as a local Owner without Supabase. */
export async function devLoginAction() {
  if (authMode() !== "dev") return
  ;(await cookies()).set(DEV_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 })
  redirect("/admin")
}

export async function signOutAction() {
  if (authMode() === "supabase") await (await supabaseAuth()).auth.signOut()
  ;(await cookies()).delete(DEV_COOKIE)
  redirect("/admin/login")
}
