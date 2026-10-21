import { z } from "zod"
import { requireCore } from "@/lib/core/db"
import { dropPushToken, savePushToken } from "@/lib/core/automation"
import { readJson } from "@/lib/server/api"
import { asPro } from "@/lib/server/pro-auth"

// The Mjazo Pro app's push token (Expo), so offers reach her phone. DELETE when she signs out.

const body = z.object({ token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Not an Expo push token").max(200), platform: z.enum(["ios", "android", "web"]).optional() })

export const POST = asPro(async (pro, req) => {
  const b = body.parse(await readJson(req))
  await savePushToken(await requireCore(), { token: b.token, ownerType: "pro", ownerId: pro.id, platform: b.platform })
  return { ok: true }
})

export const DELETE = asPro(async (_pro, req) => {
  await dropPushToken(await requireCore(), body.pick({ token: true }).parse(await readJson(req)).token)
  return { ok: true }
})
