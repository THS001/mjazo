import { NextResponse } from "next/server"
import { aiEnabled, rateLimited } from "@/lib/ai/anthropic"
import { runInterview } from "@/lib/ai/staff-agents"
import { handle, readJson } from "@/lib/server/api"
import { mutate, put } from "@/lib/server/docs"
import { notifyOps } from "@/lib/server/store"
import { findApplication } from "@/lib/server/ops"
import type { Application } from "@/lib/ops/types"

export const maxDuration = 60

// Recruiter Agent: the applicant's own interview link. AI asks, scores and summarises; a person
// at Mjazo reviews every interview and makes the decision.

const MAX_ANSWERS = 10

/** Practical test slots: the next six days except Sunday, 11 am and 3 pm. */
function testSlots() {
  const out: string[] = []
  const base = new Date(Date.now() + 5 * 3600000)
  for (let i = 1; out.length < 12 && i < 10; i++) {
    const d = new Date(base.getTime() + i * 86400000)
    if (d.getUTCDay() === 0) continue
    const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    out.push(`${label}, 11:00 am`, `${label}, 3:00 pm`)
  }
  return out
}

const view = (a: Application) => ({
  name: a.name.split(" ")[0],
  lang: a.lang,
  status: a.status,
  turns: a.interview ?? [],
  done: !["new", "interviewing"].includes(a.status),
  testSlot: a.testSlot,
  slots: a.status === "interviewed" ? testSlots() : [],
  ai: aiEnabled(),
})

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_: Request, { params }: Ctx) {
  return handle(async () => {
    const app = await findApplication((await params).token)
    if (!app) return NextResponse.json({ error: "This interview link isn't valid." }, { status: 404 })
    return view(app)
  })
}

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { token } = await params
    if (rateLimited(`interview:${token}`, 30, 60 * 60_000)) return NextResponse.json({ error: "Please wait a little and try again." }, { status: 429 })
    const app = await findApplication(token)
    if (!app) return NextResponse.json({ error: "This interview link isn't valid." }, { status: 404 })
    const b = await readJson(req)

    if (typeof b.slot === "string") {
      if (app.status !== "interviewed" || !testSlots().includes(b.slot)) return NextResponse.json({ error: "Please pick one of the times shown." }, { status: 400 })
      Object.assign(app, { status: "test_booked", testSlot: b.slot })
      await put("applications", app)
      await notifyOps(`[Mjazo] Practical test booked: ${app.name}`, `${app.name} (${app.phone}, ${app.area}) booked a practical test for ${b.slot}.\nSkills: ${app.skills.join(", ")}\nAI summary: ${app.summary ?? "—"}`)
      return view(app)
    }

    if (!["new", "interviewing"].includes(app.status)) return view(app)
    if (!aiEnabled()) return NextResponse.json({ error: "The online interview is offline right now. Our team will call you instead." }, { status: 503 })
    const turns = [...(app.interview ?? [])]
    const seen = turns.length
    const text = typeof b.text === "string" ? b.text.trim().slice(0, 1500) : ""
    if (text) turns.push({ role: "user", text })
    else if (turns.length) return view(app)
    const answers = turns.filter((t) => t.role === "user").length
    const r = await runInterview(app, turns, answers >= MAX_ANSWERS)
    turns.push({ role: "assistant", text: r.reply })
    // Save only if nothing changed meanwhile (a double-send, or ops deciding during the AI call).
    let stale = false
    const saved = await mutate<Application>("applications", app.id, (a) => {
      if (!["new", "interviewing"].includes(a.status) || (a.interview?.length ?? 0) !== seen) return void (stale = true)
      a.interview = turns
      a.status = "interviewing"
      if (r.done) Object.assign(a, { status: "interviewed", scores: r.scores, summary: r.summary, strengths: r.strengths, concerns: r.concerns })
    })
    if (stale || !saved) return view((await findApplication(token)) ?? app)
    if (r.done) {
      const avg = (Object.values(r.scores).reduce((s, n) => s + n, 0) / 6).toFixed(1)
      void notifyOps(`[Mjazo] Interview done: ${app.name} (${avg}/5)`, `${app.name} (${app.phone}, ${app.area})\n${r.summary}\nStrengths: ${r.strengths.join("; ")}\nConcerns: ${r.concerns.join("; ")}`)
    }
    return view(saved)
  })
}
