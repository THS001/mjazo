import { describe, expect, it } from "vitest"
import { diffData, wordDiff } from "./diff"
import { docFrom, localizeObject } from "./fields"
import { getType } from "./registry"
import "./types"

// The history panel's "Compare": what changed between two versions, in the form's own words.

const service = getType("service")!
const base = localizeObject(service.fields, {
  name: "Full body waxing",
  slug: "full-body-wax",
  category: "womens-salon",
  short: "Arms, legs and back",
  price: 4500,
  duration: 120,
  popular: true,
  includes: ["Sealed kit", "Aftercare"],
  variants: [{ label: "Wax type", options: [{ label: "Regular", delta: 0 }] }],
  addOns: [],
}) as Record<string, unknown>

describe("diffData", () => {
  it("finds nothing between identical versions", () => {
    expect(diffData(service.fields, base, structuredClone(base))).toEqual([])
  })

  it("names changed fields as the form does, by language", () => {
    const next = structuredClone(base) as Record<string, any>
    next.name = { en: "Full body wax", ur: "مکمل جسم ویکس" }
    next.price = 5000
    next.popular = false
    const d = diffData(service.fields, base, next)
    expect(d).toContainEqual({ path: "name", label: "Name", lang: "en", kind: "changed", before: "Full body waxing", after: "Full body wax" })
    expect(d).toContainEqual({ path: "name", label: "Name", lang: "ur", kind: "added", before: undefined, after: "مکمل جسم ویکس" })
    expect(d).toContainEqual(expect.objectContaining({ label: "From price (PKR)", before: "PKR 4,500", after: "PKR 5,000" }))
    expect(d).toContainEqual(expect.objectContaining({ label: "Popular", before: "On", after: "Off" }))
  })

  it("follows lists and groups, and reports added and removed items", () => {
    const next = structuredClone(base) as Record<string, any>
    next.includes.push({ en: "Free redo" })
    next.variants[0].options[0].label = { en: "Rica" }
    const d = diffData(service.fields, base, next)
    expect(d).toContainEqual(expect.objectContaining({ label: "What's included › #3", kind: "added", after: "Free redo" }))
    expect(d).toContainEqual(expect.objectContaining({ label: "Options › #1 › Choices › #1 › Label", before: "Regular", after: "Rica" }))
  })

  it("matches blocks by key: an edit, a new block, a removed one and a new order", () => {
    const page = getType("block-page")!
    const a = localizeObject(page.fields, {
      title: "Eid",
      path: "/eid",
      blocks: [
        { _type: "hero", _key: "h", title: "Eid glow", tone: "light", center: false, buttons: [] },
        { _type: "text", _key: "t", title: "", width: "narrow", tone: "light", body: docFrom([{ p: "Old words here." }]) },
        { _type: "spacer", _key: "s", size: "md", line: false },
      ],
    }) as Record<string, any>
    const b = structuredClone(a)
    b.blocks = [b.blocks[1], b.blocks[0], { _type: "cta", _key: "c", title: { en: "Book now" }, tone: "dark", buttons: [] }]
    b.blocks[0].body.en = docFrom([{ p: "New words here." }])
    const d = diffData(page.fields, a, b)
    expect(d).toContainEqual(expect.objectContaining({ label: "Blocks › Text #1 › Text", lang: "en", before: "Old words here.", after: "New words here." }))
    expect(d).toContainEqual(expect.objectContaining({ label: "Blocks › Call to action #3", kind: "added", after: "Book now" }))
    expect(d).toContainEqual(expect.objectContaining({ label: "Blocks › Spacer #3", kind: "removed" }))
    expect(d).toContainEqual(expect.objectContaining({ label: "Blocks › order", before: "Hero, Text, Spacer", after: "Text, Hero, Call to action" }))
  })
})

describe("wordDiff", () => {
  it("marks the words that went and came", () => {
    expect(wordDiff("Book waxing at home today", "Book threading at home now")).toEqual([
      { text: "Book ", kind: "same" },
      { text: "waxing", kind: "del" },
      { text: "threading", kind: "ins" },
      { text: " at home ", kind: "same" },
      { text: "today", kind: "del" },
      { text: "now", kind: "ins" },
    ])
    expect(wordDiff("", "New")).toEqual([{ text: "New", kind: "ins" }])
  })
})
