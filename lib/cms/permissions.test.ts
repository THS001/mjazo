import { beforeAll, describe, expect, it, vi } from "vitest"
import { ROLES, type Role } from "./roles"
import type { AuditRow, EntryRow, VersionRow } from "./store"
import { getType } from "./registry"
import "./types"

// The permission matrix: every role against every kind of change, through the real server actions
// and write rules. Storage is in memory; sign-in, uploads, AI and page fetches are stubbed, but the
// access check itself (allow() in auth.ts) is the real one.

const who = vi.hoisted(() => ({ role: "owner" as string, mfa: "ok" as string }))
const mem = vi.hoisted(() => ({ rows: new Map<string, unknown>(), versions: [] as unknown[], audit: [] as unknown[], seq: 0 }))

vi.mock("./auth", async () => {
  const real = await vi.importActual<typeof import("./auth")>("./auth")
  const user = () => ({ id: `u-${who.role}`, email: `${who.role}@mjazo.test`, name: who.role, role: who.role as Role, mfa: who.mfa as "ok" })
  return { ...real, authMode: () => "dev", getCmsUser: async () => user(), pageUser: async () => user(), requireSession: async () => user(), requireCms: async (perm = "view") => real.allow(user(), perm as never) }
})
vi.mock("./store", () => {
  class ConflictError extends Error {
    constructor(public current: unknown) {
      super("conflict")
    }
  }
  const k = (t: string, id: string) => `${t}/${id}`
  const rows = () => mem.rows as Map<string, EntryRow>
  return {
    ConflictError,
    writable: () => true,
    backend: () => "local",
    listRows: async (type: string) => [...rows().values()].filter((r) => r.type === type).map((r) => structuredClone(r)),
    getRow: async (type: string, id: string) => structuredClone(rows().get(k(type, id)) ?? null),
    writeRow: async (row: EntryRow, expected: number) => {
      const cur = rows().get(k(row.type, row.id))
      if ((cur?.version ?? 0) !== expected) throw new ConflictError(cur ?? null)
      const next = { ...structuredClone(row), version: expected + 1, updated_at: new Date().toISOString() }
      rows().set(k(row.type, row.id), next)
      return structuredClone(next)
    },
    setPositions: async (type: string, order: { id: string; position: number }[]) => order.forEach((o) => rows().get(k(type, o.id)) && (rows().get(k(type, o.id))!.position = o.position)),
    deleteRow: async (type: string, id: string) => void rows().delete(k(type, id)),
    dueScheduled: async (now = new Date()) => [...rows().values()].filter((r) => r.status === "scheduled" && r.publish_at && Date.parse(r.publish_at) <= now.getTime()),
    allRows: async () => [...rows().values()],
    addVersion: async (v: VersionRow) => void mem.versions.push({ ...v, seq: ++mem.seq, created_at: new Date().toISOString() }),
    listVersions: async (type: string, id: string) => (mem.versions as VersionRow[]).filter((v) => v.type === type && v.entry_id === id).map(({ data, ...v }) => v),
    getVersion: async (seq: number) => (mem.versions as VersionRow[]).find((v) => v.seq === seq) ?? null,
    addAudit: async (a: AuditRow) => void mem.audit.push({ ...a, seq: ++mem.seq, at: new Date().toISOString() }),
    listAudit: async () => mem.audit,
  }
})
vi.mock("next/cache", () => ({ updateTag: () => {}, revalidateTag: () => {}, unstable_cache: (fn: () => unknown) => fn }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3000" }), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [] }), draftMode: async () => ({ isEnabled: false }) }))
vi.mock("./redirects", () => ({ saveRedirect: async () => ({}), deleteRedirect: async () => {}, listRedirects: async () => [], matchRedirect: () => null, normalise: (p: string) => p }))
vi.mock("./redirect-rules", async (orig) => ({ ...(await orig<object>()), listRedirects: async () => [] }))
vi.mock("./media", async (orig) => {
  const real = await orig<typeof import("./media")>()
  return { ...real, listMedia: async () => [], prepareUpload: async () => ({}), finishUpload: async () => ({}), updateMedia: async () => ({}), replaceMedia: async () => ({}), deleteMedia: async () => {}, mediaUsage: async () => [], getMedia: async () => null, importMediaRecords: async () => 0 }
})
vi.mock("./seo/audit", async (orig) => ({ ...(await orig<object>()), auditPage: async () => ({}), runPageSpeed: async () => ({}) }))
vi.mock("./translate", async (orig) => ({ ...(await orig<object>()), translateData: async (_f: unknown, data: unknown) => ({ data, count: 0 }) }))
vi.mock("./users", async (orig) => ({ ...(await orig<object>()), inviteUser: async () => {}, updateUser: async () => {} }))

type R = { ok: boolean; issues?: string[] }
/** Allowed means it got past every permission check: it worked, or failed only on the content itself (a validation problem). */
const allowed = (r: R | Response) => (r instanceof Response ? r.status < 400 : r.ok || Boolean(r.issues))

let A: typeof import("../../app/(staff)/admin/actions")
let M: typeof import("../../app/(staff)/admin/media-actions")
let S: typeof import("../../app/(staff)/admin/seo-actions")
let T: typeof import("../../app/(staff)/admin/translate-actions")
let F: typeof import("../../app/(staff)/admin/mfa-actions")
let B: typeof import("../../app/api/cms/backup/route")
let w: typeof import("./write")
let emptyObject: typeof import("./fields").emptyObject

beforeAll(async () => {
  ;[A, M, S, T, F, B, w, { emptyObject }] = await Promise.all([
    import("../../app/(staff)/admin/actions"),
    import("../../app/(staff)/admin/media-actions"),
    import("../../app/(staff)/admin/seo-actions"),
    import("../../app/(staff)/admin/translate-actions"),
    import("../../app/(staff)/admin/mfa-actions"),
    import("../../app/api/cms/backup/route"),
    import("./write"),
    import("./fields"),
  ])
}, 120_000)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type D = Record<string, any>
const SERVICE = "full-body-wax"
const reset = () => {
  mem.rows.clear()
  mem.versions.length = 0
  mem.audit.length = 0
  who.mfa = "ok"
}
const load = async (type: string, id: string) => (await w.loadEntry(type, id))!
const post = async () => "two-week-shaadi-glow-plan"
const fieldsOf = (type: string) => getType(type)!.fields
const edit = (d: D, fn: (x: D) => void) => {
  const x = structuredClone(d)
  fn(x)
  return x
}
const owner = (u = "owner") => ({ id: `u-${u}`, email: `${u}@mjazo.test`, name: u, role: u as Role })
/** As the Owner, leave a draft on an entry, so another role can publish or discard it. */
const draft = async (type: string, id: string, fn: (x: D) => void) => {
  const e = await load(type, id)
  await w.saveDraft(owner(), type, id, edit(e.data, fn), e.version)
  return load(type, id)
}

type Case = { name: string; roles: Role[]; run: () => Promise<R | Response> }
const ALL = [...ROLES]
const CASES: Case[] = [
  { name: "change a service's name", roles: ["owner", "admin", "editor"], run: async () => { const e = await load("service", SERVICE); return A.saveDraftAction("service", SERVICE, edit(e.data, (x) => (x.name.en = "Full body wax")), e.version) } },
  { name: "change a price", roles: ["owner", "admin"], run: async () => { const e = await load("service", SERVICE); return A.saveDraftAction("service", SERVICE, edit(e.data, (x) => (x.price += 500)), e.version) } },
  { name: "change a service's SEO title", roles: ["owner", "admin", "editor", "seo"], run: async () => { const e = await load("service", SERVICE); return A.saveDraftAction("service", SERVICE, edit(e.data, (x) => (x.seo = { ...x.seo, title: { en: "Waxing at home" } })), e.version) } },
  { name: "change site settings", roles: ["owner", "admin"], run: async () => { const e = await load("settings-site", "main"); return A.saveDraftAction("settings-site", "main", edit(e.data, (x) => (x.hours = { en: "9 to 9" })), e.version) } },
  { name: "change SEO settings", roles: ["owner", "admin", "editor", "seo"], run: async () => { const e = await load("settings-seo", "main"); return A.saveDraftAction("settings-seo", "main", edit(e.data, (x) => (x.titleTemplate = "%s | Mjazo")), e.version) } },
  { name: "edit a blog post", roles: ["owner", "admin", "editor", "author"], run: async () => { const id = await post(); const e = await load("post", id); return A.saveDraftAction("post", id, edit(e.data, (x) => (x.title.en = "A better title")), e.version) } },
  { name: "change a post's SEO", roles: ["owner", "admin", "editor", "seo"], run: async () => { const id = await post(); const e = await load("post", id); return A.saveDraftAction("post", id, edit(e.data, (x) => (x.seo = { ...x.seo, description: { en: "New" } })), e.version) } },
  { name: "publish a content change", roles: ["owner", "admin", "editor"], run: async () => { const e = await draft("service", SERVICE, (x) => (x.short.en = "New short")); return A.publishAction("service", SERVICE, e.data, e.version) } },
  { name: "publish an SEO-only change", roles: ["owner", "admin", "editor", "seo"], run: async () => { const e = await draft("service", SERVICE, (x) => (x.seo = { ...x.seo, keyword: { en: "waxing karachi" } })); return A.publishAction("service", SERVICE, e.data, e.version) } },
  { name: "submit a post for review", roles: ["owner", "admin", "editor", "author"], run: async () => { const id = await post(); const e = await load("post", id); return A.submitForReviewAction("post", id, edit(e.data, (x) => (x.title.en = "Draft")), e.version) } },
  { name: "schedule a publish", roles: ["owner", "admin", "editor"], run: async () => { const e = await draft("service", SERVICE, (x) => (x.short.en = "Later")); return A.scheduleAction("service", SERVICE, e.data, e.version, new Date(Date.now() + 3_600_000).toISOString()) } },
  { name: "discard a content draft", roles: ["owner", "admin", "editor"], run: async () => { const e = await draft("service", SERVICE, (x) => (x.short.en = "Oops")); return A.discardAction("service", SERVICE, e.version) } },
  { name: "discard an SEO-only draft", roles: ["owner", "admin", "editor", "seo"], run: async () => { const e = await draft("service", SERVICE, (x) => (x.seo = { ...x.seo, keyword: { en: "x" } })); return A.discardAction("service", SERVICE, e.version) } },
  { name: "create a blog post", roles: ["owner", "admin", "editor", "author"], run: () => A.createAction("post", { ...emptyObject(fieldsOf("post")), title: { en: "New post" }, slug: "new-post" }) },
  { name: "create a service on request (no price)", roles: ["owner", "admin", "editor"], run: () => A.createAction("service", { ...emptyObject(fieldsOf("service")), name: { en: "New" }, slug: "new-svc", category: "womens-salon" }) },
  { name: "create a service with a price", roles: ["owner", "admin"], run: () => A.createAction("service", { ...emptyObject(fieldsOf("service")), name: { en: "New" }, slug: "new-svc", category: "womens-salon", price: 3000 }) },
  { name: "create a block page", roles: ["owner", "admin", "editor"], run: () => A.createAction("block-page", { ...emptyObject(fieldsOf("block-page")), title: { en: "Eid" }, path: "/eid" }) },
  { name: "hide a service", roles: ["owner", "admin", "editor"], run: async () => A.archiveAction("service", SERVICE, (await load("service", SERVICE)).version) },
  { name: "reorder services", roles: ["owner", "admin", "editor"], run: () => A.reorderAction("service", [SERVICE, "brightening-facial"]) },
  {
    name: "restore an older version",
    roles: ["owner", "admin", "editor"],
    run: async () => {
      const e = await draft("service", SERVICE, (x) => (x.short.en = "v1"))
      await w.publish(owner(), "service", SERVICE, e.version)
      const v = (mem.versions as VersionRow[]).at(-1)!
      return A.restoreAction("service", SERVICE, v.seq, (await load("service", SERVICE)).version)
    },
  },
  { name: "see an entry's history", roles: ALL, run: () => A.versionsAction("service", SERVICE) },
  { name: "translate with AI", roles: ["owner", "admin", "editor", "author"], run: async () => T.translateEntryAction("service", (await load("service", SERVICE)).data, "missing") },
  { name: "add a redirect", roles: ["owner", "admin", "editor", "seo"], run: () => S.saveRedirectAction({ source: "/old", destination: "/offers", permanent: true }) },
  { name: "audit a page", roles: ["owner", "admin", "editor", "seo"], run: () => S.auditAction("/about", "en", "") },
  { name: "see the SEO panel", roles: ALL, run: () => S.listRedirectsAction() },
  { name: "upload media", roles: ["owner", "admin", "editor", "author"], run: () => M.prepareUploadAction({ name: "a.jpg", mime: "image/jpeg", size: 1000 }) },
  { name: "delete media", roles: ["owner", "admin"], run: () => M.deleteMediaAction("m1") },
  { name: "invite people", roles: ["owner", "admin"], run: () => A.inviteAction("new@mjazo.test", "New", "editor") },
  { name: "reset someone's two-step sign-in", roles: ["owner", "admin"], run: () => F.mfaResetAction("u-someone") },
  { name: "download a backup", roles: ["owner", "admin"], run: () => B.GET() },
  { name: "restore a backup", roles: ["owner"], run: () => B.POST(new Request("http://localhost/api/cms/backup?mode=draft", { method: "POST", body: JSON.stringify({ format: "mjazo-cms-backup", version: 1, exportedAt: "2026-10-05T00:00:00Z", exportedBy: "x", site: "x", entries: [], media: [], redirects: [] }) })) },
]

describe("permission matrix", () => {
  for (const c of CASES)
    it(`${c.name}: ${c.roles.length === ALL.length ? "everyone" : c.roles.join(", ")}`, async () => {
      const got: Record<string, boolean> = {}
      for (const role of ALL) {
        reset()
        who.role = role
        got[role] = allowed(await c.run())
      }
      expect(got).toEqual(Object.fromEntries(ALL.map((r) => [r, c.roles.includes(r)])))
    })
})

describe("two-step sign-in", () => {
  it("stops an Owner who hasn't entered their code from changing anything, but lets them finish signing in", async () => {
    reset()
    who.role = "owner"
    who.mfa = "needs-code"
    const e = await load("service", SERVICE)
    const r = await A.saveDraftAction("service", SERVICE, edit(e.data, (x) => (x.name.en = "x")), e.version)
    expect(r).toMatchObject({ ok: false, error: "Finish two-step sign-in first: reload the page." })
    expect((await B.GET()).status).toBe(403)
    expect(await F.mfaStatusAction()).toMatchObject({ ok: true })
  })
})

describe("scheduled publishing", () => {
  it("cancels a schedule when someone who can't publish edits the entry, so their edit isn't published for them", async () => {
    reset()
    const id = await post()
    const e = await draft("post", id, (x) => (x.title.en = "Editor's version"))
    await w.schedule(owner("editor"), "post", id, e.version, new Date(Date.now() + 60_000).toISOString())
    who.role = "author"
    const s = await load("post", id)
    expect(await A.saveDraftAction("post", id, edit(s.data, (x) => (x.title.en = "Author's change")), s.version)).toMatchObject({ ok: true })
    expect((await load("post", id)).state).not.toBe("scheduled")
    expect(await w.publishDue()).toEqual([])
  })

  it("keeps the schedule when someone who could publish edits it", async () => {
    reset()
    const e = await draft("service", SERVICE, (x) => (x.short.en = "Scheduled"))
    await w.schedule(owner(), "service", SERVICE, e.version, new Date(Date.now() + 60_000).toISOString())
    who.role = "editor"
    const s = await load("service", SERVICE)
    await A.saveDraftAction("service", SERVICE, edit(s.data, (x) => (x.short.en = "Scheduled, edited")), s.version)
    expect((await load("service", SERVICE)).state).toBe("scheduled")
  })
})

describe("hardening", () => {
  it("won't save to an entry that doesn't exist (new ones go through Create)", async () => {
    reset()
    const r = await A.saveDraftAction("service", "made-up-id", { name: { en: "x" } }, 0)
    expect(r).toMatchObject({ ok: false, issues: ["This item doesn't exist (any more). Reload the page."] })
    expect(mem.rows.size).toBe(0)
  })

  it("ignores unknown items when reordering", async () => {
    reset()
    await A.reorderAction("service", ["not-a-service", SERVICE])
    expect([...mem.rows.keys()]).toEqual([`service/${SERVICE}`])
  })

  it("refuses page addresses that would reach another website", async () => {
    reset()
    for (const p of ["@evil.example/x", "//evil.example", "https://evil.example", "\\\\evil"]) expect(await S.seoPanelAction(p, "en")).toMatchObject({ ok: false, issues: ["That isn't an address on this site."] })
  })

  it("keeps Owners as the only ones who can make Owners, and stops people changing themselves", async () => {
    const { guard } = await vi.importActual<typeof import("./users")>("./users")
    expect(() => guard(owner("admin"), "owner")).toThrow(/Only an Owner/)
    expect(() => guard(owner("owner"), "admin", "u-owner")).toThrow(/your own role/)
    expect(() => guard(owner("owner"), "owner", "u-other")).not.toThrow()
  })
})
