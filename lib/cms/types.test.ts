import { describe, expect, it } from "vitest"
import { localizeObject, zodObject, type Fields } from "./fields"
import { allTypes } from "./registry"
import "./types"

// Every content type's built-in content must fit its own field definitions: otherwise the admin
// shows empty fields for text the site renders, or the site silently drops a saved entry.

/** Keys present on one side only, as dotted paths (lists are checked item by item). */
function keyDiff(fields: Fields, value: Record<string, unknown>, at = ""): string[] {
  const out: string[] = []
  for (const k of Object.keys(value)) if (!(k in fields)) out.push(`${at}${k} (no field)`)
  for (const [k, fd] of Object.entries(fields)) {
    const v = value[k]
    if (v === undefined) {
      if (fd.required) out.push(`${at}${k} (no default)`)
      continue
    }
    if (fd.kind === "group") out.push(...keyDiff(fd.fields, v as Record<string, unknown>, `${at}${k}.`))
    if (fd.kind === "list" && fd.of.kind === "group") {
      const of = fd.of
      ;(v as Record<string, unknown>[]).forEach((item, i) => out.push(...keyDiff(of.fields, item, `${at}${k}[${i}].`)))
    }
  }
  return out
}

describe("content types", () => {
  const types = allTypes()

  it("registers the pages, catalogue, editorial and navigation types", () => {
    const ids = types.map((t) => t.type)
    for (const id of ["page-home", "page-services", "page-world", "page-category", "page-service", "page-karachi", "page-area", "page-weddings", "page-ghar-scan", "nav"]) expect(ids).toContain(id)
  })

  for (const t of types) {
    it(`${t.type}: built-in content validates and every field has a default`, () => {
      const items = t.kind === "collection" ? (t.defaults() as unknown[]) : [t.defaults()]
      // Types whose items are only made in the admin (block pages) ship none.
      if (!t.newId) expect(items.length).toBeGreaterThan(0)
      for (const item of items) {
        const cms = (t.toCms ? t.toCms(item) : item) as Record<string, unknown>
        const parsed = zodObject(t.fields).safeParse(localizeObject(t.fields, cms))
        expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([])
        if (t.kind === "singleton") expect(keyDiff(t.fields, cms)).toEqual([])
      }
    })
  }
})
