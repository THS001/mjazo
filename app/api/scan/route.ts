import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { MODELS, aiEnabled, clientIp, rateLimited } from "@/lib/ai/anthropic"
import { structured } from "@/lib/ai/structured"
import { formatPKR, type Catalog } from "@/lib/catalog"
import { getCatalog, whatsappLink } from "@/lib/cms/read"
import { all } from "@/lib/server/docs"
import type { Job } from "@/lib/ops/types"

// Ghar Scan: photos → likely issue (or look) → catalogue services with price ranges.
// The model must answer through the report_scan tool; every recommendation is re-checked
// against the catalogue and priced from it. Photos are not stored.

export const maxDuration = 60

const WORLDS = {
  home: ["cleaning", "pest-control", "ac-appliances", "repairs-home"],
  beauty: ["beauty-wellness"],
} as const

const body = z.object({
  mode: z.enum(["home", "beauty"]),
  images: z.array(z.string().regex(/^[A-Za-z0-9+/=]+$/).max(2_800_000)).min(1).max(3),
  note: z.string().max(600).optional(),
  // Phase 3: answers to the follow-up questions from the previous round refine the diagnosis.
  answers: z.array(z.object({ q: z.string().max(300), a: z.string().max(300) })).max(4).optional(),
})

const REPORT: Anthropic.Tool = {
  name: "report_scan",
  description: "Report what the photos show and which Mjazo services fit.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One or two plain sentences on what you can see." },
      title: { type: "string", description: "Home: the likely issue, e.g. 'AC indoor unit leaking water'. Beauty: a name for the look, e.g. 'Soft-glam evening look'." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      confidence_score: { type: "integer", description: "0-100: how sure you are of the main diagnosis or look." },
      annotations: {
        type: "array",
        maxItems: 4,
        description: "Home only: point to where the problem is visible. photo = 0-based photo index; x, y = position as a fraction of width/height (0-1).",
        items: { type: "object", properties: { photo: { type: "integer" }, x: { type: "number" }, y: { type: "number" }, label: { type: "string", description: "2-5 words" } }, required: ["photo", "x", "y", "label"] },
      },
      tech_brief: { type: "string", description: "Home only: what the technician should check first and bring, in 1-3 short sentences." },
      check_now: { type: "array", items: { type: "string" }, maxItems: 3, description: "Home only: quick, safe things the customer can check or do before the visit." },
      likely_causes: { type: "array", items: { type: "string" }, maxItems: 3, description: "Home only: likely causes, most likely first." },
      urgent: { type: "boolean", description: "Home only: true if it risks damage or safety and should be seen soon." },
      safety_note: { type: "string", description: "Home only: a short safety instruction if relevant (e.g. switch off the breaker), else empty." },
      parts_may_need: { type: "array", items: { type: "string" }, maxItems: 4, description: "Home only: parts a technician may need (priced separately)." },
      pro_brief: { type: "string", description: "Beauty only: a brief for the pro (products, technique, placement, time needed)." },
      follow_up_questions: { type: "array", items: { type: "string" }, maxItems: 2, description: "Questions whose answers would best tell the likely causes apart (e.g. where exactly the water comes from, brand and model for an error code). Empty if you are already sure." },
      recommendations: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            service: { type: "string" },
            options: { type: "array", items: { type: "string" }, description: "Variant option labels if you can tell (e.g. 'Split', 'Long')." },
            why: { type: "string", description: "One short reason tied to the photo." },
          },
          required: ["category", "service", "why"],
        },
      },
    },
    required: ["summary", "title", "confidence", "follow_up_questions", "recommendations"],
  },
}

function menu({ visibleCategories }: Catalog, mode: "home" | "beauty") {
  return visibleCategories
    .filter((c) => (WORLDS[mode] as readonly string[]).includes(c.world))
    .map((c) => `${c.name} [${c.slug}]: ${c.services.map((s) => `${s.slug} (${s.name}${s.variants?.length ? `; ${s.variants.map((v) => `${v.label}: ${v.options.map((o) => o.label).join("/")}`).join("; ")}` : ""})`).join(", ")}`)
    .join("\n")
}

