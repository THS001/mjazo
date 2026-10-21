import "server-only"
import { core } from "@/lib/core/db"
import { proForSignIn } from "@/lib/core/pros"
import type { Pro } from "@/lib/ops/types"
import { handle } from "./api"
import { getPro } from "./ops"
import { AuthError, ForbiddenError, getSession, pinVersion, proEnabled, readSession, signSession, TOKEN_PREFIX, type Session } from "./session"
import { db as supabase } from "./store"

// Who is using the pro app or its API (/api/v1/pro). Three ways in:
// - the phone app: "Authorization: Bearer mjp.…", the token from POST /api/v1/pro/session
//   (phone + PIN);
// - the phone app after an emailed link: "Authorization: Bearer <Supabase access token>";
// - the web app (/pro): the same signed session in a cookie, from a PIN or from an emailed link
//   (/pro/auth/callback swaps the link for one).
// The pro is read again on every request: a paused pro is refused, and resetting her PIN ends
// every PIN session. Everything goes through the core database.

/** How long a sign-in lasts. */
export const SESSION_DAYS = 14

/** Starts a session for her: the token for the phone app, and its expiry. */
export function startSession(pro: Pick<Pro, "id" | "pinHash">) {
  const { value, exp } = signSession({ role: "pro", proId: pro.id, pv: pinVersion(pro.pinHash) }, SESSION_DAYS * 86400)
  return { value, token: TOKEN_PREFIX + value, expiresAt: new Date(exp).toISOString() }
}

/** The session the request carries (header first, then the cookie), or null. */
async function sessionOf(req?: Request): Promise<{ s: Session } | { proId: string } | null> {
  const auth = req?.headers.get("authorization") ?? ""
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (bearer.startsWith(TOKEN_PREFIX)) {
    const s = readSession(bearer.slice(TOKEN_PREFIX.length))
    return s ? { s } : null
  }
  if (bearer) {
    // A Supabase access token from the phone app's email sign-in.
    if (!supabase) return null
    const { data, error } = await supabase.auth.getUser(bearer)
    if (error || !data.user?.email) return null
    const db = await core()
    const proId = db ? await proForSignIn(db, { userId: data.user.id, email: data.user.email }) : null
    return proId ? { proId } : null
  }
  const s = await getSession()
  return s ? { s } : null
}

/**
 * Email sign-in, before the link is sent: if an active pro has this email, make sure she has a
 * sign-in account, so the browser can ask Supabase for the link with new sign-ups switched off.
 * Says nothing either way, so it can't be used to find out who's a pro.
 */
export async function prepareEmailSignIn(email: string) {
  const clean = email.trim().toLowerCase()
  const db = await core()
  if (!supabase || !db) return
  const pro = await db.one<{ status: string }>("select status from pros where lower(email) = $1", [clean])
  // Fails harmlessly when the account already exists.
  if (pro?.status === "active") await supabase.auth.admin.createUser({ email: clean, email_confirm: true }).catch(() => null)
}

/** The active pro behind a Supabase account that has just signed in (the emailed link), or null. */
export async function proForAccount(user: { id: string; email?: string | null }): Promise<Pro | null> {
  const db = await core()
  if (!db || !user.email) return null
  const id = await proForSignIn(db, { userId: user.id, email: user.email })
  const pro = id ? await getPro(id) : null
  return pro?.status === "active" ? pro : null
}

/** The signed-in pro, or null. Paused pros and stale PIN sessions count as signed out. */
export async function currentPro(req?: Request): Promise<Pro | null> {
  try {
    return await requireProApi(req)
  } catch {
    return null
  }
}

/** A /api/v1/pro handler: signs the pro in from the request, runs `fn`, and answers its errors. */
export const asPro =
  <C = unknown>(fn: (pro: Pro, req: Request, ctx: C) => Promise<unknown>) =>
  (req: Request, ctx: C) =>
    handle(async () => fn(await requireProApi(req), req, ctx))

/** The signed-in, active pro. Throws AuthError (sign in again) or ForbiddenError (paused, switched off). */
export async function requireProApi(req?: Request): Promise<Pro> {
  if (!proEnabled()) throw new ForbiddenError("The pro app isn't switched on yet. Please contact Mjazo ops.")
  if (!(await core())) throw new ForbiddenError("The pro app needs the core database (DATABASE_URL).")
  const found = await sessionOf(req)
  if (!found) throw new AuthError("pro")
  const pro = await getPro("s" in found ? found.s.proId : found.proId)
  if (!pro) throw new AuthError("pro")
  if ("s" in found && found.s.pv !== pinVersion(pro.pinHash)) throw new AuthError("pro")
  if (pro.status !== "active") throw new ForbiddenError("Your account is paused. Please contact Mjazo ops.")
  return pro
}
