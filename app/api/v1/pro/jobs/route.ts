import { proSchedule } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

// Her visits from today, grouped by day (?days=1–14, default 7), with today's safety prompts,
// her earnings this week and how many offers are waiting.

export const GET = asPro(async (pro, req) => proSchedule(pro, Number(new URL(req.url).searchParams.get("days")) || 7))
