import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { getCatalog } from "@/lib/cms/read"
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

const body = z.object({ plan: planSchema })

export async function POST(req: Request) {
  if (rateLimited(`shaadi-submit:${clientIp(req)}`, 5, 10 * 60_000)) return NextResponse.json({ error: "Too many attempts. Please try again later or WhatsApp us." }, { status: 429 })
  return handle(async () => {
    const plan = body.parse(await readJson(req)).plan as ShaadiPlan
    const c = plan.contact
    if (c.name.trim().length < 2) return NextResponse.json({ error: "Please add your name." }, { status: 422 })
    if (!PK_PHONE.test(c.phone.replace(/[\s-]/g, ""))) return NextResponse.json({ error: "Please add a Pakistani mobile number, e.g. 0300 1234567." }, { status: 422 })
    const cat = await getCatalog()
    if (!cat.getArea(c.area)) return NextResponse.json({ error: "Please choose your area." }, { status: 422 })
    if (c.address.trim().length < 5) return NextResponse.json({ error: "Please add the address where the glam happens." }, { status: 422 })
    if (!plan.events.length || !plan.people.length) return NextResponse.json({ error: "Add at least one event and one person." }, { status: 422 })
    const today = karachiNow().date
    if (plan.events.some((e) => e.date <= today)) return NextResponse.json({ error: "One of the events is today or in the past. Please check the dates, or WhatsApp us for last-minute glam." }, { status: 422 })
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
