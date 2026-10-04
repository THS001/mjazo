import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { Redirect } from "./redirect-rules"

// Saving redirects with storage mocked: validation, editing a redirect's old address, and the
// automatic redirect when a published item's address changes (no chains, no loops when it changes back).

let rows: Redirect[] = []
const audit: string[] = []
vi.mock("@/lib/server/store", () => ({ db: null }))
vi.mock("./store", () => ({ addAudit: async (a: { action: string; title: string }) => void audit.push(`${a.action}: ${a.title}`) }))
vi.mock("./redirect-rules", async (orig) => ({
  ...(await orig<typeof import("./redirect-rules")>()),
  listRedirects: async () => rows.map((r) => ({ ...r })),
  readLocal: async () => rows.map((r) => ({ ...r })),
  writeLocal: async (next: Redirect[]) => void (rows = next),
}))

const me = { id: "u1", name: "Sana" }
const row = (source: string, destination: string, hits = 0): Redirect => ({ source, destination, permanent: true, hits, note: null, created_by: "x", created_at: "2026-10-01T00:00:00Z" })
const map = () => Object.fromEntries(rows.map((r) => [r.source, r.destination]))

describe("saveRedirect", () => {
  let saveRedirect: typeof import("./redirects").saveRedirect
  // The first import loads the server modules, which can be slow on a busy machine.
  beforeAll(async () => void ({ saveRedirect } = await import("./redirects")), 60_000)

  beforeEach(() => {
    rows = []
    audit.length = 0
  })

  it("saves a normalised redirect and records it", async () => {
    await saveRedirect(me, { source: "ur/old-offer/", destination: "/offers", note: "Summer promo ended" })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ source: "/old-offer", destination: "/offers", permanent: true, note: "Summer promo ended", created_by: "Sana" })
    expect(audit).toEqual(["saved a redirect: /old-offer → /offers"])
  })

  it("refuses a loop and a duplicate source", async () => {
    rows = [row("/a", "/b")]
    await expect(saveRedirect(me, { source: "/b", destination: "/a" })).rejects.toMatchObject({ issues: ["That would create a redirect loop."] })
    await expect(saveRedirect(me, { source: "/a", destination: "/c" })).rejects.toMatchObject({ issues: ["There's already a redirect from /a. Edit that one instead."] })
    expect(map()).toEqual({ "/a": "/b" })
  })

  it("edits a redirect in place, keeping its hit count, even when its old address changes", async () => {
    rows = [row("/a", "/b", 7), row("/x", "/y")]
    await saveRedirect(me, { source: "/a", destination: "/c", previous: "/a" })
    expect(map()).toEqual({ "/a": "/c", "/x": "/y" })
    await saveRedirect(me, { source: "/a2", destination: "/c", previous: "/a" })
    expect(map()).toEqual({ "/a2": "/c", "/x": "/y" })
    expect(rows.find((r) => r.source === "/a2")?.hits).toBe(7)
  })

  it("points older redirects straight at an item's newest address", async () => {
    await saveRedirect(me, { source: "/services/salon/wax", destination: "/services/salon/waxing" }, { auto: true })
    await saveRedirect(me, { source: "/services/salon/waxing", destination: "/services/salon/body-waxing" }, { auto: true })
    expect(map()).toEqual({ "/services/salon/wax": "/services/salon/body-waxing", "/services/salon/waxing": "/services/salon/body-waxing" })
    expect(audit.at(-1)).toBe("added a redirect (address changed): /services/salon/waxing → /services/salon/body-waxing")
  })

  it("drops the old redirect when an item goes back to its earlier address", async () => {
    await saveRedirect(me, { source: "/blog/a", destination: "/blog/b" }, { auto: true })
    await saveRedirect(me, { source: "/blog/b", destination: "/blog/a" }, { auto: true })
    expect(map()).toEqual({ "/blog/b": "/blog/a" })
  })
})
