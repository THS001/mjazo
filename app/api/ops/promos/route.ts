import { z } from "zod"
import { audit } from "@/lib/server/audit"
import { handle, readJson } from "@/lib/server/api"
import { requireStaff } from "@/lib/server/staff"
import { listPromos, savePromo } from "@/lib/server/ops"

// Promo codes: create, change, switch on or off. A code that has been used keeps its discount.

const promo = z.object({
  code: z.string().max(20),
  kind: z.enum(["percent", "fixed"]),
  value: z.number().int(),
  minOrder: z.number().int().optional(),
  maxDiscount: z.number().int().nullable().optional(),
  maxUses: z.number().int().nullable().optional(),
  perCustomer: z.number().int().optional(),
  startsAt: z.string().max(40).nullable().optional(),
  endsAt: z.string().max(40).nullable().optional(),
  active: z.boolean().optional(),
  note: z.string().max(300).optional(),
})
const body = z.object({ action: z.enum(["create", "update"]), promo })

export async function GET() {
  return handle(async () => {
    await requireStaff("ops.promos")
    return { promos: await listPromos() }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireStaff("ops.promos")
    const b = body.parse(await readJson(req))
    const code = await savePromo(b.promo, me.email, b.action === "create")
    const p = b.promo
    await audit(me.email, b.action === "create" ? "created a promo code" : "changed a promo code", code, `${p.kind === "percent" ? `${p.value}%` : `PKR ${p.value}`} off${p.active === false ? ", off" : ""}`)
    return { promos: await listPromos() }
  })
}
