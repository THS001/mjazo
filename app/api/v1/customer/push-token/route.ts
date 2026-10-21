import { z } from "zod"
import { requireCore } from "@/lib/core/db"
import { dropPushToken, savePushToken } from "@/lib/core/automation"
import { readJson } from "@/lib/server/api"
import { asCustomer } from "@/lib/server/customer-auth"

// The Mjazo app's push token (Expo), for booking updates on the phone. DELETE on sign-out.

const body = z.object({ token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Not an Expo push token").max(200), platform: z.enum(["ios", "android", "web"]).optional() })

export const POST = asCustomer(async ({ customer }, req) => {
  const b = body.parse(await readJson(req))
  await savePushToken(await requireCore(), { token: b.token, ownerType: "customer", ownerId: customer.id, platform: b.platform })
  return { ok: true }
})

export const DELETE = asCustomer(async (_who, req) => {
  await dropPushToken(await requireCore(), body.pick({ token: true }).parse(await readJson(req)).token)
  return { ok: true }
})
