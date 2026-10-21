import { cookies } from "next/headers"
import { DEV_COOKIE, authMode, supabaseAuth } from "@/lib/cms/auth"
import { handle } from "@/lib/server/api"

// Signs out of mission control (and the CMS: it's the same staff sign-in).

export const POST = () =>
  handle(async () => {
    if (authMode() === "supabase") await (await supabaseAuth()).auth.signOut()
    ;(await cookies()).delete(DEV_COOKIE)
  })
