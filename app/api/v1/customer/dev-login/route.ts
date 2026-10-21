import { NextResponse } from "next/server"
import { z } from "zod"
import { authMode } from "@/lib/cms/auth"
import { handle, readJson } from "@/lib/server/api"
import { devCustomerToken } from "@/lib/server/customer-auth"

// Local development only (no Supabase): sign in as a test customer with any email, to try the
// account screens. Refused in production, where customers sign in with an emailed link.

export async function POST(req: Request) {
  if (authMode() !== "dev") return NextResponse.json({ error: "Not available here." }, { status: 404 })
  return handle(async () => {
    const { email } = z.object({ email: z.string().trim().email("Enter an email").max(200) }).parse(await readJson(req))
    return { token: devCustomerToken(email) }
  })
}
