import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { ROLES, type Role } from "@/lib/cms/roles"
import type { Db } from "@/lib/core/db"

// Mission control's permission matrix: every role against every kind of action, through the real
// /api/ops routes, on a real (in-memory) core database. The sign-in is stubbed, but the access
// check itself (allowStaff in lib/server/staff.ts) is the real one. Modelled on
// lib/cms/permissions.test.ts.

const who = vi.hoisted(() => ({ role: "owner" as string | null, mfa: "ok" as string }))
const mem = vi.hoisted(() => ({ docs: new Map<string, Map<string, unknown>>(), subs: [] as unknown[] }))

vi.mock("@/lib/cms/auth", async (orig) => ({
  ...(await orig<object>()),
  authMode: () => "dev",
  getCmsUser: async () => (who.role ? { id: `u-${who.role}`, email: `${who.role}@mjazo.test`, name: who.role, role: who.role, mfa: who.mfa } : null),
}))
vi.mock("@/lib/server/docs", () => {
  const col = (c: string) => {
    if (!mem.docs.has(c)) mem.docs.set(c, new Map())
    return mem.docs.get(c) as Map<string, { id: string }>
  }
  return {
    all: async (c: string) => [...col(c).values()].map((x) => structuredClone(x)),
    get: async (c: string, id: string) => structuredClone(col(c).get(id) ?? null),
    put: async (c: string, d: { id: string }) => void col(c).set(d.id, structuredClone(d)),
    putMany: async (c: string, list: { id: string }[]) => list.forEach((d) => col(c).set(d.id, structuredClone(d))),
    insertNew: async (c: string, list: { id: string }[]) => list.forEach((d) => col(c).has(d.id) || col(c).set(d.id, structuredClone(d))),
    mutate: async (c: string, id: string, fn: (d: unknown) => void) => {
      const d = col(c).get(id)
      if (!d) return null
      const x = structuredClone(d)
      fn(x)
      col(c).set(id, x)
      return x
    },
    remove: async (c: string, id: string) => void col(c).delete(id),
  }
})
vi.mock("@/lib/server/store", async (orig) => ({
  ...(await orig<object>()),
  db: null,
  listSubmissions: async (type: string) => (mem.subs as { type: string }[]).filter((s) => s.type === type),
  saveSubmission: async () => ({ id: "MJ-X", record: {} }),
  notifyOps: async () => {},
}))
vi.mock("@/lib/cms/read", async () => {
  const { buildCatalog, DEFAULT_CATALOG } = await import("@/lib/catalog")
  const cat = buildCatalog(DEFAULT_CATALOG)
  const { MESSAGES } = await import("@/lib/cms/types/messages")
  return { getCatalog: async () => cat, getSettings: async () => ({ referral: { friendOff: 500, youGet: 500 }, plus: { price: 2500, period: "year", discount: 0.1 }, policy: { leadHours: 2 } }), getMessages: async () => MESSAGES }
})
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [] }) }))

type Handler = (req: Request) => Promise<Response>
type Mod = { GET?: Handler | (() => Promise<Response>); POST?: Handler }
let R: Record<string, Mod>
let db: Db & { close(): Promise<void> }
let bookingId = ""

const url = (path: string) => `http://localhost/api/ops/${path}`
const post = (m: Mod, body: unknown) => m.POST!(new Request(url("x"), { method: "POST", body: JSON.stringify(body) }))
const get = (m: Mod, query = "") => (m.GET as Handler)(new Request(url(`x${query}`)))
const allowed = (r: Response) => r.status !== 401 && r.status !== 403

