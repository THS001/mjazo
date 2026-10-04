import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { db } from "@/lib/server/store"
import { can, ROLES, type Perm, type Role } from "./roles"

// Who is signed in to /admin. Production uses Supabase Auth (email + password or a magic link)
// with roles in the cms_users table. In local development without Supabase, a "local owner"
// session lets you build and test the CMS; it is never accepted in production.

export type CmsUser = { id: string; email: string; name: string; role: Role }

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const DEV_COOKIE = "mjz_cms_dev"

/** "supabase" when sign-in is configured, "dev" for local development, "off" otherwise. */
export function authMode(): "supabase" | "dev" | "off" {
  if (PUBLIC_URL && ANON && db) return "supabase"
  return process.env.NODE_ENV === "production" ? "off" : "dev"
}

/** A Supabase client bound to the request cookies (sign-in session). */
export async function supabaseAuth() {
  const jar = await cookies()
  return createServerClient(PUBLIC_URL!, ANON!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        // Server Components can't set cookies; proxy.ts refreshes the session instead.
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options))
        } catch {}
      },
    },
  })
}

export const getCmsUser = cache(async (): Promise<CmsUser | null> => {
  const mode = authMode()
  if (mode === "dev") {
    const v = (await cookies()).get(DEV_COOKIE)?.value
    return v ? { id: "local-owner", email: "owner@localhost", name: "Local owner", role: "owner" } : null
  }
  if (mode !== "supabase") return null
  const { data } = await (await supabaseAuth()).auth.getUser()
  const u = data.user
  if (!u?.email) return null
  const email = u.email.toLowerCase()
  let { data: row } = await db!.from("cms_users").select("*").eq("id", u.id).maybeSingle()
  if (!row) {
    // First sign-in of the Owner named in CMS_OWNER_EMAIL creates their account.
    const owner = process.env.CMS_OWNER_EMAIL?.toLowerCase().trim()
    if (owner && email === owner) {
      const created = await db!.from("cms_users").upsert({ id: u.id, email, name: u.user_metadata?.name ?? email.split("@")[0], role: "owner", active: true }).select().single()
      row = created.data
    }
  }
  if (!row?.active || !ROLES.includes(row.role)) return null
  void db!.from("cms_users").update({ last_seen: new Date().toISOString() }).eq("id", u.id).then(() => {})
  return { id: u.id, email, name: row.name || email.split("@")[0], role: row.role }
})

export class CmsAuthError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message)
  }
}

/**
 * The signed-in user, for /admin pages; signed-out visitors go to the sign-in page. Next renders a
 * page alongside its layout, so pages can't rely on the layout's own redirect having happened.
 */
export async function pageUser(): Promise<CmsUser> {
  const u = await getCmsUser()
  if (!u) redirect("/admin/login")
  return u
}

/** The signed-in user if they hold `perm`; throws otherwise. Call at the top of every server action. */
export async function requireCms(perm: Perm = "view"): Promise<CmsUser> {
  const u = await getCmsUser()
  if (!u) throw new CmsAuthError("Please sign in again.")
  if (!can(u.role, perm)) throw new CmsAuthError()
  return u
}
