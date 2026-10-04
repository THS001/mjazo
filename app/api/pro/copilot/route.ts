import { NextResponse } from "next/server"
import type Anthropic from "@anthropic-ai/sdk"
import { aiEnabled, rateLimited } from "@/lib/ai/anthropic"
import { morningBrief, runProCopilot } from "@/lib/ai/staff-agents"
import { karachiNow } from "@/lib/time"
import { handle, readJson } from "@/lib/server/api"
import { AuthError, requirePro } from "@/lib/server/session"
import { getPros, syncJobs, updateJob } from "@/lib/server/ops"
import { windowIndex } from "@/lib/ops/logic"

export const maxDuration = 60

type Msg = { role: "user" | "assistant"; text: string; image?: string }

/** Plain alternating turns, last 16, starting with the pro; only the newest message keeps its photo. */
function toHistory(msgs: Msg[]): Anthropic.MessageParam[] {
  const clean = msgs.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string").slice(-16)
  while (clean.length && clean[0].role !== "user") clean.shift()
  const out: Anthropic.MessageParam[] = []
  clean.forEach((m, i) => {
    const last = i === clean.length - 1
    const content: Anthropic.ContentBlockParam[] = []
    if (last && m.role === "user" && m.image?.startsWith("data:image/jpeg;base64,")) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: m.image.split(",")[1] } })
    content.push({ type: "text", text: m.text.slice(0, 2000) || "(photo)" })
    const prev = out[out.length - 1]
    if (prev && prev.role === m.role && Array.isArray(prev.content)) (prev.content as Anthropic.ContentBlockParam[]).push(...content)
    else out.push({ role: m.role, content })
  })
  return out
}

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requirePro()
    if (!aiEnabled()) return NextResponse.json({ error: "Copilot isn't switched on yet." }, { status: 503 })
    if (rateLimited(`copilot:${s.proId}`, 20)) return NextResponse.json({ error: "Too many messages. Wait a minute." }, { status: 429 })
    const pro = (await getPros()).find((p) => p.id === s.proId)
    if (!pro) throw new AuthError("pro")
    const b = await readJson(req)
    const jobs = await syncJobs()
    const today = jobs.filter((j) => j.proId === pro.id && j.date === karachiNow().date && j.status !== "cancelled").sort((a, b) => (a.routeOrder ?? 99) - (b.routeOrder ?? 99) || windowIndex(a.window) - windowIndex(b.window))

    if (b.brief) {
      const lang = b.lang === "ur" || b.lang === "ro" ? b.lang : "en"
      return { text: await morningBrief(pro, today, lang) }
    }
    const history = toHistory(Array.isArray(b.messages) ? (b.messages as Msg[]) : [])
    if (!history.length) return NextResponse.json({ error: "Say something first." }, { status: 400 })
    const saveNote = async (jobId: string, note: string) => {
      await updateJob(jobId, (job) => {
        job.visitNotes = [...(job.visitNotes ?? []), `${job.date}: ${note}`]
      })
    }
    const { text } = await runProCopilot(pro, today, jobs, history, saveNote)
    return { reply: text }
  })
}
