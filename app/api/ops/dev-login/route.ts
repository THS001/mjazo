import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { DEV_COOKIE } from "@/lib/cms/auth"
import { ROLES } from "@/lib/cms/roles"
import { handle, readJson } from "@/lib/server/api"
import { staffMode } from "@/lib/server/staff"

// Local development only (no Supabase): sign in to mission control as a local person of any role,
// to try each role's screens. The same "local owner" cookie as the CMS; refused in production.

export async function POST(req: Request) {
  if (staffMode() !== "dev") return NextResponse.json({ error: "Not available here." }, { status: 404 })
  return handle(async () => {
    const { role } = await readJson(req)
    if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) return NextResponse.json({ error: "Pick a role." }, { status: 400 })
    ;(await cookies()).set(DEV_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 })
    return { ok: true }
  })
}
