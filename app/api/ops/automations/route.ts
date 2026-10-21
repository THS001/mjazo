import { z } from "zod"
import { getMessages } from "@/lib/cms/read"
import { MESSAGES } from "@/lib/cms/types/messages"
import { requireCore } from "@/lib/core/db"
import { listMessages, pushTokenCount, saveRule } from "@/lib/core/automation"
import { handle, readJson } from "@/lib/server/api"
import { audit } from "@/lib/server/audit"
import { channels, loadRules, previewMessage, RULES, runAutomation, testMode } from "@/lib/server/automation"
import { requireStaff } from "@/lib/server/staff"

// Mission control → Automations: each rule's switch and settings (the auto-assign mode, WhatsApp
// template names), the channels that are set up, the send log, a preview of each message, and
// "Run now". Owners and Admins.

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    key: z.enum(RULES.map((r) => r.key) as [string, ...string[]]),
    enabled: z.boolean(),
    mode: z.enum(["off", "suggest", "auto"]).optional(),
    waTemplates: z.record(z.string(), z.string().trim().max(60).regex(/^[a-z0-9_]*$/, "A WhatsApp template name is lower case letters, digits and _")).optional(),
  }),
  z.object({ action: z.literal("run") }),
])

export async function GET(req: Request) {
  return handle(async () => {
    await requireStaff("ops.automations")
    const db = await requireCore()
    const sp = new URL(req.url).searchParams
    const [rules, log, tokens, en, ur] = await Promise.all([loadRules(db), listMessages(db, { status: sp.get("status") || undefined, rule: sp.get("rule") || undefined, limit: 150 }), pushTokenCount(db), getMessages("en"), getMessages("ur")])
    const previews = Object.fromEntries((Object.keys(MESSAGES) as (keyof typeof MESSAGES)[]).map((k) => [k, { en: previewMessage(en ?? MESSAGES, k), ur: previewMessage(ur ?? MESSAGES, k, "ur") }]))
    return { rules: Object.values(rules), channels: { ...channels(), push: tokens }, testMode: testMode(), log, previews }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireStaff("ops.automations")
    const db = await requireCore()
    const b = body.parse(await readJson(req))
    if (b.action === "run") {
      const r = await runAutomation()
      await audit(me.email, "ran the automation", "automation", JSON.stringify(r))
      return { result: r }
    }
    const config: Record<string, unknown> = {}
    if (b.mode) config.mode = b.mode
    if (b.waTemplates) config.waTemplates = b.waTemplates
    await saveRule(db, b.key, { enabled: b.enabled, config }, me.email)
    await audit(me.email, `${b.enabled ? "switched on" : "switched off"} an automation`, b.key, Object.keys(config).length ? JSON.stringify(config) : undefined)
    return { rules: Object.values(await loadRules(db)) }
  })
}
