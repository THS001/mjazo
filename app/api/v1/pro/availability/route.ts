import { z } from "zod"
import { readJson } from "@/lib/server/api"
import { proAvailability, setProAvailability } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

// Her weekly windows and days off. She changes them herself; a day off on a day she already has
// visits is refused (ops move those first).

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const body = z.object({
  availability: z.record(z.string(), z.array(z.string())).nullable().optional(),
  timeOff: z.object({ add: z.array(day).max(60).optional(), remove: z.array(day).max(60).optional() }).optional(),
})

export const GET = asPro(async (pro) => proAvailability(pro))

export const PUT = asPro(async (pro, req) => {
  await setProAvailability(pro, body.parse(await readJson(req)))
  return { ok: true }
})