const PROMPT = {
  home: `You are Ghar Scan for Mjazo, a Karachi home-services company. Look at the customer's photos of a problem at home and work out the most likely issue and which Mjazo services fix it.
- Be concrete and honest about uncertainty; set confidence low if the photo is unclear or the cause can't be seen.
- Recommend only services from this menu (use the exact slugs). Pick at most 3, best first.
- Parts are never included in prices; list ones that may be needed.
- If there is a hazard (water near electrics, gas smell, sparking, structural cracks), say what to do now in safety_note and mark urgent.
- Diagnose like a senior technician: list causes most likely first, and ask the follow-up questions that would separate them. For error codes, ask for the brand and model if you can't read them. Point to the problem on the photos with annotations.
- If the customer answered earlier questions, use the answers and only ask something new if it still matters.
- Not a medical tool: ignore people and never comment on health.`,
  beauty: `You are Ghar Scan (Look mode) for Mjazo, a Karachi at-home beauty service with women-only pros. The customer shows an inspiration photo of a look (makeup, hair, mehndi, nails, brows). Name the look, describe it, write a short brief for the pro, and map it to Mjazo services.
- Describe the look itself, not the person's body or skin colour. Never suggest skin lightening or "fairness".
- Recommend only services from this menu (use the exact slugs). Pick at most 3, best first.
- Not a medical tool: no skin diagnosis.`,
}

function priceRange({ getService }: Catalog, category: string, service: string) {
  const f = getService(category, service)
  if (!f || f.service.price <= 0) return null
  const v = f.service.variants ?? []
  const min = f.service.price + v.reduce((s, x) => s + Math.min(...x.options.map((o) => o.delta)), 0)
  const max = f.service.price + v.reduce((s, x) => s + Math.max(...x.options.map((o) => o.delta)), 0)
  return { min, max, label: min === max ? formatPKR(min) : `${formatPKR(min)} – ${formatPKR(max)}` }
}

const VIDEO_CHECK_BELOW = 55

/** What customers actually paid on completed Mjazo jobs per service (shown once there are 3+ jobs). */
async function jobHistory() {
  const paid = new Map<string, number[]>()
  for (const j of await all<Job>("jobs")) {
    if (j.status !== "completed" || !j.paymentRecord || j.items.length !== 1) continue
    const k = `${j.items[0].category}/${j.items[0].service}`
    paid.set(k, [...(paid.get(k) ?? []), j.paymentRecord.amount])
  }
  const out = new Map<string, { jobs: number; low: number; high: number }>()
  for (const [k, v] of paid) {
    if (v.length < 3) continue
    const s = [...v].sort((a, b) => a - b)
    const q = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]
    out.set(k, { jobs: s.length, low: q(0.25), high: q(0.75) })
  }
  return out
}

