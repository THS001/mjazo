import { z } from "zod"
import { readJson } from "@/lib/server/api"
import { proSos } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

// SOS: ops are told at once, with her location. On a visit it goes on the visit's timeline.

const body = z.object({ jobId: z.string().optional(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() })

export const POST = asPro(async (pro, req) => proSos(pro, body.parse(await readJson(req))))
