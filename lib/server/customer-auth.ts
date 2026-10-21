import "server-only"
import crypto from "crypto"
import { authMode } from "@/lib/cms/auth"
import { core } from "@/lib/core/db"
import { customerForAccount, type Customer } from "@/lib/core/customers"
import { handle } from "./api"
import { AuthError, ForbiddenError, readPayload, signPayload } from "./session"
import { db as supabase } from "./store"

// Who is using the client account (/api/v1/customer). Customers sign in with an emailed link
// (Supabase); the website and the phone app both send the Supabase access token as
// "Authorization: Bearer <token>", so the API works the same for both. Locally without Supabase,
// a test sign-in gives a signed "mjc." token instead, which is refused anywhere else.

export type Account = { userId: string; email: string }

const DEV_PREFIX = "mjc."

/** Local development only: a test customer's token for an email. */
export function devCustomerToken(email: string) {
  if (authMode() !== "dev") throw new ForbiddenError("Not available here.")
  const clean = email.trim().toLowerCase()
  // A stable id per email, shaped like a Supabase user id (a UUID).
  const h = crypto.createHash("sha256").update(clean).digest("hex")
  const userId = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
  return DEV_PREFIX + signPayload({ kind: "customer-dev", email: clean, userId }, 7 * 86400)
}

/** The signed-in account a request carries, or null. */
export async function accountOf(req?: Request): Promise<Account | null> {
  const auth = req?.headers.get("authorization") ?? ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (!token) return null
  if (token.startsWith(DEV_PREFIX)) {
    if (authMode() !== "dev") return null
    const v = readPayload<{ kind: string; email: string; userId: string }>(token.slice(DEV_PREFIX.length))
    return v?.kind === "customer-dev" ? { userId: v.userId, email: v.email } : null
  }
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.email) return null
  return { userId: data.user.id, email: data.user.email.toLowerCase() }
}

export async function requireAccount(req: Request): Promise<Account> {
  if (!(await core())) throw new ForbiddenError("Accounts need the core database (DATABASE_URL).")
  const a = await accountOf(req)
  if (!a) throw new AuthError("customer")
  return a
}

/** The signed-in customer (they've added their number). */
export async function requireCustomer(req: Request): Promise<{ account: Account; customer: Customer }> {
  const account = await requireAccount(req)
  const customer = await customerForAccount((await core())!, account.userId)
  if (!customer) throw new ForbiddenError("Add your phone number to your account first.")
  return { account, customer }
}

/** A /api/v1/customer handler for a signed-in customer; errors are answered like the other APIs. */
export const asCustomer =
  <C = unknown>(fn: (who: { account: Account; customer: Customer }, req: Request, ctx: C) => Promise<unknown>) =>
  (req: Request, ctx: C) =>
    handle(async () => fn(await requireCustomer(req), req, ctx))

/** A handler for any signed-in account (before they've added their number too). */
export const asAccount =
  <C = unknown>(fn: (account: Account, req: Request, ctx: C) => Promise<unknown>) =>
  (req: Request, ctx: C) =>
    handle(async () => fn(await requireAccount(req), req, ctx))
