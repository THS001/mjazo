import type { Role } from "@/lib/cms/roles"

// Mission control permissions by role. Checked on the server for every /api/ops action
// (lib/server/staff.ts) and used by the console to hide what a person can't use. Pure, so the
// matrix is easy to test (lib/ops/access.test.ts).

export const OPS_PERMS = [
  "ops.view", // open mission control: the board, booking pages, pros (read)
  "ops.dispatch", // assign and reassign, status changes, Route Brain, wedding approvals, SOS
  "ops.bookings", // booking notes, reschedule, cancel
  "ops.requests", // the requests inbox, complaints, leakage follow-ups
  "ops.money.request", // ask for a refund or a credit (a person with ops.money approves it)
  "ops.money", // cash held, reconciliation, cash handed in, approving refunds and credits, payout runs
  "ops.pros", // add and edit pros, PINs, zones, schedules and capacity
  "ops.verify", // the pro verification checklist (CNIC checked in person, references, test)
  "ops.recruit", // the recruiting pipeline and hiring
  "ops.promos", // promo codes
  "ops.kpi", // the KPI dashboard
  "ops.audit", // the audit log
  "ops.ai", // Ask AI
  "ops.automations", // automations: switch rules on and off, auto-assign mode, WhatsApp templates, the send log
] as const
export type OpsPerm = (typeof OPS_PERMS)[number]

const ALL = [...OPS_PERMS]

export const OPS_ROLE_PERMS: Record<Role, OpsPerm[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== "ops.money"),
  dispatcher: ["ops.view", "ops.dispatch", "ops.bookings", "ops.pros", "ops.kpi", "ops.ai"],
  support: ["ops.view", "ops.bookings", "ops.requests", "ops.money.request", "ops.ai"],
  finance: ["ops.view", "ops.money", "ops.money.request", "ops.promos", "ops.kpi", "ops.audit"],
  recruiter: ["ops.view", "ops.pros", "ops.verify", "ops.recruit"],
  editor: [],
  author: [],
  seo: [],
  viewer: [],
}

export const canOps = (role: Role | undefined | null, perm: OpsPerm) => Boolean(role && OPS_ROLE_PERMS[role]?.includes(perm))

/** Every mission control permission a role holds. */
export const opsPermsOf = (role: Role | undefined | null): OpsPerm[] => (role ? [...(OPS_ROLE_PERMS[role] ?? [])] : [])

/**
 * Money approvals need a second person: whoever asked for a refund or credit, or drafted a payout
 * run, can't approve it themselves. Owners may (a small team may have only one person on hand).
 */
export function secondPersonProblem(approver: { email: string; role: Role }, requestedBy: string): string | null {
  if (approver.role === "owner") return null
  return approver.email.toLowerCase() === requestedBy.toLowerCase() ? "Someone else has to approve this: you asked for it." : null
}
