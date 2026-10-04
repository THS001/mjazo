import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EntryRow } from "./store"

// The read layer with storage mocked: published edits override the built-in defaults, hidden
// items disappear, new items appear, and anything broken falls back to the defaults.

const rows: Record<string, Partial<EntryRow>[]> = {}
let failing = false
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("./store", () => ({
  listRows: async (type: string) => {
    if (failing) throw new Error("database down")
    return rows[type] ?? []
  },
}))

const row = (id: string, published: Record<string, unknown> | null, extra: Partial<EntryRow> = {}): Partial<EntryRow> => ({ id, status: "published", published, position: null, ...extra })

describe("getCollection / getCatalog", () => {
  beforeEach(() => {
    for (const k of Object.keys(rows)) delete rows[k]
    failing = false
  })

  it("serves the built-in catalogue with no rows", async () => {
    const { getCatalog } = await import("./read")
    const cat = await getCatalog()
    expect(cat.serviceCount).toBe(132)
  })

  it("applies a published price, hides an archived service and adds a new one", async () => {
    const { getCollection } = await import("./read")
    rows.service = [
      row("full-body-wax", { name: { en: "Full body waxing" }, slug: "full-body-wax", category: "womens-salon", short: { en: "All over" }, price: 4600, duration: 120 }),
      row("underarm-wax", null, { status: "archived" }),
      row("brow-lamination", { name: { en: "Brow lamination" }, slug: "brow-lamination", category: "womens-salon", short: { en: "Fuller brows" }, price: 3200, duration: 45 }),
      row("never-published", null, { status: "draft", draft: { name: { en: "Draft" } } as never }),
    ]
    const services = await getCollection<{ slug: string; price: number }>("service")
    expect(services.find((s) => s.slug === "full-body-wax")?.price).toBe(4600)
    expect(services.some((s) => s.slug === "underarm-wax")).toBe(false)
    expect(services.some((s) => s.slug === "brow-lamination")).toBe(true)
    expect(services.some((s) => s.slug === "never-published")).toBe(false)
  })

  it("keeps the default when stored data is invalid", async () => {
    const { getCollection } = await import("./read")
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    rows.service = [row("full-body-wax", { name: { en: "Broken" }, slug: "Not A Slug", category: "womens-salon", price: "free" })]
    const services = await getCollection<{ slug: string; name: string; price: number }>("service")
    const s = services.find((x) => x.slug === "full-body-wax")
    expect(s?.name).toBe("Full body waxing")
    expect(s?.price).toBe(4500)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it("orders by position, including built-in items that were only reordered", async () => {
    const { getCollection } = await import("./read")
    rows.world = [row("moving", null, { position: -1 })]
    const worlds = await getCollection<{ slug: string }>("world")
    expect(worlds[0].slug).toBe("moving")
  })

  it("falls back to built-in content when the database fails", async () => {
    const { getSettings } = await import("./read")
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    failing = true
    const s = await getSettings()
    expect(s.site.whatsapp).toBe("923000000000")
    err.mockRestore()
  })

  it("fills {{tokens}} from settings in catalogue text", async () => {
    const { getCollection, getTokens } = await import("./read")
    rows["settings-policy"] = [row("main", { freeChangeHours: 6, lateFee: { en: "a fee" }, redoHours: 24, leadHours: 2 })]
    rows.category = [row("womens-salon", { name: { en: "Women's Salon" }, slug: "womens-salon", world: "beauty-wellness", status: "live", icon: "Sparkles", proType: "women", tagline: { en: "Free changes up to {{policy.freeChangeHours}} hours" }, heroLine: { en: "x" }, includes: [], excludes: [], faqs: [] })]
    const cats = await getCollection<{ slug: string; tagline: string }>("category", "en", await getTokens())
    expect(cats.find((c) => c.slug === "womens-salon")?.tagline).toBe("Free changes up to 6 hours")
  })
})
