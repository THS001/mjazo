import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EntryRow } from "./store"

// The read layer with storage mocked: published edits override the built-in defaults, hidden
// items disappear, new items appear, and anything broken falls back to the defaults.

const rows: Record<string, Partial<EntryRow>[]> = {}
let failing = false
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
const media: { id: string; url: string; mime: string; width: number | null; height: number | null; alt: { en: string } | null; focal: [number, number] | null; color: string | null }[] = []
vi.mock("./media", () => ({ listMedia: async () => media }))
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

  it("shows a service photo from the media library's current file, and drops deleted ones", async () => {
    const { getCollection } = await import("./read")
    media.length = 0
    media.push({ id: "m1", url: "https://cdn.example/new.jpg", mime: "image/jpeg", width: 1200, height: 800, alt: { en: "A pro waxing an arm" }, focal: [0.3, 0.4], color: "#aa8877" })
    const svc = (slug: string, image: unknown) => row(slug, { name: { en: slug }, slug, category: "womens-salon", short: { en: "x" }, price: 1000, duration: 30, image })
    rows.service = [svc("full-body-wax", { id: "m1", url: "https://cdn.example/old.jpg" }), svc("underarm-wax", { id: "gone", url: "https://cdn.example/gone.jpg" })]
    const services = await getCollection<{ slug: string; image?: { url: string; alt: string; w?: number; focal?: number[] } | null }>("service")
    const wax = services.find((s) => s.slug === "full-body-wax")?.image
    expect(wax?.url).toBe("https://cdn.example/new.jpg")
    expect(wax?.alt).toBe("A pro waxing an arm")
    expect(wax?.w).toBe(1200)
    expect(wax?.focal).toEqual([0.3, 0.4])
    expect(services.find((s) => s.slug === "underarm-wax")?.image).toBeNull()
    media.length = 0
  })

  it("serves every type's built-in content unchanged in English when nothing is published", async () => {
    const { getCollection, getSingleton } = await import("./read")
    const { allTypes } = await import("./registry")
    for (const t of allTypes()) {
      const got = t.kind === "collection" ? await getCollection(t.type, "en") : await getSingleton(t.type, "en")
      // Categories are stored without their services (the services collection holds them; the
      // catalogue nests them back), so compare without that list.
      const drop = (list: unknown) => (list as Record<string, unknown>[]).map(({ services, ...c }) => c)
      if (t.type === "category") expect(drop(got), t.type).toEqual(drop(t.defaults()))
      else expect(got, t.type).toEqual(t.defaults())
    }
  })

  it("shows shipped Urdu for Urdu pages and English where there is none", async () => {
    const { getSingleton } = await import("./read")
    const nav = await getSingleton<{ header: { services: string; login: string }; footer: { tagline: string } }>("nav", "ur")
    expect(nav.header.services).not.toBe("Services")
    expect(nav.header.services).toMatch(/[؀-ۿ]/)
  })

  it("fills {{tokens}} from settings in catalogue text", async () => {
    const { getCollection, getTokens } = await import("./read")
    rows["settings-policy"] = [row("main", { freeChangeHours: 6, lateFee: { en: "a fee" }, redoHours: 24, leadHours: 2 })]
    rows.category = [row("womens-salon", { name: { en: "Women's Salon" }, slug: "womens-salon", world: "beauty-wellness", status: "live", icon: "Sparkles", proType: "women", tagline: { en: "Free changes up to {{policy.freeChangeHours}} hours" }, heroLine: { en: "x" }, includes: [], excludes: [], faqs: [] })]
    const cats = await getCollection<{ slug: string; tagline: string }>("category", "en", await getTokens())
    expect(cats.find((c) => c.slug === "womens-salon")?.tagline).toBe("Free changes up to 6 hours")
  })
})
