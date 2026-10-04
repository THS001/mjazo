import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { formatPKR, type Catalog } from "@/lib/catalog"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { karachiNow } from "@/lib/time"
import { searchProtocols } from "@/lib/ops/protocols"
import { OPS, jobMinutes, planRoutes } from "@/lib/ops/logic"
import { leakageWatch, qualityReport } from "@/lib/ops/trust"
import type { Application, Complaint, InterviewTurn, Job, Pro, Scores } from "@/lib/ops/types"
import { notifyOps } from "@/lib/server/store"
import { MODELS, ai } from "./anthropic"
import { structured } from "./structured"

// Phase 2 agents: Pro Copilot, Recruiter interview, Trust Desk (receipts, complaints, ops Q&A).

const OPS_MODEL = process.env.AI_MODEL_OPS ?? "claude-opus-5-5"

type ToolRun = (name: string, input: Record<string, unknown>) => Promise<unknown>

async function loop(opts: { model: string; system: string; tools: Anthropic.Tool[]; messages: Anthropic.MessageParam[]; run: ToolRun; maxSteps?: number; maxTokens?: number }) {
  const messages = [...opts.messages]
  for (let i = 0; i < (opts.maxSteps ?? 6); i++) {
    const res = await ai().messages.create({ model: opts.model, max_tokens: opts.maxTokens ?? 900, system: opts.system, tools: opts.tools, messages })
    messages.push({ role: "assistant", content: res.content })
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    if (res.stop_reason !== "tool_use" || !uses.length)
      return { text: res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim(), messages }
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const u of uses) results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(await opts.run(u.name, (u.input ?? {}) as Record<string, unknown>)) })
    messages.push({ role: "user", content: results })
  }
  return { text: "Sorry, I couldn't finish that. Please ask again more simply.", messages }
}

// ---------------------------------------------------------------------------------------------
// Pro Copilot
// ---------------------------------------------------------------------------------------------

const describeJob = (cat: Catalog) => (j: Job) => ({
  id: j.id,
  window: j.window,
  eta: j.eta,
  status: j.status,
  area: `${j.subArea ? `${j.subArea}, ` : ""}${cat.getArea(j.area)?.name ?? j.area}`,
  address: `${j.address}${j.landmark ? ` (near ${j.landmark})` : ""}`,
  customer: j.customer.name.split(" ")[0],
  services: j.items.map((i) => `${i.name}${i.options.length ? ` (${i.options.join(", ")})` : ""}${i.addOns.length ? ` + ${i.addOns.join(", ")}` : ""}${i.qty > 1 ? ` x${i.qty}` : ""}`),
  minutes: jobMinutes(j, cat),
  total: formatPKR(j.total),
  payment: `${j.payment}, after the service`,
  customerNotes: j.notes ?? "",
  customerBrief: j.brief ? `${j.brief.kind === "scan" ? "Ghar Scan" : "Look Card"}: ${j.brief.title}. ${j.brief.text}${j.brief.causes?.length ? ` Likely causes: ${j.brief.causes.join("; ")}.` : ""}${j.brief.parts?.length ? ` Parts: ${j.brief.parts.join(", ")}.` : ""}` : "",
  event: j.event ? `${j.event.name}, ready by ${j.event.readyBy}: ${j.event.people.map((p) => `${p.name} ${p.start}-${p.end} (${p.services.join(", ")})`).join("; ")}` : "",
})

