import "server-only"
import crypto from "crypto"
import { authMode } from "@/lib/cms/auth"
import { core, type Db } from "@/lib/core/db"
import { customerForAccount, customerForPhoneSession, type Customer } from "@/lib/core/customers"
import { handle } from "./api"
import { PHONE_TOKEN, type PhoneSession } from "./phone-sign-in"
import { AuthError, ForbiddenError, readPayload, signPayload } from "./session"
import { db as supabase } from "./store"

// Who is using the client account (/api/v1/customer). Customers sign in with an emailed link
// (Supabase) or with their phone number and a code (lib/server/phone-sign-in.ts); the website and
// the phone app both send the token as "Authorization: Bearer <token>", so the API works the same
// for both. Locally without Supabase, a test sign-in gives a signed "mjc." token instead, which is
// refused anywhere else.

/** An emailed sign-in (the customer is found once they add their number), or a phone sign-in (always a customer). */
export type Account = { by: "email"; userId: string; email: string } | { by: "phone"; customer: Customer; email: string | null }

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
  if (token.startsWith(PHONE_TOKEN)) {
    const v = readPayload<PhoneSession>(token.slice(PHONE_TOKEN.length))
    const db = v?.kind === "customer-phone" ? await core() : null
    const customer = db && v ? await customerForPhoneSession(db, { customerId: v.customerId, phone: v.phone, epoch: v.se }) : null
    return customer ? { by: "phone", customer, email: customer.email } : null
  }
  if (token.startsWith(DEV_PREFIX)) {
    if (authMode() !== "dev") return null
    const v = readPayload<{ kind: string; email: string; userId: string }>(token.slice(DEV_PREFIX.length))
    return v?.kind === "customer-dev" ? { by: "email", userId: v.userId, email: v.email } : null
  }
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.email) return null
  return { by: "email", userId: data.user.id, email: data.user.email.toLowerCase() }
}

/** The customer behind an account (null: an emailed sign-in that hasn't added its number yet). */
export const accountCustomer = async (db: Db, a: Account) => (a.by === "phone" ? a.customer : customerForAccount(db, a.userId))

/** The signed-in customer of a request, or undefined (signed out, or no number yet). For APIs guests use too. */
export async function customerOf(req: Request): Promise<Customer | undefined> {
  const a = await accountOf(req)
  const db = a ? await core() : null
  return (db && a && (await accountCustomer(db, a))) || undefined
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
  const customer = await accountCustomer((await core())!, account)
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
