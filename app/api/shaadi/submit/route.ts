import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { getCatalog, getPage } from "@/lib/cms/read"
import type { PlannerContent } from "@/lib/cms/types/pages/tools"
import { isLocale } from "@/lib/i18n"
import { computeSchedule, to12h, type ShaadiPlan } from "@/lib/shaadi"
import { planSchema } from "@/lib/shaadi-edit"
import { karachiNow } from "@/lib/time"
import { handle, readJson } from "@/lib/server/api"
import { audit } from "@/lib/server/audit"
import { put } from "@/lib/server/docs"
import { PK_PHONE, newId, notifyOps } from "@/lib/server/store"
import { normalisePhone, nowIso } from "@/lib/server/ops"

// The family sends their plan to the Mjazo wedding coordinator. Nothing is booked until a person
// approves it in the ops console (which then creates the visits).

export type WeddingDoc = { id: string; createdAt: string; status: "submitted" | "approved" | "declined"; plan: ShaadiPlan; total: number; note?: string; jobIds?: string[]; decidedAt?: string }

const body = z.object({ plan: planSchema, locale: z.string().optional() })

export async function POST(req: Request) {
  const json = await readJson(req)
  const locale = typeof json.locale === "string" && isLocale(json.locale) ? json.locale : "en"
  // `code` picks the family's message (Tool text → Errors and messages); `error` is the fallback text.
  const { errors } = (await getPage<PlannerContent>("shaadi-planner", locale)).tool
  const fail = (code: keyof typeof errors, status = 422) => NextResponse.json({ code, error: errors[code] }, { status })
  if (rateLimited(`shaadi-submit:${clientIp(req)}`, 5, 10 * 60_000)) return fail("tooManyAttempts", 429)
  return handle(async () => {
    const plan = body.parse(json).plan as ShaadiPlan
    const c = plan.contact
    if (c.name.trim().length < 2) return fail("name")
    if (!PK_PHONE.test(c.phone.replace(/[\s-]/g, ""))) return fail("phone")
    const cat = await getCatalog()
    if (!cat.getArea(c.area)) return fail("area")
    if (c.address.trim().length < 5) return fail("address")
    if (!plan.events.length || !plan.people.length) return fail("empty")
    const today = karachiNow().date
    if (plan.events.some((e) => e.date <= today)) return fail("past")
    const s = computeSchedule(plan, today, cat)
    const doc: WeddingDoc = { id: `W-${newId().slice(3)}`, createdAt: nowIso(), status: "submitted", plan: { ...plan, contact: { ...c, phone: normalisePhone(c.phone) } }, total: s.total }
    await put("weddings", doc)
    await audit("customer", "sent a wedding plan", doc.id, `${plan.people.length} people, ${plan.events.length} events`)
    void notifyOps(
      `[Mjazo] Wedding plan ${doc.id}: ${plan.title}`,
      `${c.name} (${c.phone}), ${cat.getArea(c.area)?.name}\n${plan.events.map((e) => `${e.name} ${e.date}, photos ${to12h(e.readyBy)}`).join("\n")}\n${plan.people.length} people · PKR ${s.total.toLocaleString("en-PK")}${s.quoted.length ? ` + quoted: ${s.quoted.join(", ")}` : ""}\nReview and approve in the ops console → Weddings.`,
    )
    return { id: doc.id }
  })
}
