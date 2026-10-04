import { audit } from "@/lib/server/audit"
import { z } from "zod"
import { handle, readJson } from "@/lib/server/api"
import { hashPin, requireOps } from "@/lib/server/session"
import { all, get, put } from "@/lib/server/docs"
import { PK_PHONE, newId } from "@/lib/server/store"
import { OpsError, normalisePhone, nowIso, publicPro } from "@/lib/server/ops"
import type { Pro } from "@/lib/ops/types"

const pin = z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits")
const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().min(2, "Enter the pro's name"),
    phone: z.string().regex(PK_PHONE, "Invalid Pakistani mobile number"),
    area: z.string().min(1, "Choose a home area"),
    skills: z.array(z.string()).min(1, "Pick at least one skill"),
    women: z.boolean(),
    pin,
  }),
  z.object({ action: z.literal("update"), id: z.string(), status: z.enum(["active", "paused"]).optional(), skills: z.array(z.string()).optional(), area: z.string().optional(), women: z.boolean().optional() }),
  z.object({ action: z.literal("pin"), id: z.string(), pin }),
])

export async function GET() {
  return handle(async () => {
    await requireOps()
    return { pros: (await all<Pro>("pros")).map(publicPro) }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireOps()
    const b = body.parse(await readJson(req))
    if (b.action === "create") {
      const phone = normalisePhone(b.phone)
      if ((await all<Pro>("pros")).some((p) => p.phone === phone)) throw new OpsError("A pro with this number already exists")
      const pro: Pro = { id: `P-${newId().slice(3)}`, name: b.name.trim(), phone, area: b.area, skills: b.skills, women: b.women, status: "active", pinHash: hashPin(b.pin), createdAt: nowIso() }
      await put("pros", pro)
      await audit("ops", "added pro", pro.id, pro.name)
      return { pro: publicPro(pro) }
    }
    const pro = await get<Pro>("pros", b.id)
    if (!pro) throw new OpsError("Pro not found")
    if (b.action === "pin") pro.pinHash = hashPin(b.pin)
    else {
      if (b.status) pro.status = b.status
      if (b.skills) pro.skills = b.skills
      if (b.area) pro.area = b.area
      if (b.women !== undefined) pro.women = b.women
    }
    await put("pros", pro)
    await audit("ops", b.action === "pin" ? "reset pro PIN" : "updated pro", pro.id, b.action === "update" ? JSON.stringify({ status: b.status, area: b.area }) : "")
    return { pro: publicPro(pro) }
  })
}
