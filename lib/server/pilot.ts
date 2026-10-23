import "server-only"
import { getCatalog } from "@/lib/cms/read"
import { requireCore } from "@/lib/core/db"
import { pilotSettings, visitMargins } from "@/lib/core/pilot"
import { pilotGates } from "@/lib/ops/pilot"
import { leakageWatch, type LeakState } from "@/lib/ops/trust"
import { karachiNow } from "@/lib/time"
import { all } from "./docs"
import { allJobs, getPros } from "./ops"

// The pilot gates for mission control (KPIs → Pilot gates): the jobs, the pros, the founder's
// inputs, the ledger's margin per visit and the leakage watch, put through lib/ops/pilot.ts.

export type PilotWindow = "pilot" | 30 | 90

export async function pilotReport(window: PilotWindow) {
  const db = await requireCore()
  const today = karachiNow().date
  const [settings, jobs, pros, leakStates, cat] = await Promise.all([pilotSettings(db), allJobs(), getPros(), all<LeakState>("leak"), getCatalog()])
  const firstDone = jobs.filter((j) => j.status === "completed").map((j) => j.date).sort()[0]
  const from = window === "pilot" ? (settings.startDate ?? firstDone ?? today) : new Date(Date.parse(`${today}T00:00:00Z`) - (window - 1) * 86400_000).toISOString().slice(0, 10)
  const done = jobs.filter((j) => j.status === "completed" && j.date >= from && j.date <= today)
  // Pairs ops looked into and explained (dismissed) don't count against the gate.
  const openLeaks = leakageWatch(jobs, pros, today, leakStates.filter((s) => s.status === "dismissed"), cat).length
  const report = pilotGates({ jobs, pros, today, from, to: today, settings, margins: await visitMargins(db, done.map((j) => j.id)), openLeaks })
  return {
    ...report,
    window,
    settings: { startDate: settings.startDate, taxRate: settings.taxRate, taxInclusive: settings.taxInclusive, taxBase: settings.taxBase },
    months: Object.entries(settings.months)
      .map(([month, m]) => ({ month, ...m }))
      .sort((a, b) => b.month.localeCompare(a.month)),
  }
}
