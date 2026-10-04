import { NextResponse } from "next/server"
import { aiEnabled, rateLimited } from "@/lib/ai/anthropic"
import { opsAsk } from "@/lib/ai/staff-agents"
import { handle, readJson } from "@/lib/server/api"
import { requireOps } from "@/lib/server/session"
import { getComplaints, getPros, syncJobs } from "@/lib/server/ops"

export const maxDuration = 60

export async function POST(req: Request) {
  return handle(async () => {
    await requireOps()
    if (!aiEnabled()) return NextResponse.json({ error: "AI isn't switched on yet (ANTHROPIC_API_KEY)." }, { status: 503 })
    if (rateLimited("ops-ask", 30)) return NextResponse.json({ error: "Too many questions at once. Try again in a minute." }, { status: 429 })
    const { question } = await readJson(req)
    if (typeof question !== "string" || question.trim().length < 3) return NextResponse.json({ error: "Ask a question." }, { status: 400 })
    const [jobs, pros, complaints] = await Promise.all([syncJobs(), getPros(), getComplaints()])
    const { text } = await opsAsk(question.slice(0, 1000), { jobs, pros, complaints })
    return { answer: text }
  })
}
