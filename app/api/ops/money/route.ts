import { z } from "zod"
import { handle, readJson } from "@/lib/server/api"
import { requireStaff } from "@/lib/server/staff"
import { approvePayoutRun, cancelPayoutRun, decideMoney, draftPayoutRun, moneyOverview, payPayout, recordCashIn } from "@/lib/server/ops"

// Money: cash held and owed per pro, payments to reconcile, refunds and credits waiting for
// approval, cash handed in, and payout runs (draft → approved → paid with a reference). Every
// action needs the money permission; approvals need a second person (Owners excepted). The audit
// entries are written inside each money transaction (lib/core/money.ts).

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("decide"), requestId: z.string(), approve: z.boolean(), note: z.string().max(500).optional(), reference: z.string().max(120).optional() }),
  z.object({ action: z.literal("cash_in"), proId: z.string(), amount: z.number().int().positive(), reference: z.string().max(120).optional() }),
  z.object({ action: z.literal("draft_run"), periodStart: day, periodEnd: day }),
  z.object({ action: z.literal("approve_run"), runId: z.string() }),
  z.object({ action: z.literal("pay"), payoutId: z.string(), reference: z.string().max(120) }),
  z.object({ action: z.literal("cancel_run"), runId: z.string() }),
])

export async function GET() {
  return handle(async () => {
    await requireStaff("ops.money")
    return moneyOverview()
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireStaff("ops.money")
    const b = body.parse(await readJson(req))
    const by = { email: me.email, role: me.role }
    if (b.action === "decide") await decideMoney(b.requestId, { approve: b.approve, by, note: b.note, reference: b.reference })
    else if (b.action === "cash_in") await recordCashIn({ proId: b.proId, amount: b.amount, reference: b.reference, by: me.email })
    else if (b.action === "draft_run") await draftPayoutRun({ periodStart: b.periodStart, periodEnd: b.periodEnd, by: me.email })
    else if (b.action === "approve_run") await approvePayoutRun(b.runId, by)
    else if (b.action === "pay") await payPayout(b.payoutId, { reference: b.reference, by: me.email })
    else await cancelPayoutRun(b.runId, me.email)
    return moneyOverview()
  })
}