beforeAll(async () => {
  const { testCore } = await import("@/lib/core/test-db")
  db = await testCore()
  R = {
    data: await import("../../app/api/ops/data/route"),
    jobs: await import("../../app/api/ops/jobs/route"),
    pros: await import("../../app/api/ops/pros/route"),
    booking: await import("../../app/api/ops/booking/route"),
    money: await import("../../app/api/ops/money/route"),
    promos: await import("../../app/api/ops/promos/route"),
    growth: await import("../../app/api/ops/growth/route"),
    kpi: await import("../../app/api/ops/kpi/route"),
    pilot: await import("../../app/api/ops/pilot/route"),
    audit: await import("../../app/api/ops/audit/route"),
    requests: await import("../../app/api/ops/requests/route"),
    trust: await import("../../app/api/ops/trust/route"),
    insights: await import("../../app/api/ops/insights/route"),
    recruiting: await import("../../app/api/ops/recruiting/route"),
    "route-plan": await import("../../app/api/ops/route-plan/route"),
    weddings: await import("../../app/api/ops/weddings/route"),
    ask: await import("../../app/api/ops/ask/route"),
    automations: await import("../../app/api/ops/automations/route"),
  } as Record<string, Mod>
  const cj = await import("@/lib/core/jobs")
  const { buildCatalog, DEFAULT_CATALOG } = await import("@/lib/catalog")
  await cj.savePro(db, { id: "P-1", name: "Sana", phone: "03111111111", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
  const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  const b = await cj.createBooking(db, { id: "MJ-PERM1", name: "Ayesha", phone: "03001234567", area: "dha", address: "House 1", date: tomorrow, window: "5–7 pm", payment: "cash", items: [{ name: "x", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1 }] }, buildCatalog(DEFAULT_CATALOG))
  bookingId = b.id
  mem.docs.set("complaints", new Map([["C-1", { id: "C-1", createdAt: new Date().toISOString(), bookingId, phone: "03001234567", text: "Late", status: "new" }]]))
  mem.subs.push({ id: "MJ-ENQ1", type: "enquiry", data: { kind: "plus", name: "Hina", phone: "03009999999" }, attribution: {}, created_at: new Date().toISOString() })
}, 180_000)
afterAll(() => db?.close())

type Case = { name: string; roles: Role[]; run: () => Promise<Response> }
const ALL = [...ROLES]
const OPS: Role[] = ["owner", "admin", "dispatcher", "support", "finance", "recruiter"]
const CASES: Case[] = [
  { name: "open the live board", roles: OPS, run: () => get(R.data) },
  { name: "assign a pro", roles: ["owner", "admin", "dispatcher"], run: () => post(R.jobs, { action: "assign", jobId: bookingId, proId: "P-1" }) },
  { name: "offer a visit to a pro", roles: ["owner", "admin", "dispatcher"], run: () => post(R.jobs, { action: "offer", jobId: "MJ-NONE", proId: "P-1" }) },
  { name: "withdraw an offer", roles: ["owner", "admin", "dispatcher"], run: () => post(R.jobs, { action: "withdraw_offer", jobId: bookingId }) },
  { name: "move a visit along (check out)", roles: ["owner", "admin", "dispatcher"], run: () => post(R.jobs, { action: "event", jobId: bookingId, type: "checked_out" }) },
  { name: "add a note from the board", roles: ["owner", "admin", "dispatcher", "support"], run: () => post(R.jobs, { action: "event", jobId: bookingId, type: "note", note: "Called" }) },
  { name: "resolve an SOS", roles: ["owner", "admin", "dispatcher"], run: () => post(R.jobs, { action: "resolve_sos", id: "S-1" }) },
  { name: "open a booking page", roles: OPS, run: () => get(R.booking, `?id=${bookingId}`) },
  { name: "add a booking note", roles: ["owner", "admin", "dispatcher", "support"], run: () => post(R.booking, { action: "note", id: bookingId, note: "Gate code 12" }) },
  { name: "reschedule a booking", roles: ["owner", "admin", "dispatcher", "support"], run: () => post(R.booking, { action: "reschedule", id: bookingId, date: "2000-01-01", window: "5–7 pm" }) },
  { name: "cancel a booking", roles: ["owner", "admin", "dispatcher", "support"], run: () => post(R.booking, { action: "cancel", id: "MJ-NONE", reason: "Customer asked" }) },
  { name: "ask for a credit", roles: ["owner", "admin", "support", "finance"], run: () => post(R.booking, { action: "request", id: bookingId, kind: "credit", amount: 100, reason: "Sorry" }) },
  { name: "approve a refund or credit", roles: ["owner", "finance"], run: () => post(R.booking, { action: "decide", id: bookingId, requestId: "MR-NONE", approve: true }) },
  { name: "see money", roles: ["owner", "finance"], run: () => get(R.money) },
  { name: "record cash handed in", roles: ["owner", "finance"], run: () => post(R.money, { action: "cash_in", proId: "P-1", amount: 100 }) },
  { name: "draft a payout run", roles: ["owner", "finance"], run: () => post(R.money, { action: "draft_run", periodStart: "2099-01-01", periodEnd: "2099-01-07" }) },
  { name: "mark a payout paid", roles: ["owner", "finance"], run: () => post(R.money, { action: "pay", payoutId: "PO-NONE", reference: "T1" }) },
  { name: "check a payment", roles: ["owner", "finance"], run: () => post(R.trust, { action: "verify", jobId: bookingId }) },
  { name: "resolve a complaint", roles: ["owner", "admin", "support"], run: () => post(R.trust, { action: "resolve", id: "C-1", resolution: "Apologised, redo booked" }) },
  { name: "open the Trust Desk", roles: ["owner", "admin", "support", "finance"], run: () => get(R.trust) },
  { name: "follow up a leakage flag", roles: ["owner", "admin", "support"], run: () => post(R.insights, { action: "leak_dismiss", key: "x|P-1|y" }) },
  { name: "see the requests inbox", roles: ["owner", "admin", "support"], run: () => get(R.requests) },
  { name: "mark a request done", roles: ["owner", "admin", "support"], run: () => post(R.requests, { id: "MJ-ENQ1", status: "contacted" }) },
  { name: "see the pros", roles: OPS, run: () => get(R.pros) },
  { name: "add a pro", roles: ["owner", "admin", "dispatcher", "recruiter"], run: () => post(R.pros, { action: "create", name: "New Pro", phone: "03211111111", area: "dha", skills: ["womens-salon"], women: true, pin: "1234" }) },
  { name: "change a pro's schedule", roles: ["owner", "admin", "dispatcher", "recruiter"], run: () => post(R.pros, { action: "profile", id: "P-1", dailyCap: 4 }) },
  { name: "set a pro's sign-in email", roles: ["owner", "admin", "dispatcher", "recruiter"], run: () => post(R.pros, { action: "update", id: "P-1", email: "sana@mjazo.test" }) },
  { name: "change a pro's commission", roles: ["owner", "finance"], run: () => post(R.pros, { action: "profile", id: "P-1", commissionRate: 0.25 }) },
  { name: "tick a verification check", roles: ["owner", "admin", "recruiter"], run: () => post(R.pros, { action: "verify", id: "P-1", key: "references", done: true }) },
  { name: "set a zone cap", roles: ["owner", "admin", "dispatcher", "recruiter"], run: () => post(R.pros, { action: "zone_cap", slug: "dha", cap: null }) },
  { name: "see recruiting", roles: ["owner", "admin", "recruiter"], run: () => (R.recruiting.GET as () => Promise<Response>)() },
  { name: "move an applicant on", roles: ["owner", "admin", "recruiter"], run: () => post(R.recruiting, { action: "status", id: "A-NONE", status: "interviewing" }) },
  { name: "look at a Route Brain plan", roles: OPS, run: () => post(R["route-plan"], { date: "2099-01-01" }) },
  { name: "apply a Route Brain plan", roles: ["owner", "admin", "dispatcher"], run: () => post(R["route-plan"], { date: "2099-01-01", apply: true }) },
  { name: "approve a wedding plan", roles: ["owner", "admin", "dispatcher"], run: () => post(R.weddings, { action: "approve", id: "W-NONE" }) },
  { name: "see promo codes", roles: ["owner", "admin", "finance"], run: () => (R.promos.GET as () => Promise<Response>)() },
  { name: "see Plus and gift cards", roles: ["owner", "finance"], run: () => (R.growth.GET as () => Promise<Response>)() },
  { name: "issue a gift card", roles: ["owner", "finance"], run: () => post(R.growth, { action: "issue_gift", amount: 1000, paidVia: "cash" }) },
  { name: "add a pack by phone", roles: ["owner", "finance"], run: () => post(R.growth, { action: "activate_pack", slug: "ac-year", phone: "03219998887", name: "Pack Test", paidVia: "cash" }) },
  { name: "cancel a pack", roles: ["owner", "finance"], run: () => post(R.growth, { action: "cancel_pack", packId: "PK-NONE" }) },
  { name: "create a promo code", roles: ["owner", "admin", "finance"], run: () => post(R.promos, { action: "create", promo: { code: `T${Math.random().toString(36).slice(2, 8).toUpperCase()}`, kind: "percent", value: 10 } }) },
  { name: "see KPIs", roles: ["owner", "admin", "dispatcher", "finance"], run: () => get(R.kpi, "?days=7") },
  { name: "see the pilot gates", roles: ["owner", "admin", "dispatcher", "finance"], run: () => get(R.pilot, "?window=30") },
  { name: "enter the pilot spend", roles: ["owner", "finance"], run: () => post(R.pilot, { action: "month", month: "2026-10", marketing: 20000, transport: 9000 }) },
  { name: "change the pilot settings", roles: ["owner", "finance"], run: () => post(R.pilot, { action: "settings", taxRate: 0.08 }) },
  { name: "see the audit log", roles: ["owner", "admin", "finance"], run: () => get(R.audit) },
  { name: "ask the AI", roles: ["owner", "admin", "dispatcher", "support"], run: () => post(R.ask, { question: "How many bookings today?" }) },
  { name: "see the automations", roles: ["owner", "admin"], run: () => get(R.automations) },
  { name: "switch an automation on or off", roles: ["owner", "admin"], run: () => post(R.automations, { action: "save", key: "winBack", enabled: false }) },
  { name: "run the automation now", roles: ["owner", "admin"], run: () => post(R.automations, { action: "run" }) },
]

describe("mission control permission matrix", () => {
  for (const c of CASES)
    it(`${c.name}: ${c.roles.join(", ")}`, async () => {
      const got: Record<string, boolean> = {}
      for (const role of ALL) {
        who.role = role
        who.mfa = "ok"
        const res = await c.run()
        got[role] = allowed(res)
        // A real failure would be a 500; 503 is "AI isn't switched on" (no key in tests).
        expect([500, 502].includes(res.status), `${role}: ${c.name} (${res.status})`).toBe(false)
      }
      expect(got).toEqual(Object.fromEntries(ALL.map((r) => [r, c.roles.includes(r)])))
    }, 60_000)
})

describe("signing in", () => {
  it("asks a signed-out visitor to sign in", async () => {
    who.role = null
    expect((await get(R.data)).status).toBe(401)
    expect((await post(R.money, { action: "cash_in", proId: "P-1", amount: 1 })).status).toBe(401)
  })

  it("stops Finance from touching money until two-step sign-in is done", async () => {
    who.role = "finance"
    who.mfa = "needs-setup"
    const res = await get(R.money)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/two-step/)
    who.mfa = "ok"
    expect((await get(R.money)).status).toBe(200)
  })

  it("records each action with the person's email", async () => {
    who.role = "dispatcher"
    who.mfa = "ok"
    expect((await post(R.booking, { action: "note", id: bookingId, note: "Bring a ladder" })).status).toBe(200)
    const row = await db.one<{ actor: string; action: string }>("select actor, action from audit_log where target = $1 order by id desc limit 1", [bookingId])
    expect(row).toEqual({ actor: "dispatcher@mjazo.test", action: "added a booking note" })
    const ev = await db.one<{ actor: string; note: string }>("select actor, note from booking_events where booking_id = $1 order by id desc limit 1", [bookingId])
    expect(ev).toEqual({ actor: "dispatcher@mjazo.test", note: "Bring a ladder" })
  })

  it("shows each person only what their role can open", async () => {
    who.role = "support"
    const me = (await (await get(R.data)).json()).me
    expect(me).toMatchObject({ email: "support@mjazo.test", role: "support", roleLabel: "Support" })
    expect(me.perms).toContain("ops.requests")
    expect(me.perms).not.toContain("ops.money")
  })
})

describe("who can give which role", () => {
  it("lets only an Owner make someone Finance or an Owner", async () => {
    const { guard } = await import("@/lib/cms/users")
    const admin = { id: "u-a", email: "a@mjazo.test", name: "a", role: "admin" as const }
    const owner = { id: "u-o", email: "o@mjazo.test", name: "o", role: "owner" as const }
    expect(() => guard(admin, "finance")).toThrow(/Only an Owner/)
    expect(() => guard(admin, "owner")).toThrow(/Only an Owner/)
    expect(() => guard(admin, "dispatcher")).not.toThrow()
    expect(() => guard(owner, "finance")).not.toThrow()
  })
})
