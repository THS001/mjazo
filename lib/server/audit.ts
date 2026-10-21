import "server-only"
import { all, put } from "./docs"
import { newId } from "./store"
import { core } from "@/lib/core/db"
import { listAudit, writeAudit } from "@/lib/core/audit"

// Audit log for staff actions and AI-assisted decisions: the core's audit_log table when the core
// is on, the older document store otherwise. Money actions write theirs inside their own
// transaction (lib/core/money.ts); everything else calls audit() once the action has worked.

/** `actor`: the staff person's email, `pro:<id>`, "customer" or "system". */
export type AuditEntry = { id: string; at: string; actor: string; action: string; target?: string; detail?: string }

export async function audit(actor: string, action: string, target?: string, detail?: string) {
  try {
    const db = await core()
    if (db) return await writeAudit(db, { actor, action, target, detail })
    await put<AuditEntry>("audit", { id: `A-${newId().slice(3)}`, at: new Date().toISOString(), actor, action, target, detail: detail?.slice(0, 300) })
  } catch (e) {
    console.error("[audit] failed", e)
  }
}

export async function recentAudit(n = 80): Promise<AuditEntry[]> {
  const db = await core()
  if (db) return (await listAudit(db, { limit: n })).map((r) => ({ id: String(r.id), at: r.at, actor: r.actor, action: r.action, target: r.target ?? undefined, detail: r.detail ?? undefined }))
  return (await all<AuditEntry>("audit")).sort((a, b) => b.at.localeCompare(a.at)).slice(0, n)
}
