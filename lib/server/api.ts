import "server-only"
import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { AuthError } from "./session"
import { OpsError } from "./ops"
import { ValidationError } from "./store"

// Shared error handling for the staff and Phase 2 API routes.
export async function handle(fn: () => Promise<unknown>) {
  try {
    const out = await fn()
    return out instanceof Response ? out : NextResponse.json(out ?? { ok: true })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Please log in again." }, { status: 401 })
    if (e instanceof OpsError || e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid request" }, { status: 422 })
    console.error("[api]", e)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}

export const readJson = (req: Request) => req.json().catch(() => ({})) as Promise<Record<string, unknown>>
