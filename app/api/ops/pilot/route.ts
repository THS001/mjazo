import { z } from "zod"
import { requireCore } from "@/lib/core/db"
import { savePilotMonth, savePilotSettings } from "@/lib/core/pilot"
import { handle, readJson } from "@/lib/server/api"
import { pilotReport } from "@/lib/server/pilot"
import { requireStaff } from "@/lib/server/staff"

// The pilot gates (KPIs → Pilot gates): GET the report for "pilot" (since the start), 30 or 90
// days. POST the founder's inputs (Finance or an Owner): the start date and sales tax
// assumptions, or a month's ad and transport spend.

export async function GET(req: Request) {
  return handle(async () => {
    await requireStaff("ops.kpi")
    const w = new URL(req.url).searchParams.get("window")
    return pilotReport(w === "30" ? 30 : w === "90" ? 90 : "pilot")
  })
}

const rupees = z.number().int().min(0).max(100_000_000)
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), startDate: z.string().max(10).nullable().optional(), taxRate: z.number().min(0).max(0.25).optional(), taxInclusive: z.boolean().optional(), taxBase: z.enum(["total", "commission"]).optional() }),
  z.object({ action: z.literal("month"), month: z.string().max(7), marketing: rupees, transport: rupees, note: z.string().max(200).optional() }),
  z.object({ action: z.literal("remove_month"), month: z.string().max(7) }),
])

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireStaff("ops.money")
    const b = body.parse(await readJson(req))
    const db = await requireCore()
    if (b.action === "settings") await savePilotSettings(db, { startDate: b.startDate, taxRate: b.taxRate, taxInclusive: b.taxInclusive, taxBase: b.taxBase }, me.email)
    else if (b.action === "month") await savePilotMonth(db, b.month, { marketing: b.marketing, transport: b.transport, note: b.note }, me.email)
    else await savePilotMonth(db, b.month, null, me.email)
    return { ok: true }
  })
}
