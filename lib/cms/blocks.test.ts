import fs from "fs"
import path from "path"
import { describe, expect, it, vi } from "vitest"
import { coverage, emptyObject, hydrateMedia, localizeObject, resolveObject, zodObject, type BlocksField, type MediaInfo } from "./fields"
import { fieldPermError, onlySeoChanged } from "./field-perms"
import { apply, collect } from "./translate"
import { PATH_PATTERN, pathProblems, pathToId, SITE_SECTIONS } from "./block-paths"
import { getType } from "./registry"
import "./types"

// The page builder's "blocks" field through every layer (validation, storage shape, the site's
// shape, media, translation, permissions), and the rules for block page addresses.

vi.mock("next/cache", () => ({ updateTag: () => {}, revalidateTag: () => {}, unstable_cache: (fn: () => unknown) => fn }))

const t = getType("block-page")!
const page = {
  title: "Eid sale",
  path: "/eid-sale",
  description: "Eid offers on salon at home.",
  blocks: [
    { _type: "hero", _key: "a1", title: "Eid *glow*", sub: "At home", tone: "light", center: false, buttons: [{ label: "Book", href: "/services" }] },
    { _type: "cards", _key: "b2", title: "Why us", columns: "3", tone: "light", items: [{ icon: "Wallet", title: "All-in prices", body: "No surprises", href: "" }] },
    { _type: "gallery", _key: "c3", columns: "2", images: [{ id: "m1", url: "/old.jpg" }] },
  ],
}
const stored = () => localizeObject(t.fields, structuredClone(page) as Record<string, unknown>)

describe("blocks field", () => {
  it("stores block text in the localised shape and keeps each block's kind and key", () => {
    const s = stored() as { blocks: Record<string, unknown>[] }
    expect(s.blocks[0]).toMatchObject({ _type: "hero", _key: "a1", title: { en: "Eid *glow*" }, buttons: [{ label: { en: "Book" }, href: "/services" }] })
    expect(s.blocks[1]).toMatchObject({ _type: "cards", items: [{ title: { en: "All-in prices" }, icon: "Wallet" }] })
    expect(zodObject(t.fields).safeParse(s).success).toBe(true)
  })

  it("rejects an unknown block kind, a missing key and a missing required field", () => {
    const bad = (blocks: unknown[]) => zodObject(t.fields).safeParse({ ...stored(), blocks }).success
    expect(bad([{ _type: "marquee", _key: "x", title: { en: "?" } }])).toBe(false)
    expect(bad([{ _type: "spacer", size: "md", line: false }])).toBe(false)
    expect(bad([{ _type: "hero", _key: "x" }])).toBe(false)
    expect(bad([{ _type: "spacer", _key: "x", size: "md", line: true }])).toBe(true)
  })

  it("gives the site one language, with tokens filled in, and skips kinds it can't render", () => {
    const s = stored() as { blocks: Record<string, unknown>[] }
    ;(s.blocks[0].title as Record<string, string>).ur = "عید *چمک*"
    s.blocks.push({ _type: "retired-kind", _key: "z9", title: { en: "Old" } })
    ;(s.blocks[0].sub as Record<string, string>).en = "{{site.city}} at home"
    const ur = resolveObject(t.fields, s, "ur", { site: { city: "Karachi" } }) as { blocks: Record<string, unknown>[] }
    expect(ur.blocks.map((b) => b._type)).toEqual(["hero", "cards", "gallery"])
    expect(ur.blocks[0]).toMatchObject({ _key: "a1", title: "عید *چمک*", sub: "Karachi at home", buttons: [{ label: "Book" }] })
  })

  it("looks up images inside blocks in the media library", () => {
    const media: Record<string, MediaInfo> = { m1: { url: "/new.jpg", mime: "image/jpeg", width: 800, height: 600, alt: { en: "A pro at work" }, focal: null, color: null } }
    const site = resolveObject(t.fields, stored(), "en") as Record<string, unknown>
    const out = hydrateMedia(t.fields, site, media, "en") as { blocks: { images?: { url: string; alt: string }[] }[] }
    expect(out.blocks[2].images).toEqual([expect.objectContaining({ url: "/new.jpg", alt: "A pro at work", w: 800 })])
  })

  it("counts, collects and writes back the Urdu of every block", () => {
    const s = stored()
    const cov = coverage(t.fields, s)
    expect(cov).toMatchObject({ done: 0 })
    expect(cov.total).toBeGreaterThanOrEqual(8)
    const items = collect(t.fields, s, "missing")
    expect(items.map((i) => i.path.join("."))).toContain("blocks.1.items.0.title")
    const next = apply(s, items, items.map((i) => `ur:${i.text}`)) as { blocks: Record<string, Record<string, unknown>>[] }
    expect(next.blocks[0].title).toEqual({ en: "Eid *glow*", ur: "ur:Eid *glow*", ai: true })
    expect(coverage(t.fields, next).done).toBe(cov.total)
  })

  it("keeps the SEO role away from blocks, and Editors free to change them", () => {
    const before = stored()
    const after = structuredClone(before) as { blocks: Record<string, unknown>[] }
    after.blocks.reverse()
    expect(onlySeoChanged(t.fields, before, after)).toBe(false)
    expect(fieldPermError(t.fields, "seo", before, after)).toBe("Your role can change SEO fields only.")
    expect(fieldPermError(t.fields, "editor", before, after)).toBeNull()
  })

  it("starts every kind of block with content that validates and renders", () => {
    const fd = t.fields.blocks as BlocksField
    const blocks = Object.entries(fd.blocks).map(([type, def], i) => ({ ...emptyObject(def.fields), ...localizeObject(def.fields, structuredClone(def.starter ?? {})), _type: type, _key: `k${i}` }))
    const parsed = zodObject(t.fields).safeParse({ ...stored(), blocks })
    expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([])
    const site = resolveObject(t.fields, { ...stored(), blocks }, "en", { policy: { redoHours: 24 }, catalog: { areaCount: 8, serviceCount: 132 } }) as { blocks: Record<string, unknown>[] }
    expect(site.blocks).toHaveLength(Object.keys(fd.blocks).length)
    expect(site.blocks.find((b) => b._type === "promises")?.items).toContain("Free redo within 24 hours")
    expect(site.blocks.find((b) => b._type === "stats")?.items).toContainEqual({ value: "8", label: "Karachi areas" })
  })

  it("reads an empty Urdu document saved without its content list as empty, not invalid", () => {
    const s = stored() as { blocks: Record<string, unknown>[] }
    s.blocks.push({ _type: "text", _key: "t1", title: { en: "" }, width: "narrow", tone: "light", body: { en: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] }, ur: { type: "doc" }, ai: false } })
    expect(zodObject(t.fields).safeParse(s).success).toBe(true)
    const ur = resolveObject(t.fields, s, "ur") as { blocks: { body?: { content: unknown[] } }[] }
    expect(ur.blocks.at(-1)?.body?.content).toHaveLength(1)
    expect(coverage(t.fields, { blocks: [s.blocks.at(-1)] }).done).toBe(0)
  })

  it("names the block in validation messages", async () => {
    const { validate } = await import("./write")
    const s = stored() as { blocks: Record<string, unknown>[] }
    s.blocks[1] = { ...s.blocks[1], columns: "7" }
    expect(() => validate(t as never, s)).toThrow(/Blocks › Cards #2 › Columns/)
  }, 30_000)
})

