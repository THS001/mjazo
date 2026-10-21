import { handle } from "@/lib/server/api"
import { requireStaff } from "@/lib/server/staff"
import { auditLog } from "@/lib/server/ops"

// The audit log: who did what in mission control, newest first. ?actor= one person, ?q= search,
// ?before= the id to page back from.

export async function GET(req: Request) {
  return handle(async () => {
    await requireStaff("ops.audit")
    const sp = new URL(req.url).searchParams
    const before = Number(sp.get("before")) || undefined
    const rows = await auditLog({ actor: sp.get("actor")?.slice(0, 200) || undefined, q: sp.get("q")?.slice(0, 100) || undefined, before, limit: 100 })
    return { rows }
  })
}
