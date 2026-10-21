import { audit } from "@/lib/server/audit"
import { z } from "zod"
import { handle, readJson } from "@/lib/server/api"
import { hashPin } from "@/lib/server/session"
import { requireStaff } from "@/lib/server/staff"
import { PK_PHONE, newId } from "@/lib/server/store"
import { OpsError, getPro, getPros, normalisePhone, nowIso, publicPro, savePro, saveProProfile, setZoneCap, verifyPro, zonesOverview } from "@/lib/server/ops"
import { isVerified, VERIFICATION_ITEMS, type Pro, type VerificationKey } from "@/lib/ops/types"

// Pros: the roster, PINs, profile (zones, daily cap, weekly windows, days off, commission), the
// verification checklist, and the zones' daily caps.

const pin = z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits")
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const keys = VERIFICATION_ITEMS.map((i) => i.key) as [string, ...string[]]
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
  z.object({
    action: z.literal("profile"),
    id: z.string(),
    zones: z.array(z.string().max(60)).max(20).optional(),
    dailyCap: z.number().int().optional(),
    commissionRate: z.number().optional(),
    availability: z.record(z.string(), z.array(z.string())).nullable().optional(),
    timeOff: z.object({ add: z.array(day).max(60).optional(), remove: z.array(day).max(60).optional() }).optional(),
  }),
  z.object({ action: z.literal("verify"), id: z.string(), key: z.enum(keys), done: z.boolean(), last4: z.string().max(4).optional(), note: z.string().max(200).optional() }),
  z.object({ action: z.literal("zone_cap"), slug: z.string(), cap: z.number().int().nullable() }),
])

export async function GET(req: Request) {
  return handle(async () => {
    await requireStaff("ops.view")
    if (new URL(req.url).searchParams.get("zones")) return { zones: await zonesOverview() }
    return { pros: (await getPros()).map(publicPro) }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = body.parse(await readJson(req))
    if (b.action === "zone_cap") {
      const me = await requireStaff("ops.pros")
      await setZoneCap(b.slug, b.cap)
      await audit(me.email, "set a zone cap", b.slug, b.cap === null ? "no cap" : `${b.cap} visits a day`)
      return { zones: await zonesOverview() }
    }
    if (b.action === "create") {
      const me = await requireStaff("ops.pros")
      const phone = normalisePhone(b.phone)
      if ((await getPros()).some((p) => p.phone === phone)) throw new OpsError("A pro with this number already exists")
      const pro: Pro = { id: `P-${newId().slice(3)}`, name: b.name.trim(), phone, area: b.area, skills: b.skills, women: b.women, status: "active", pinHash: hashPin(b.pin), createdAt: nowIso() }
      await savePro(pro)
      await audit(me.email, "added pro", pro.id, pro.name)
      return { pro: publicPro(pro) }
    }
    if (b.action === "verify") {
      const me = await requireStaff("ops.verify")
      const pro = await verifyPro(b.id, b.key as VerificationKey, { done: b.done, last4: b.last4, note: b.note }, me.email)
      const label = VERIFICATION_ITEMS.find((i) => i.key === b.key)!.label
      // One tick is one check: "verified" only once the whole checklist is done.
      const action = !b.done ? "unticked a pro check" : pro && isVerified(pro) ? "ticked the last check: pro verified" : "ticked a pro check"
      await audit(me.email, action, b.id, b.done && b.key === "cnic" ? `${label} (ends ${b.last4})` : label)
      return { pro: pro && publicPro(pro) }
    }
    if (b.action === "profile") {
      // Commission decides what she's paid: that's a money decision.
      const me = await requireStaff(b.commissionRate !== undefined ? "ops.money" : "ops.pros")
      const { action, id, ...patch } = b
      void action
      const pro = await saveProProfile(id, patch)
      await audit(me.email, "updated pro schedule", id, Object.keys(patch).join(", ") + (b.commissionRate !== undefined ? ` (commission ${Math.round(b.commissionRate * 100)}%)` : ""))
      return { pro: pro && publicPro(pro) }
    }
    const me = await requireStaff("ops.pros")
    const pro = await getPro(b.id)
    if (!pro) throw new OpsError("Pro not found")
    if (b.action === "pin") pro.pinHash = hashPin(b.pin)
    else {
      if (b.status) pro.status = b.status
      if (b.skills) pro.skills = b.skills
      if (b.area) pro.area = b.area
      if (b.women !== undefined) pro.women = b.women
    }
    await savePro(pro)
    await audit(me.email, b.action === "pin" ? "reset pro PIN" : "updated pro", pro.id, b.action === "update" ? JSON.stringify({ status: b.status, area: b.area }) : "")
    return { pro: publicPro(pro) }
  })
}
