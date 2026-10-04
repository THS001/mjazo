import { all } from "@/lib/server/docs"
import { aiEnabled } from "@/lib/ai/anthropic"
import { karachiNow, nextDays } from "@/lib/time"
import { handle } from "@/lib/server/api"
import { requireOps } from "@/lib/server/session"
import { getComplaints, getOpenSos, getPros, publicPro, safetySweep, syncJobs } from "@/lib/server/ops"
import type { Job } from "@/lib/ops/types"
import { paymentNeedsCheck, windowIndex } from "@/lib/ops/logic"

// Everything the ops console's live board needs, in one poll. Also runs the Safety Guardian sweep.

const lite = (j: Job) => (j.paymentRecord?.screenshot ? { ...j, paymentRecord: { ...j.paymentRecord, screenshot: "1" } } : j)

export async function GET(req: Request) {
  return handle(async () => {
    await requireOps()
    const today = karachiNow().date
    const q = new URL(req.url).searchParams.get("date") ?? ""
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today
    const [jobs, pros, complaints, sos, weddings] = await Promise.all([syncJobs(), getPros(), getComplaints(), getOpenSos(), all<{ id: string; status: string }>("weddings")])
    const live = await safetySweep(jobs.filter((j) => j.date === today))
    const dayJobs = date === today ? live : jobs.filter((j) => j.date === date).map((j) => ({ ...j, safety: { level: "ok" as const, message: "" } }))
    const alerts = live.filter((j) => j.safety.level !== "ok" && j.status !== "cancelled")

    const weekAgo = new Date(new Date(`${today}T00:00:00Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10)
    const twoWeeks = new Date(new Date(`${today}T00:00:00Z`).getTime() - 13 * 86400000).toISOString().slice(0, 10)
    const week = jobs.filter((j) => j.status === "completed" && j.date >= weekAgo && j.date <= today && j.proId)
    const proDays = new Set(week.map((j) => `${j.proId}|${j.date}`)).size
    const active = dayJobs.filter((j) => j.status !== "cancelled")
    const stats = {
      jobs: active.length,
      unassigned: active.filter((j) => j.status === "new").length,
      live: active.filter((j) => ["en_route", "checked_in", "checked_out"].includes(j.status)).length,
      done: active.filter((j) => j.status === "completed").length,
      revenue: active.reduce((s, j) => s + j.total, 0),
      perProDay: proDays ? +(week.length / proDays).toFixed(2) : 0,
      unreconciled: jobs.filter((j) => j.status === "completed" && j.date >= twoWeeks && paymentNeedsCheck(j)).length,
      openComplaints: complaints.filter((c) => c.status !== "resolved").length,
      weddingsPending: weddings.filter((w) => w.status === "submitted").length,
    }
    const days = nextDays(8).map((d) => d.iso)
    const counts = days.map((d) => ({ date: d, count: jobs.filter((j) => j.date === d && j.status !== "cancelled").length }))
    return { today, date, jobs: dayJobs.sort((a, b) => windowIndex(a.window) - windowIndex(b.window) || (a.routeOrder ?? 9) - (b.routeOrder ?? 9)).map(lite), alerts: alerts.map(lite), sos, pros: pros.map(publicPro), stats, days: counts, ai: aiEnabled() }
  })
}