describe("block page addresses", () => {
  it("lists every section of the site as taken", () => {
    const dirs = fs
      .readdirSync(path.join(process.cwd(), "app", "[locale]"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("("))
      .map((d) => d.name)
    expect([...SITE_SECTIONS].sort()).toEqual(dirs.sort())
  })

  it("accepts free addresses and refuses taken ones or bad formats", () => {
    const ok = new RegExp(PATH_PATTERN)
    for (const p of ["/eid-sale", "/campaigns/eid-sale", "/lp/ac/summer-2026", "/a1"]) expect(ok.test(p) && pathProblems(p).length === 0).toBe(true)
    for (const p of ["eid", "/Eid", "/eid sale", "/eid--sale", "/eid/", "/a/b/c/d/e", "/-eid"]) expect(ok.test(p)).toBe(false)
    expect(pathProblems("/services/eid")[0]).toMatch(/\/services is already part of the site/)
    for (const p of ["/admin/x", "/ur/eid", "/api", "/blog"]) expect(pathProblems(p)).toHaveLength(1)
  })

  it("turns an address into an id that can't clash", () => {
    expect(pathToId("/campaigns/eid-sale")).toBe("campaigns--eid-sale")
    expect(pathToId("/campaigns-eid/sale")).toBe("campaigns-eid--sale")
    expect(pathToId("bad")).toBe("")
  })

  it("rejects a reserved address through the type's own check", async () => {
    const { validate } = await import("./write")
    expect(() => validate(t as never, { ...stored(), path: "/karachi/eid" })).toThrow(/\/karachi is already part of the site/)
  }, 30_000)
})