export async function POST(req: Request) {
  const cat = await getCatalog()
  const { getService, visibleCategories } = cat
  if (!aiEnabled()) return NextResponse.json({ error: "ai_unavailable", whatsapp: await whatsappLink("Hi Mjazo! I'd like to send you photos of a problem for a quote.") }, { status: 503 })
  if (rateLimited(`scan:${clientIp(req)}`, 8)) return NextResponse.json({ error: "Too many scans. Please wait a minute." }, { status: 429 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Please add one to three photos." }, { status: 400 })
  const { mode, images, note, answers } = parsed.data
  const answered = (answers ?? []).filter((x) => x.a.trim())

  try {
    const r = await structured<{
      summary: string; title: string; confidence: "high" | "medium" | "low"; likely_causes?: string[]; urgent?: boolean; safety_note?: string
      parts_may_need?: string[]; pro_brief?: string; follow_up_questions: string[]; confidence_score?: number; tech_brief?: string; check_now?: string[]
      annotations?: { photo: number; x: number; y: number; label: string }[]; recommendations: { category: string; service: string; options?: string[]; why: string }[]
    }>({
      model: MODELS.vision,
      maxTokens: 1600,
      system: `${PROMPT[mode]}\n\nMenu (category [slug]: service slugs)\n${menu(cat, mode)}\n\nWrite summary, title, causes, brief and questions in the language of the customer's note (English, Urdu script or Roman Urdu); default to English.`,
      tool: REPORT,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
            { type: "text", text: [note?.trim() ? `Customer's note: ${note.trim()}` : "No note from the customer.", answered.length ? `Customer's answers to your earlier questions:\n${answered.map((x) => `- ${x.q} → ${x.a}`).join("\n")}` : ""].filter(Boolean).join("\n\n") },
          ],
        },
      ],
    })
    if (!r) throw new Error("No report")
    const history = await jobHistory().catch(() => new Map<string, { jobs: number; low: number; high: number }>())
    const allowed = new Set(visibleCategories.filter((c) => (WORLDS[mode] as readonly string[]).includes(c.world)).map((c) => c.slug))
    const recommendations = (r.recommendations ?? [])
      .filter((x) => allowed.has(x.category) && getService(x.category, x.service))
      .map((x) => {
        const f = getService(x.category, x.service)!
        return {
          category: f.category.slug,
          categoryName: f.category.name,
          service: f.service.slug,
          name: f.service.name,
          why: x.why,
          options: x.options ?? [],
          price: f.service.price,
          range: priceRange(cat, f.category.slug, f.service.slug),
          duration: f.service.duration,
          hasOptions: Boolean(f.service.variants?.length || f.service.addOns?.length),
          url: `/services/${f.category.slug}/${f.service.slug}`,
          history: history.get(`${f.category.slug}/${f.service.slug}`) ?? null,
        }
      })
    const score = Math.max(0, Math.min(100, Math.round(Number(r.confidence_score ?? (r.confidence === "high" ? 80 : r.confidence === "medium" ? 60 : 35)))))
    const pins = (r.annotations ?? [])
      .filter((p) => Number.isInteger(p.photo) && p.photo >= 0 && p.photo < images.length && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
      .slice(0, 4)
      .map((p) => ({ photo: p.photo, x: +p.x.toFixed(3), y: +p.y.toFixed(3), label: String(p.label).slice(0, 60) }))
    return NextResponse.json({
      mode,
      summary: r.summary,
      title: r.title,
      confidence: recommendations.length ? r.confidence : "low",
      score: recommendations.length ? score : Math.min(score, 40),
      // Below this, a free 2-minute video call with a technician beats guessing.
      videoCheck: mode === "home" && (!recommendations.length || score < VIDEO_CHECK_BELOW),
      pins: mode === "home" ? pins : [],
      techBrief: mode === "home" ? r.tech_brief?.trim() ?? "" : "",
      checkNow: mode === "home" ? r.check_now ?? [] : [],
      causes: r.likely_causes ?? [],
      urgent: Boolean(r.urgent),
      safety: r.safety_note?.trim() || "",
      parts: r.parts_may_need ?? [],
      brief: r.pro_brief ?? "",
      questions: r.follow_up_questions ?? [],
      recommendations,
      whatsapp: await whatsappLink(`Hi Mjazo! Ghar Scan says: ${r.title}. Can a technician do a free 2-minute video check?`),
    })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Scanning is busy. Try again in a moment." }, { status: 429 })
    console.error("[scan] failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    return NextResponse.json({ error: "We couldn't read those photos. Try again, or send them on WhatsApp.", whatsapp: await whatsappLink("Hi Mjazo! I'd like to send you photos for a quote.") }, { status: 502 })
  }
}