export async function runProCopilot(pro: Pro, jobsToday: Job[], allJobs: Job[], history: Anthropic.MessageParam[], saveNote: (jobId: string, note: string) => Promise<void>) {
  const describe = describeJob(await getCatalog())
  const tools: Anthropic.Tool[] = [
    { name: "get_today_jobs", description: "The pro's jobs today in route order, with customer notes.", input_schema: { type: "object", properties: {} } },
    { name: "get_customer_history", description: "Past Mjazo visits for the customer of one of today's jobs: dates, services and earlier visit notes.", input_schema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] } },
    { name: "lookup_protocol", description: "Search the Mjazo protocol manual (hygiene, waxing, facials, massage, mehndi, safety, AC, fridge, geyser, electrical, plumbing).", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "save_visit_note", description: "Save a note about today's visit to the customer's profile (preferences, allergies, products used, follow-ups).", input_schema: { type: "object", properties: { job_id: { type: "string" }, note: { type: "string" } }, required: ["job_id", "note"] } },
    { name: "escalate_to_supervisor", description: "Alert a Mjazo supervisor: safety worries, medical questions, angry customers, disputes, or anything not in the manual.", input_schema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } },
  ]
  const mine = (id: string) => jobsToday.find((j) => j.id === id)
  const run: ToolRun = async (name, input) => {
    if (name === "get_today_jobs") return { jobs: jobsToday.map(describe) }
    if (name === "get_customer_history") {
      const j = mine(String(input.job_id))
      if (!j) return { error: "Not one of your jobs today." }
      const past = allJobs.filter((x) => x.customer.phone === j.customer.phone && x.id !== j.id && x.status === "completed").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
      return { visits: past.map((x) => ({ date: x.date, services: x.items.map((i) => i.name), notes: x.visitNotes ?? [] })) }
    }
    if (name === "lookup_protocol") return { results: searchProtocols(String(input.query)).map((p) => ({ title: p.title, text: p.text })) }
    if (name === "save_visit_note") {
      const j = mine(String(input.job_id))
      if (!j) return { error: "Not one of your jobs today." }
      await saveNote(j.id, String(input.note).slice(0, 500))
      return { saved: true }
    }
    if (name === "escalate_to_supervisor") {
      await notifyOps(`[Mjazo] Pro escalation: ${pro.name}`, `${pro.name} (${pro.phone}) asked for a supervisor: ${String(input.reason)}`)
      return { escalated: true, say: "Tell her a supervisor has been alerted and will call her shortly." }
    }
    return { error: "Unknown tool" }
  }
  const system = `You are Pro Copilot, the assistant for ${pro.name.split(" ")[0]}, a Mjazo pro in Karachi (skills: ${pro.skills.join(", ")}). Today is ${karachiNow().date}.
Reply in her language and script (Urdu, Roman Urdu or English), short and spoken-style: she may be listening on a phone while working. One to four short sentences.
- Service and safety answers come ONLY from lookup_protocol. If the manual doesn't cover it, or it's medical, risky or a dispute, say so and use escalate_to_supervisor.
- Use get_today_jobs for her day and get_customer_history before a visit. Share only what she needs for the job.
- When she describes the visit afterwards, save it with save_visit_note (preferences, allergies, products used).
- For photos (error codes, labels, a skin reaction), describe what you see and check the manual; never diagnose skin or health.
- Her safety comes first: if she feels unsafe, tell her to leave and press SOS.`
  return loop({ model: MODELS.concierge, system, tools, messages: history, run })
}

export async function morningBrief(pro: Pro, jobsToday: Job[], lang: "en" | "ur" | "ro") {
  const describe = describeJob(await getCatalog())
  const LANG = { en: "English", ur: "Urdu script", ro: "Roman Urdu" }
  const res = await ai().messages.create({
    model: MODELS.fast,
    max_tokens: 500,
    system: `Write a spoken morning briefing in ${LANG[lang]} for a Mjazo pro: greeting, number of visits, the route in order with times and areas, key customer notes, kit reminders. Under 120 words, warm and clear. No markdown.`,
    messages: [{ role: "user", content: JSON.stringify({ pro: pro.name.split(" ")[0], jobs: jobsToday.map(describe) }) }],
  })
  return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(" ").trim()
}

// ---------------------------------------------------------------------------------------------
// Recruiter interview
// ---------------------------------------------------------------------------------------------

const FINISH: Anthropic.Tool = {
  name: "finish_interview",
  description: "Call once you have enough answers (usually after 6–8 questions). Scores are 1 (weak) to 5 (excellent).",
  input_schema: {
    type: "object",
    properties: {
      scores: {
        type: "object",
        properties: { experience: { type: "integer" }, skills: { type: "integer" }, hygiene: { type: "integer" }, availability: { type: "integer" }, transport: { type: "integer" }, communication: { type: "integer" } },
        required: ["experience", "skills", "hygiene", "availability", "transport", "communication"],
      },
      summary: { type: "string", description: "Three sentences for the recruiter, in English." },
      strengths: { type: "array", items: { type: "string" }, maxItems: 4 },
      concerns: { type: "array", items: { type: "string" }, maxItems: 4 },
      closing_message: { type: "string", description: "A warm closing for the applicant in her language: thank her, say a person will review and she can now pick a practical test time." },
    },
    required: ["scores", "summary", "strengths", "concerns", "closing_message"],
  },
}

