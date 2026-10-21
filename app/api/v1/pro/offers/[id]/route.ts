import { z } from "zod"
import { readJson } from "@/lib/server/api"
import { proAnswerOffer } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

// She accepts an offer (the visit becomes hers) or declines it (with a reason, optional).

const body = z.object({ accept: z.boolean(), reason: z.string().trim().max(300).optional() })

export const POST = asPro<{ params: Promise<{ id: string }> }>(async (pro, req, { params }) => {
  const b = body.parse(await readJson(req))
  return proAnswerOffer(pro, (await params).id, b.accept, b.reason)
})
