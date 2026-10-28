import { z } from "zod"
import { requireCore } from "@/lib/core/db"
import { policy, receiptsReady, savePolicy } from "@/lib/core/policy"
import { receiptsInMonth, taxMonths } from "@/lib/core/receipts"
import { taxPct } from "@/lib/ops/policy"
import { handle, readJson } from "@/lib/server/api"
import { requireStaff } from "@/lib/server/staff"

// Money → Policies (Finance or an Owner): the money policies Mjazo applies by itself, and the
// sales tax on receipts by month for the SRB return. GET ?csv=YYYY-MM downloads that month's
// receipts. Every change is in the audit log (lib/core/policy.ts).

async function overview() {
  const db = await requireCore()
  return { ready: await receiptsReady(db), tax: await policy(db, "tax"), taxMonths: await taxMonths(db), pairRate: await policy(db, "pair_rate") }
}

/** A CSV cell. Text that a spreadsheet would run as a formula (a name starting with =, +, - or @) is kept as text. */
const cell = (v: string | number) => {
  const s = typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** When it was issued, in Karachi time: 2026-10-29 01:02. */
const karachiTime = (iso: string) => new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Karachi", hour12: false }).slice(0, 16)

export async function GET(req: Request) {
  return handle(async () => {
    await requireStaff("ops.money")
    const month = new URL(req.url).searchParams.get("csv")
    if (!month) return overview()
    const rows = await receiptsInMonth(await requireCore(), month)
    const lines = [
      ["Receipt", "Issued (Karachi)", "Booking", "Visit day", "Customer", "Total (PKR)", "Taxed value (PKR)", "Sales tax (PKR)", "Rate", "Inside the price", "On"],
      ...rows.map((r) => [r.number, karachiTime(r.issuedAt), r.bookingId, r.data.date, r.data.customer.name, r.total, r.data.tax?.taxable ?? 0, r.tax, r.data.tax ? `${taxPct(r.data.tax.rate)}%` : "", r.data.tax ? (r.data.tax.inclusive ? "yes" : "no") : "", r.data.tax ? (r.data.tax.base === "total" ? "whole booking" : "Mjazo's share") : ""]),
    ]
    return new Response(lines.map((l) => l.map(cell).join(",")).join("\n") + "\n", {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="mjazo-receipts-${month}.csv"`, "cache-control": "no-store" },
    })
  })
}

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("tax"),
    from: z.string().max(10).nullable().optional(),
    rate: z.number().min(0).max(0.25).optional(),
    inclusive: z.boolean().optional(),
    base: z.enum(["total", "commission"]).optional(),
    registration: z.string().max(60).optional(),
  }),
  z.object({
    action: z.literal("pair_rate"),
    on: z.boolean().optional(),
    rate: z.number().min(0).max(0.5).optional(),
    fromVisit: z.number().int().min(2).max(20).optional(),
    days: z.number().int().min(30).max(730).optional(),
  }),
])

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireStaff("ops.money")
    const b = body.parse(await readJson(req))
    const db = await requireCore()
    if (b.action === "tax") {
      const { action: _, ...patch } = b
      await savePolicy(db, "tax", { ...patch, from: patch.from === "" ? null : patch.from, registration: patch.registration?.trim() }, me.email)
    } else {
      const { action: _, ...patch } = b
      await savePolicy(db, "pair_rate", patch, me.email)
    }
    return overview()
  })
}