export async function runInterview(app: Application, turns: InterviewTurn[], force = false) {
  const LANG: Record<string, string> = { en: "English", ur: "Urdu script", ro: "Roman Urdu" }
  const system = `You are Mjazo's recruiting assistant, interviewing ${app.name.split(" ")[0]} who applied to be a Mjazo beauty pro in Karachi (skills: ${app.skills.join(", ")}; experience: ${app.experience}; area: ${app.area}). Speak ${LANG[app.lang] ?? "English"}, warmly and simply, ONE question at a time, like a friendly WhatsApp chat.
Cover, in about 6–8 short questions: her hands-on experience with each skill; how she keeps tools and the client clean; what she does if a client has sensitive skin or a reaction; which days and times she can work; how she would travel; comfort with home visits for women customers; and a simple customer scenario (e.g. a client asks for an extra service).
Never ask about CNIC, religion, marital status, family, age, health or anything personal beyond the work. Don't promise a job or pay; earnings are explained at the practical test.
Start by saying you're Mjazo's AI assistant and the interview takes about 10 minutes. When you have enough, call finish_interview.`
  const messages: Anthropic.MessageParam[] = turns.length ? turns.map((t) => ({ role: t.role, content: t.text })) : [{ role: "user", content: "(applicant opened the interview)" }]
  if (messages[0].role !== "user") messages.unshift({ role: "user", content: "(applicant opened the interview)" })
  type Finish = { scores: Scores; summary: string; strengths: string[]; concerns: string[]; closing_message: string }
  let finished: Finish | null = null
  let text = ""
  if (force) {
    // Enough answers: ask for the scores directly (some models don't allow forcing a tool call).
    finished = await structured<Finish>({ model: MODELS.concierge, system: `${system}\n\nThe interview is over: score it now.`, tool: FINISH, messages, maxTokens: 900 })
  } else {
    const res = await ai().messages.create({ model: MODELS.concierge, max_tokens: 900, system, tools: [FINISH], messages })
    const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "finish_interview")
    finished = (use?.input as Finish | undefined) ?? null
    text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim()
  }
  if (finished) {
    const f = finished
    const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(Number(n) || 1)))
    const scores = Object.fromEntries(Object.entries(f.scores).map(([k, v]) => [k, clamp(v)])) as Scores
    return { done: true as const, reply: f.closing_message || text, scores, summary: f.summary, strengths: f.strengths ?? [], concerns: f.concerns ?? [] }
  }
  return { done: false as const, reply: text }
}

// ---------------------------------------------------------------------------------------------
// Trust Desk
// ---------------------------------------------------------------------------------------------

const RECEIPT: Anthropic.Tool = {
  name: "read_receipt",
  description: "Report what the payment screenshot shows.",
  input_schema: {
    type: "object",
    properties: {
      is_payment_receipt: { type: "boolean" },
      amount: { type: "number", description: "Amount in PKR, digits only" },
      reference: { type: "string", description: "Transaction / TID / reference number" },
      date: { type: "string" },
      payer: { type: "string" },
      app: { type: "string", description: "JazzCash, Easypaisa, bank app, etc." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: ["is_payment_receipt", "confidence"],
  },
}

export async function readReceipt(base64Jpeg: string, expected: number) {
  const r =
    (await structured<{ is_payment_receipt?: boolean; amount?: number; reference?: string; date?: string; payer?: string; confidence?: string }>({
      model: MODELS.vision,
      maxTokens: 400,
      system: "You read Pakistani payment app screenshots (JazzCash, Easypaisa, Raast/bank apps). Report only what is visible. If it is not a payment confirmation, say so.",
      tool: RECEIPT,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } }, { type: "text", text: `Expected amount: PKR ${expected}` }] }],
    })) ?? {}
  const status: "matched" | "mismatch" | "unreadable" = !r.is_payment_receipt || r.amount == null ? "unreadable" : Math.abs(Number(r.amount) - expected) <= 1 ? "matched" : "mismatch"
  return { status, ocr: { amount: r.amount, reference: r.reference, date: r.date, payer: r.payer, confidence: r.confidence } }
}

