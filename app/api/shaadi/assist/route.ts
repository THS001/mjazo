import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { MODELS, ai, aiEnabled, clientIp, rateLimited } from "@/lib/ai/anthropic"
import { LOOKS, PREP, ROLE_LABEL, computeSchedule, svcInfo, to12h, type ShaadiCatalog, type ShaadiPlan } from "@/lib/shaadi"
import { applyPatch, planSchema, type PlanPatch } from "@/lib/shaadi-edit"
import { karachiNow } from "@/lib/time"
import { getCatalog, whatsappLink } from "@/lib/cms/read"

export const maxDuration = 60

// Shaadi Orchestrator assistant: the family describes their wedding in their own words; the AI
// edits the plan through validated patches and reads back the computed schedule. It never
// writes times or prices itself: the engine computes those.

const body = z.object({
  plan: planSchema,
  message: z.string().min(1).max(1500),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(3000) })).max(12).optional(),
})

const sel = { type: "string", description: "Person: id, exact name, a branch name, or one of bride / mother / family / guests / everyone" }
const keys = (o: Record<string, unknown>) => ({ type: "array", items: { type: "string", enum: Object.keys(o) } })
const UPDATE: Anthropic.Tool = {
  name: "update_plan",
  description: "Change the plan: events, people, each person's event looks and pre-wedding prep. Several changes can go in one call.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "e.g. \"Ayesha & Hamza's shaadi\"" },
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["add", "update", "remove"] },
            id: { type: "string", description: "Existing event id (update/remove)" },
            name: { type: "string", description: "Dholki, Mayun, Mehndi, Baraat, Nikkah, Walima…" },
            date: { type: "string", description: "YYYY-MM-DD" },
            ready_by: { type: "string", description: "24-hour HH:MM when everyone must be ready (photo time)" },
            earliest_start: { type: "string", description: "24-hour HH:MM, earliest glam can start at home (optional)" },
          },
          required: ["action"],
        },
      },
      people: {
        type: "array",
        items: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["add", "update", "remove"] },
            id: { type: "string" },
            name: { type: "string", description: "Name or relation, e.g. 'Ammi', 'Sara', 'Cousin'. With count > 1 they become 'Cousin 1', 'Cousin 2'…" },
            role: { type: "string", enum: ["bride", "mother", "family", "guest"] },
            branch: { type: "string", description: "Family branch who pays, e.g. \"Bride's family\", \"Khala's family\"" },
            count: { type: "integer", description: "Add this many people at once" },
          },
          required: ["action"],
        },
      },
      looks: {
        type: "array",
        description: "Event-day glam per person per event",
        items: { type: "object", properties: { person: sel, event: { type: "string", description: "Event id or name, or 'all events'" }, add: keys(LOOKS), remove: keys(LOOKS), set: keys(LOOKS) }, required: ["person", "event"] },
      },
      prep: {
        type: "array",
        description: "Pre-wedding services per person (scheduled automatically in the ideal window before their first event)",
        items: { type: "object", properties: { person: sel, add: keys(PREP), remove: keys(PREP), set: keys(PREP) }, required: ["person"] },
      },
    },
  },
}
const READ: Anthropic.Tool = { name: "get_schedule", description: "Compute the schedule for the current plan: prep visits, each event's start time and pros needed, costs by branch and warnings.", input_schema: { type: "object", properties: {} } }

function summary(plan: ShaadiPlan, today: string, cat: ShaadiCatalog) {
  const s = computeSchedule(plan, today, cat)
  return {
    events: s.events.map((e) => ({ name: e.name, date: e.date, photos: to12h(e.readyBy), glamPros: e.pros.glam, mehndiPros: e.pros.mehndi, firstStart: to12h(e.start), warning: e.warning })),
    prepVisits: s.prep.map((v) => ({ date: v.date, window: v.window, pros: v.pros, items: v.items.map((i) => `${i.person}: ${i.label}`) })),
    branches: s.branches.map((b) => ({ branch: b.branch, people: b.people, PKR: b.amount })),
    totalPKR: s.total,
    quoted: s.quoted,
    warnings: s.warnings,
  }
}

