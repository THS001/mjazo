import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { EntryRow, VersionRow } from "./store"

// Backups: what goes in, and the two ways back (as drafts, or exactly as it was), with storage in memory.

const mem = vi.hoisted(() => ({ rows: new Map<string, unknown>(), versions: [] as unknown[], audit: [] as string[], redirects: [] as unknown[], media: [] as unknown[] }))
vi.mock("next/cache", () => ({ revalidateTag: () => {} }))
vi.mock("./store", () => {
  const k = (t: string, id: string) => `${t}/${id}`
  const rows = () => mem.rows as Map<string, EntryRow>
  return {
    allRows: async () => [...rows().values()],
    getRow: async (t: string, id: string) => structuredClone(rows().get(k(t, id)) ?? null),
    writeRow: async (row: EntryRow, expected: number) => {
      if ((rows().get(k(row.type, row.id))?.version ?? 0) !== expected) throw new Error("conflict")
      const next = { ...structuredClone(row), version: expected + 1, updated_at: "now" }
      rows().set(k(row.type, row.id), next)
      return next
    },
    addVersion: async (v: VersionRow) => void mem.versions.push(v),
    addAudit: async (a: { action: string; title: string }) => void mem.audit.push(`${a.action}: ${a.title}`),
  }
})
vi.mock("./media", () => ({ listMedia: async () => mem.media, importMediaRecords: async (r: unknown[]) => r.length }))
vi.mock("./redirect-rules", () => ({ listRedirects: async () => mem.redirects }))
vi.mock("./redirects", () => ({ saveRedirect: async (_u: unknown, r: unknown) => void mem.redirects.push(r) }))

let B: typeof import("./backup")
beforeAll(async () => void (B = await import("./backup")), 60_000)
beforeEach(() => {
  mem.rows.clear()
  mem.versions.length = 0
  mem.audit.length = 0
  mem.redirects.length = 0
})

const me = { id: "u1", email: "o@mjazo.test", name: "Owner", role: "owner" as const }
const svc = (name: string) => ({ name: { en: name }, slug: "full-body-wax", category: "womens-salon", short: { en: "x" }, price: 4500, duration: 120 })
const row = (over: Partial<EntryRow>): EntryRow => ({ type: "service", id: "full-body-wax", status: "published", draft: null, published: svc("Live name"), review: false, position: 3, version: 4, publish_at: null, updated_by: "x", updated_at: "x", published_by: "x", published_at: "2026-10-01", ...over })

describe("backups", () => {
  it("exports every saved entry, the media records and the redirects", async () => {
    mem.rows.set("service/full-body-wax", row({}))
    mem.redirects.push({ source: "/old", destination: "/offers" })
    const b = await B.exportBackup(me)
    expect(b).toMatchObject({ format: "mjazo-cms-backup", version: 1, exportedBy: "Owner", entries: [expect.objectContaining({ id: "full-body-wax" })], redirects: [{ source: "/old" }] })
    expect(B.checkBackup(JSON.parse(JSON.stringify(b)))).toEqual([])
    expect(mem.audit[0]).toMatch(/downloaded a backup/)
  })

  it("refuses files that aren't a backup", () => {
    expect(B.checkBackup({ hello: 1 })).toEqual(["That file isn't a Mjazo CMS backup."])
    expect(B.checkBackup({ format: "mjazo-cms-backup", version: 2, entries: [] })[0]).toMatch(/version 2/)
  })

  it("as drafts: the live site keeps its content, and each entry gets an imported version", async () => {
    mem.rows.set("service/full-body-wax", row({ published: svc("Live name") }))
    const backup = { format: "mjazo-cms-backup", version: 1, exportedAt: "2026-10-01T00:00:00Z", exportedBy: "x", site: "x", entries: [row({ published: svc("Old name"), version: 9 })], media: [], redirects: [{ source: "/a", destination: "/b", permanent: true }] } as never
    const r = await B.importBackup(me, backup, "draft")
    expect(r).toMatchObject({ entries: 1, redirects: 1, skipped: [] })
    const now = mem.rows.get("service/full-body-wax") as EntryRow
    expect(now).toMatchObject({ status: "published", published: svc("Live name"), draft: svc("Old name") })
    expect(mem.versions).toEqual([expect.objectContaining({ kind: "imported", note: "From the backup of 2026-10-01 (as a draft)" })])
  })

  it("exactly: entries come back as they were, schedules and hidden items included", async () => {
    const backup = {
      format: "mjazo-cms-backup",
      version: 1,
      exportedAt: "2026-10-01T00:00:00Z",
      exportedBy: "x",
      site: "x",
      entries: [row({ status: "archived", published: svc("Hidden") }), row({ id: "post-x", type: "nope" }), row({ id: "main", type: "settings-site", published: { name: 123 } })],
      media: [],
      redirects: [],
    } as never
    const r = await B.importBackup(me, backup, "replace")
    expect(r.entries).toBe(1)
    expect(r.skipped.map((s) => s.what)).toEqual(["nope/post-x", "settings-site/main"])
    expect(mem.rows.get("service/full-body-wax")).toMatchObject({ status: "archived", published: svc("Hidden"), position: 3 })
    expect(mem.audit.at(-1)).toMatch(/^restored a backup: 1 entries/)
  })

  it("leaves entries that already match alone, so they aren't marked as changed", async () => {
    mem.rows.set("service/full-body-wax", row({ published: svc("Same") }))
    const before = structuredClone(mem.rows.get("service/full-body-wax"))
    const r = await B.importBackup(me, { format: "mjazo-cms-backup", version: 1, exportedAt: "2026-10-01T00:00:00Z", exportedBy: "x", site: "x", entries: [row({ published: svc("Same") })], media: [], redirects: [] } as never, "draft")
    expect(r).toMatchObject({ entries: 0, unchanged: 1 })
    expect(mem.audit.at(-1)).toContain("0 entries (1 already matched)")
    expect(mem.rows.get("service/full-body-wax")).toEqual(before)
    expect(mem.versions).toEqual([])
  })

  it("never brings a hidden item back to the site when importing as drafts", async () => {
    mem.rows.set("service/full-body-wax", row({ status: "archived" }))
    await B.importBackup(me, { format: "mjazo-cms-backup", version: 1, exportedAt: "2026-10-01T00:00:00Z", exportedBy: "x", site: "x", entries: [row({ published: svc("Back") })], media: [], redirects: [] } as never, "draft")
    expect(mem.rows.get("service/full-body-wax")).toMatchObject({ status: "archived", draft: svc("Back") })
  })
})