const DRAFT: Anthropic.Tool = {
  name: "draft_resolution",
  description: "Propose a fair resolution under Mjazo policy, for a human to approve.",
  input_schema: {
    type: "object",
    properties: {
      resolution: { type: "string", enum: ["redo", "partial_refund", "full_refund", "apology", "investigate"] },
      refund_pkr: { type: "number" },
      reasoning: { type: "string", description: "For the ops team: which policy applies and why. English." },
      message: { type: "string", description: "The reply to send the customer, in the language they wrote in. Warm, specific, no blame." },
    },
    required: ["resolution", "reasoning", "message"],
  },
}

export async function draftComplaint(c: Complaint, job: Job | null) {
  const { policy } = await getSettings()
  const hoursSince = job ? Math.round((Date.now() - new Date(`${job.date}T12:00:00+05:00`).getTime()) / 3600000) : null
  type Draft = { resolution?: NonNullable<Complaint["draft"]>["resolution"]; refund_pkr?: number; reasoning?: string; message?: string }
  const r = ((await structured<Draft>({
    model: MODELS.vision,
    maxTokens: 700,
    system: `You draft complaint resolutions for Mjazo ops to approve. Policy: issues reported within ${policy.redoHours} hours of the visit get a free redo; when a redo isn't suitable (e.g. no-show, damage, safety), a refund up to the amount paid; late changes may carry ${policy.lateFee}; pros more than 30 minutes late: free reschedule or cancel. Safety or harassment reports: resolution "investigate" and say a manager will call today. Never admit legal liability; never invent facts. Refunds never exceed the booking total.`,
    tool: DRAFT,
    messages: [
      {
        role: "user",
        content: [
          ...(c.photo ? [{ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: c.photo.split(",")[1] ?? c.photo } }] : []),
          { type: "text", text: JSON.stringify({ complaint: c.text, booking: job ? { id: job.id, date: job.date, window: job.window, services: job.items.map((i) => i.name), total: job.total, status: job.status, events: job.events.map((e) => `${e.type} ${e.at}`) } : "not found", hoursSinceVisit: hoursSince }) },
        ],
      },
    ],
  })) ?? {}) as Draft
  const cap = job?.total ?? 0
  return { resolution: r.resolution ?? "investigate", refundPKR: r.refund_pkr ? Math.min(Math.round(r.refund_pkr), cap) : undefined, reasoning: r.reasoning ?? "", message: r.message ?? "" }
}

