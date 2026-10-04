import "server-only"
import { all, put } from "./docs"
import { newId } from "./store"

// Audit log for staff actions and AI-assisted decisions (Trust Desk shows the latest entries).

export type AuditEntry = { id: string; at: string; actor: "ops" | "pro" | "system" | "customer"; action: string; target?: string; detail?: string }

export async function audit(actor: AuditEntry["actor"], action: string, target?: string, detail?: string) {
  try {
    await put<AuditEntry>("audit", { id: `A-${newId().slice(3)}`, at: new Date().toISOString(), actor, action, target, detail: detail?.slice(0, 300) })
  } catch (e) {
    console.error("[audit] failed", e)
  }
}

export async function recentAudit(n = 80) {
  return (await all<AuditEntry>("audit")).sort((a, b) => b.at.localeCompare(a.at)).slice(0, n)
}
