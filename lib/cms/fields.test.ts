import { describe, expect, it } from "vitest"
import { coverage, f, localizeObject, renderTokens, resolveObject, zodObject, type Fields } from "./fields"

const fields: Fields = {
  name: f.text("Name", { required: true }),
  slug: f.slug(),
  price: f.price("Price"),
  phone: f.code("Phone"),
  tags: f.list("Tags", f.text("Tag")),
  faqs: f.list("FAQs", f.group("FAQ", { q: f.text("Q"), a: f.textarea("A") })),
  popular: f.boolean("Popular"),
}

describe("localise and resolve", () => {
  const plain = { name: "Full body wax", slug: "full-body-wax", price: 4500, phone: "+92 300", tags: ["Soft", "Quick"], faqs: [{ q: "Safe?", a: "Yes" }] }
  const stored = localizeObject(fields, plain)

  it("wraps translatable text as { en } and leaves codes, numbers and slugs alone", () => {
    expect(stored).toMatchObject({ name: { en: "Full body wax" }, slug: "full-body-wax", price: 4500, phone: "+92 300", tags: [{ en: "Soft" }, { en: "Quick" }], faqs: [{ q: { en: "Safe?" }, a: { en: "Yes" } }] })
  })

  it("round-trips back to the site's shape in English", () => {
    expect(resolveObject(fields, stored, "en")).toEqual(plain)
  })

  it("uses Urdu when present and falls back to English when it isn't", () => {
    const withUr = { ...stored, name: { en: "Full body wax", ur: "مکمل ویکس" } }
    const r = resolveObject(fields, withUr, "ur") as typeof plain
    expect(r.name).toBe("مکمل ویکس")
    expect(r.tags).toEqual(["Soft", "Quick"])
  })

  it("is idempotent on already-stored values", () => {
    expect(localizeObject(fields, stored)).toEqual(stored)
  })
})

describe("validation", () => {
  const schema = zodObject(fields)
  it("accepts a valid entry, with optional lists and switches missing", () => {
    expect(schema.safeParse({ name: { en: "X" }, slug: "x", price: 100 }).success).toBe(true)
  })
  it("rejects a bad slug and a missing required field", () => {
    expect(schema.safeParse({ name: { en: "X" }, slug: "Bad Slug" }).success).toBe(false)
    expect(schema.safeParse({ slug: "x" }).success).toBe(false)
  })
  it("rejects a price that isn't a number", () => {
    expect(schema.safeParse({ name: { en: "X" }, price: "4500" }).success).toBe(false)
  })
})

describe("tokens", () => {
  const ctx = { policy: { freeChangeHours: 3 }, site: { phone: "+92 300 1234567" } }
  it("fills known tokens and keeps unknown ones visible", () => {
    expect(renderTokens("Free up to {{policy.freeChangeHours}} hours. Call {{ site.phone }}.", ctx)).toBe("Free up to 3 hours. Call +92 300 1234567.")
    expect(renderTokens("{{policy.nope}}", ctx)).toBe("{{policy.nope}}")
  })
  it("applies inside resolved text", () => {
    const r = resolveObject({ t: f.text("T") }, { t: { en: "Within {{policy.freeChangeHours}} hrs" } }, "en", ctx)
    expect(r.t).toBe("Within 3 hrs")
  })
})

describe("translation coverage", () => {
  it("counts translatable values, Urdu ones and machine-translated ones", () => {
    const c = coverage(fields, { name: { en: "A", ur: "ا", ai: true }, tags: [{ en: "x" }, { en: "y", ur: "ی" }], faqs: [{ q: { en: "q" }, a: { en: "" } }] })
    expect(c).toEqual({ total: 4, done: 2, ai: 1 })
  })
})
