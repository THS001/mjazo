import { NextResponse } from "next/server"
import { z } from "zod"
import { readJson } from "@/lib/server/api"
import { proVisitLocation } from "@/lib/server/pro-api"
import { asPro } from "@/lib/server/pro-auth"

// Her phone's location while she's on the way to this visit (Mjazo Pro sends it about once a
// minute while it's open). 409 once the visit has moved on: the app stops sending.

const body = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100_000).optional() })

export const POST = asPro<{ params: Promise<{ id: string }> }>(async (pro, req, { params }) => {
  const tracking = await proVisitLocation(pro, (await params).id, body.parse(await readJson(req)))
  return tracking ? { tracking } : NextResponse.json({ tracking: false, error: "This visit isn't on the way any more." }, { status: 409 })
})
