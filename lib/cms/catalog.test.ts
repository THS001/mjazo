import { describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import { can, ROLE_INFO } from "./roles"

describe("catalogue helpers over CMS data", () => {
  const cat = buildCatalog(DEFAULT_CATALOG)

  it("matches the built-in catalogue", () => {
    expect(cat.worlds).toHaveLength(8)
    expect(cat.visibleCategories).toHaveLength(22)
    expect(cat.serviceCount).toBe(132)
    expect(cat.getService("womens-salon", "full-body-wax")?.service.price).toBe(4500)
  })

  it("reflects edited data: prices, hidden categories and new services", () => {
    const data = structuredClone(DEFAULT_CATALOG)
    const salon = data.categories.find((c) => c.slug === "womens-salon")!
    salon.services.find((s) => s.slug === "full-body-wax")!.price = 4600
    salon.services.push({ slug: "brow-lamination", name: "Brow lamination", short: "Fuller brows", price: 3200, duration: 45 })
    data.categories.find((c) => c.slug === "pest-control")!.status = "hidden"
    const edited = buildCatalog(data)
    expect(edited.getService("womens-salon", "full-body-wax")?.service.price).toBe(4600)
    expect(edited.getService("womens-salon", "brow-lamination")?.service.name).toBe("Brow lamination")
    expect(edited.getCategory("pest-control")).toBeUndefined()
    expect(edited.searchServices("lamination")[0]?.title).toBe("Brow lamination")
  })

  it("uses CMS synonyms, including Roman Urdu, and escapes regex characters", () => {
    expect(cat.searchServices("thanda nahi kar raha").some((r) => r.subtitle === "AC Services")).toBe(true)
    const custom = buildCatalog({ ...DEFAULT_CATALOG, synonyms: { "a.c (unit)": "ac" } })
    expect(() => custom.searchServices("a.c (unit) service")).not.toThrow()
  })
})

describe("roles", () => {
  it("only Owners and Admins change prices, settings and people", () => {
    for (const perm of ["prices", "settings", "users"] as const) {
      expect(can("owner", perm)).toBe(true)
      expect(can("admin", perm)).toBe(true)
      expect(can("editor", perm)).toBe(false)
      expect(can("author", perm)).toBe(false)
    }
  })
  it("Authors edit but can't publish; Viewers only view", () => {
    expect(can("author", "edit")).toBe(true)
    expect(can("author", "publish")).toBe(false)
    expect(ROLE_INFO.viewer.perms).toEqual(["view"])
    expect(can(null, "view")).toBe(false)
  })
})