export async function opsAsk(question: string, data: { jobs: Job[]; pros: Pro[]; complaints: Complaint[] }) {
  const cat = await getCatalog()
  const inRange = (j: Job, from?: unknown, to?: unknown) => (!from || j.date >= String(from)) && (!to || j.date <= String(to))
  const tools: Anthropic.Tool[] = [
    { name: "query_jobs", description: "Jobs (bookings) filtered by date range (YYYY-MM-DD), area slug, status or pro id. Returns up to 200 rows.", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, area: { type: "string" }, status: { type: "string" }, pro_id: { type: "string" } } } },
    { name: "pro_stats", description: "Per-pro visits, working days, visits per working day, cancellations and unpaid amounts in a date range.", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } } },
    { name: "cash_summary", description: "Collected vs expected payments and reconciliation status in a date range.", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } } },
    { name: "complaints_summary", description: "Complaints with status and proposed/approved resolution.", input_schema: { type: "object", properties: {} } },
    { name: "route_plan", description: "Route Brain plan for a date: assignments per pro and anything that can't be assigned.", input_schema: { type: "object", properties: { date: { type: "string" } }, required: ["date"] } },
    { name: "quality_report", description: "Per-pro quality drift: last 14 days vs the 6 weeks before (ratings, complaints, late check-ins, rushed visits, price-at-door reports) with flags and coaching suggestions.", input_schema: { type: "object", properties: {} } },
    { name: "leakage_report", description: "Regular customer-pro pairs that went quiet while the pro stayed busy (possible off-platform bookings). Treat as a reason for a friendly check-in, never as proof.", input_schema: { type: "object", properties: {} } },
    { name: "ratings", description: "Customer ratings (stars, tags, comments) for completed visits in a date range.", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } } },
  ]
  const proName = (id?: string) => data.pros.find((p) => p.id === id)?.name ?? "unassigned"
  const run: ToolRun = async (name, input) => {
    if (name === "query_jobs") {
      const rows = data.jobs.filter((j) => inRange(j, input.from, input.to) && (!input.area || j.area === input.area) && (!input.status || j.status === input.status) && (!input.pro_id || j.proId === input.pro_id))
      return { count: rows.length, rows: rows.slice(0, 200).map((j) => ({ id: j.id, date: j.date, window: j.window, area: j.area, status: j.status, pro: proName(j.proId), total: j.total, services: j.items.map((i) => i.name).join(", "), paid: j.paymentRecord?.status ?? "not recorded" })) }
    }
    if (name === "pro_stats") {
      return {
        pros: data.pros.map((p) => {
          const js = data.jobs.filter((j) => j.proId === p.id && inRange(j, input.from, input.to))
          const done = js.filter((j) => j.status === "completed")
          const days = new Set(done.map((j) => j.date)).size
          return { id: p.id, name: p.name, area: p.area, status: p.status, visits: done.length, workingDays: days, visitsPerDay: days ? +(done.length / days).toFixed(2) : 0, cancelled: js.filter((j) => j.status === "cancelled").length, unpaid: done.filter((j) => !j.paymentRecord).reduce((s, j) => s + j.total, 0) }
        }),
      }
    }
    if (name === "cash_summary") {
      const done = data.jobs.filter((j) => j.status === "completed" && inRange(j, input.from, input.to))
      const by = (s: string) => done.filter((j) => (j.paymentRecord?.status ?? "missing") === s)
      return { expected: done.reduce((s, j) => s + j.total, 0), collected: done.reduce((s, j) => s + (j.paymentRecord?.amount ?? 0), 0), cash: by("cash").length, matched: by("matched").length, mismatch: by("mismatch").map((j) => j.id), unreadable: by("unreadable").map((j) => j.id), missing: by("missing").map((j) => j.id) }
    }
    if (name === "complaints_summary") return { complaints: data.complaints.map((c) => ({ id: c.id, booking: c.bookingId, status: c.status, text: c.text.slice(0, 160), draft: c.draft?.resolution, resolution: c.resolution })) }
    if (name === "quality_report") return { pros: qualityReport(data.jobs, data.pros, data.complaints, karachiNow().date, cat).map((q) => ({ name: q.name, area: q.area, level: q.level, visits14d: q.recent.visits, rating14d: q.recent.avg, ratingBefore: q.baseline.avg, signals: q.signals.map((s) => `${s.label}: ${s.detail}`), coaching: q.coaching })) }
    if (name === "leakage_report") return { flags: leakageWatch(data.jobs, data.pros, karachiNow().date, [], cat).map((f) => ({ customer: f.customer.split(" ")[0], pro: f.proName, area: f.area, signals: f.signals })) }
    if (name === "ratings") return { ratings: data.jobs.filter((j) => j.rating && inRange(j, input.from, input.to)).map((j) => ({ id: j.id, date: j.date, pro: proName(j.proId), stars: j.rating!.stars, tags: j.rating!.tags, comment: j.rating!.comment })) }
    if (name === "route_plan") {
      const plan = planRoutes(data.jobs.filter((j) => j.date === String(input.date)), data.pros, data.jobs, cat)
      return { ...plan, byPro: Object.fromEntries(Object.entries(plan.byPro).map(([id, s]) => [proName(id), s])) }
    }
    return { error: "Unknown tool" }
  }
  const system = `You are Trust Desk, the ops analyst for Mjazo (Karachi home services). Today is ${karachiNow().date}. Answer the ops team's question using the read-only tools, then reply concisely in plain text (no markdown, no tables; short lines starting with "• " are fine): the answer first, then the key numbers, then one suggested action if useful. Use PKR. Say clearly if data is missing. Targets: ≥ 2 visits per pro per working day, unreconciled cash 0. Pro share is ${Math.round(OPS.proShare * 100)}% (placeholder).`
  return loop({ model: OPS_MODEL, system, tools, messages: [{ role: "user", content: question }], run, maxSteps: 8, maxTokens: 1200 })
}
