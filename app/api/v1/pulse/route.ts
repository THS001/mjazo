import { NextResponse } from "next/server"
import { z } from "zod"
import { clientIp, rateLimited } from "@/lib/ai/anthropic"
import { getCatalog, getPage } from "@/lib/cms/read"
import type { HomePulseContent } from "@/lib/cms/types/pages/tools"
import { core } from "@/lib/core/db"
import { listCustomerJobs } from "@/lib/core/jobs"
import { buildPlan, type PastBooking, type WeatherDay } from "@/lib/pulse"
import { handle } from "@/lib/server/api"
import { customerOf } from "@/lib/server/customer-auth"
import { karachiNow } from "@/lib/time"

// Home Pulse for the phone app: the same 90-day plan as /home-pulse (lib/pulse.ts, with the CMS's
// wording in the app's language), worked out here so the engine lives in one place. It uses the
// bookings made on the phone, and a signed-in customer's finished visits. The answer also carries
// the tool's interface text (Pages → Home Pulse → Tool text) and each item's price.

const weeks = z.number().int().min(0).max(26)
const body = z.object({
  lang: z.enum(["en", "ur"]).default("en"),
  profile: z.object({
    acs: z.number().int().min(0).max(12),
    tankUnderground: z.boolean(),
    tankOverhead: z.boolean(),
    solar: z.boolean(),
    geyser: z.enum(["gas", "electric", "none"]),
    pets: z.boolean(),
    waxWeeks: weeks,
    threadWeeks: weeks,
    facialWeeks: weeks,
    maniWeeks: weeks,
    events: z.array(z.object({ name: z.string().trim().min(1).max(60), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).max(10),
  }),
  bookings: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), items: z.array(z.object({ category: z.string().max(80), service: z.string().max(120) })).max(20) })).max(60).optional(),
  done: z.array(z.string().max(160)).max(200).optional(),
})

let forecast: { at: number; days: WeatherDay[] } | null = null
/** Karachi's 7-day forecast (Open-Meteo, as /api/pulse/weather), kept for an hour. */
async function weather(): Promise<WeatherDay[]> {
  if (forecast && Date.now() - forecast.at < 3600_000) return forecast.days
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=24.86&longitude=67.01&daily=temperature_2m_max,precipitation_sum&timezone=Asia%2FKarachi&forecast_days=7", { signal: AbortSignal.timeout(4000) })
    if (!res.ok) throw new Error(String(res.status))
    const j = (await res.json()) as { daily: { time: string[]; temperature_2m_max: number[]; precipitation_sum: number[] } }
    forecast = { at: Date.now(), days: j.daily.time.map((date, i) => ({ date, max: j.daily.temperature_2m_max[i], rain: j.daily.precipitation_sum[i] })) }
    return forecast.days
  } catch {
    return forecast?.days ?? []
  }
}

export async function POST(req: Request) {
  if (rateLimited(`pulse:${clientIp(req)}`, 60)) return NextResponse.json({ error: "Too many requests. Wait a minute." }, { status: 429 })
  return handle(async () => {
    const b = body.parse(await req.json().catch(() => ({})))
    const [page, cat, days, customer] = await Promise.all([getPage<HomePulseContent>("home-pulse", b.lang), getCatalog(b.lang), weather(), customerOf(req)])
    const past: PastBooking[] = [...(b.bookings ?? [])]
    const db = customer ? await core() : null
    if (db && customer) for (const j of await listCustomerJobs(db, customer.id)) if (j.status === "completed") past.push({ date: j.date, items: j.items.map((i) => ({ category: i.category, service: i.service })) })
    const today = karachiNow().date
    const done = new Set(b.done ?? [])
    const items = buildPlan({ profile: b.profile, bookings: past, today, weather: days, text: page.tool.rules })
      .filter((i) => !done.has(i.id))
      .map((i) => {
        const f = cat.getService(i.category, i.service)
        return { ...i, name: f?.service.name ?? i.title, price: f?.service.price ?? 0, hasOptions: Boolean(f?.service.variants?.length || f?.service.addOns?.length) }
      })
    const { profile, plan, kinds, item, remind } = page.tool
    return { today, items, heat: days.length ? Math.round(Math.max(...days.map((d) => d.max))) : null, text: { profile, plan, kinds, item, remind, groups: page.tool.rules.groups } }
  })
}
