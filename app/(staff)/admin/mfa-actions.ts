"use server"

import { run, runSession, ValidationError } from "@/lib/cms/action"
import { authMode, CmsAuthError, supabaseAuth } from "@/lib/cms/auth"
import { MFA_ROLES, mfaRequired } from "@/lib/cms/mfa"
import { addAudit } from "@/lib/cms/store"
import { db } from "@/lib/server/store"

// Two-step sign-in with an authenticator app (Supabase Auth TOTP). These work before two-step is
// complete (runSession), so a person can set it up or enter their code; resetting someone else's
// needs "users" like the rest of People & roles.

const needsSupabase = () => {
  if (authMode() !== "supabase") throw new ValidationError(["Two-step sign-in needs Supabase."])
}

/** This person's two-step status: their authenticators and whether their role must use one. */
export async function mfaStatusAction() {
  return runSession(async (u) => {
    if (authMode() !== "supabase") return { available: false, state: "ok" as const, required: false, factors: [] as { id: string; name: string; created: string }[] }
    const { data } = await (await supabaseAuth()).auth.mfa.listFactors()
    const factors = (data?.totp ?? []).filter((f) => f.status === "verified").map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator app", created: f.created_at }))
    return { available: true, state: u.mfa ?? ("ok" as const), required: mfaRequired() && MFA_ROLES.includes(u.role), factors }
  })
}

/** Starts setting up an authenticator: the QR code to scan and the key to type in by hand. */
export async function mfaEnrollAction() {
  return runSession(async () => {
    needsSupabase()
    const sb = await supabaseAuth()
    // A set-up that was scanned but never confirmed blocks a new one: clear it first.
    const { data: list } = await sb.auth.mfa.listFactors()
    for (const f of list?.all ?? []) if (f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Mjazo CMS ${new Date().toISOString().slice(0, 16).replace("T", " ")}` })
    if (error || !data) throw new ValidationError([error?.message ?? "Couldn't start the set-up. Try again."])
    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
  })
}

/** Checks a 6-digit code: finishes a set-up (factorId given) or completes this sign-in. */
export async function mfaVerifyAction(factorId: string | null, code: string) {
  return runSession(async (u) => {
    needsSupabase()
    const clean = code.replace(/\s/g, "")
    if (!/^\d{6}$/.test(clean)) throw new ValidationError(["Enter the 6-digit code from your authenticator app."])
    const sb = await supabaseAuth()
    let id = factorId
    if (!id) {
      const { data } = await sb.auth.mfa.listFactors()
      id = data?.totp?.find((f) => f.status === "verified")?.id ?? null
    }
    if (!id) throw new ValidationError(["No authenticator is set up for this account yet."])
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: id, code: clean })
    if (error) throw new ValidationError(["That code didn't work. Codes change every 30 seconds: enter the one showing now."])
    if (factorId) await addAudit({ user_id: u.id, user_name: u.name, action: "turned on two-step sign-in", type: "user", entry_id: u.id, title: u.email, detail: null })
    return null
  })
}

/** People & roles: removes someone's authenticators (a lost phone). They set up a new one at their next sign-in. */
export async function mfaResetAction(userId: string) {
  return run("users", async (actor) => {
    needsSupabase()
    if (userId === actor.id) throw new CmsAuthError("You can't reset your own two-step sign-in. Ask another Owner.")
    const { data: target } = await db!.from("cms_users").select("*").eq("id", userId).maybeSingle()
    if (!target) throw new CmsAuthError("That person isn't in the CMS.")
    if (target.role === "owner" && actor.role !== "owner") throw new CmsAuthError("Only an Owner can reset an Owner's two-step sign-in.")
    const { data, error } = await db!.auth.admin.mfa.listFactors({ userId })
    if (error) throw error
    for (const f of data?.factors ?? []) {
      const r = await db!.auth.admin.mfa.deleteFactor({ id: f.id, userId })
      if (r.error) throw r.error
    }
    await addAudit({ user_id: actor.id, user_name: actor.name, action: "reset two-step sign-in", type: "user", entry_id: userId, title: target.email, detail: null })
    return { removed: data?.factors?.length ?? 0 }
  })
}
