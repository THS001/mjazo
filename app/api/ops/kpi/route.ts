import { handle } from "@/lib/server/api"
import { requireStaff } from "@/lib/server/staff"
import { kpiReport } from "@/lib/server/ops"

// The KPI dashboard: bookings, completion rate, GMV, repeat rate, visits per pro-day and
// unreconciled cash, for the last 7, 30 or 90 days.

export async function GET(req: Request) {
  return handle(async () => {
    await requireStaff("ops.kpi")
    const n = Number(new URL(req.url).searchParams.get("days"))
    return kpiReport([7, 30, 90].includes(n) ? n : 30)
  })
}