function system(today: string, cat: ShaadiCatalog) {
  return `You are the Shaadi Orchestrator for Mjazo, an at-home beauty service in Karachi with women-only pros. You help a family plan glam for every wedding event and everyone who needs it. Today is ${today}. You are an AI; a human Mjazo wedding coordinator approves the final plan before anything is booked.

How to work:
- Turn what the family says into plan changes with update_plan (several changes per call), then call get_schedule and explain the result briefly.
- Events: convert dates to YYYY-MM-DD (the next future occurrence if no year) and times to 24-hour ready_by. Karachi wedding events are usually in the evening: "baraat photos at 7:30" means 19:30 unless they say morning. If they give no time, add the event anyway without ready_by (7 pm is assumed) and mention the assumption.
- People: use the names or relations they give. "12 ladies" means add people with count. Ask which family branch pays only if they mention splitting costs.
- Looks per event: ${Object.entries(LOOKS).map(([k, v]) => `${k} (${v.label}, ${svcInfo(v, cat).minutes} min)`).join("; ")}.
- Prep (before the first event): ${Object.entries(PREP).map(([k, v]) => `${k} (${v.label}, ${v.window[0]}-${v.window[1]} days before)`).join("; ")}.
- Roles: ${Object.entries(ROLE_LABEL).map(([k, v]) => `${k} = ${v}`).join(", ")}. The bride finishes last with two pros side by side.
- Sensible defaults when they don't say: bride gets bridal + draping on the main event and mehndi-full at the mehndi; mother gets party-makeup + hair; other family soft-glam + hair. Tell them what you assumed.
- Never state prices or times yourself except as returned by get_schedule. Bridal is quoted by the coordinator.
- Reply in the family's language (English, Urdu or Roman Urdu), warm and short: what you set up, the key times, pros needed and the total, then at most one question.`
}

export async function POST(req: Request) {
  if (!aiEnabled()) return NextResponse.json({ error: "ai_unavailable", whatsapp: await whatsappLink("Hi Mjazo! I'd like help planning glam for our wedding.") }, { status: 503 })
  if (rateLimited(`shaadi:${clientIp(req)}`, 12)) return NextResponse.json({ error: "Too many messages. Please wait a minute." }, { status: 429 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Something in the plan looks off. Please refresh and try again." }, { status: 400 })
  const today = karachiNow().date
  const cat = await getCatalog()
  let plan = parsed.data.plan as ShaadiPlan
  const changes: string[] = []
  const messages: Anthropic.MessageParam[] = [
    ...(parsed.data.history ?? []).map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: `Current plan (JSON):\n${JSON.stringify({ title: plan.title, events: plan.events, people: plan.people.map(({ phone, ...p }) => p) })}\n\nFamily says: ${parsed.data.message}` },
  ]
  while (messages.length && messages[0].role !== "user") messages.shift()

  try {
    for (let step = 0; step < 6; step++) {
      const res = await ai().messages.create({ model: MODELS.planner, max_tokens: 2000, system: system(today, cat), tools: [UPDATE, READ], messages })
      messages.push({ role: "assistant", content: res.content })
      const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      if (res.stop_reason !== "tool_use" || !uses.length) {
        const reply = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim()
        return NextResponse.json({ plan, reply, changes })
      }
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const u of uses) {
        if (u.name === "update_plan") {
          const r = applyPatch(plan, u.input as PlanPatch)
          plan = r.plan
          changes.push(...r.notes)
          results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify({ ok: true, notes: r.notes, events: plan.events, people: plan.people.map((p) => ({ id: p.id, name: p.name, role: p.role, branch: p.branch, looks: p.looks, prep: p.prep })) }) })
        } else results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(summary(plan, today, cat)) })
      }
      messages.push({ role: "user", content: results })
    }
    return NextResponse.json({ plan, reply: "I've updated the plan. Have a look at the schedule and tell me what to change.", changes })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The planner is busy. Try again in a moment." }, { status: 429 })
    console.error("[shaadi/assist] failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    return NextResponse.json({ error: "The planner couldn't finish that. You can keep editing the plan by hand." }, { status: 502 })
  }
}
