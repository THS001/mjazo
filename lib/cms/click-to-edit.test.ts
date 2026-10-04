import { describe, expect, it } from "vitest"
import { findField, matchScore, textLeaves } from "./click-to-edit"
import { docFrom, localizeObject } from "./fields"
import { getType } from "./registry"
import "./types"

// Clicking text in the live preview opens the field that holds it.

const blocks = getType("block-page")!.fields
const page = localizeObject(blocks, {
  title: "Eid sale",
  path: "/eid-sale",
  blocks: [
    { _type: "hero", _key: "a", title: "Eid *glow* at home", sub: "Free redo within {{policy.redoHours}} hours", tone: "light", center: false, buttons: [{ label: "Book now", href: "/services" }] },
    { _type: "cards", _key: "b", title: "Why us", columns: "3", tone: "light", items: [{ icon: "Wallet", title: "All-in prices", body: "No surprises at the door." }, { icon: "BadgeCheck", title: "Pay after", body: "Cash or wallet." }] },
    { _type: "text", _key: "c", title: "", width: "narrow", tone: "light", body: docFrom([{ p: "First paragraph about Eid.\n\nSecond paragraph about kits." }]) },
  ],
}) as Record<string, unknown>
;((page.blocks as Record<string, Record<string, string>>[])[0].title as unknown as Record<string, string>).ur = "گھر پر عید کی *چمک*"

describe("click-to-edit", () => {
  it("lists every editable text with its path, in the preview's language", () => {
    const en = textLeaves(blocks, page, "en")
    expect(en).toContainEqual({ path: "blocks.1.items.0.title", text: "All-in prices" })
    expect(en).toContainEqual({ path: "blocks.0.buttons.0.label", text: "Book now" })
    expect(textLeaves(blocks, page, "ur").find((l) => l.path === "blocks.0.title")?.text).toBe("گھر پر عید کی *چمک*")
    // No Urdu yet: the page shows English, so that's what to match.
    expect(textLeaves(blocks, page, "ur").find((l) => l.path === "blocks.0.sub")?.text).toBe("Free redo within {{policy.redoHours}} hours")
  })

  it("matches text as the page shows it: accents gone, tokens filled in, any spacing", () => {
    expect(matchScore("Eid *glow* at home", "Eid glow at home")).toBe(100)
    expect(matchScore("Free redo within {{policy.redoHours}} hours", "Free redo within 24 hours")).toBe(100)
    expect(matchScore("All-in prices", "All-in  prices\n")).toBe(100)
    expect(matchScore("All-in prices", "Pay after")).toBe(0)
  })

  it("prefers the field a data-cms path names, then the best match inside that block", () => {
    expect(findField(blocks, page, { path: "blocks.1.items.0.title", text: "anything" })).toBe("blocks.1.items.0.title")
    expect(findField(blocks, page, { path: "blocks.1.items.1", text: "Pay after" })).toBe("blocks.1.items.1.title")
    expect(findField(blocks, page, { path: "blocks.1", text: "No surprises at the door." })).toBe("blocks.1.items.0.body")
    expect(findField(blocks, page, { path: "blocks.0", text: "Free redo within 24 hours" })).toBe("blocks.0.sub")
  })

  it("finds one paragraph of a text block, and text on pages without markers", () => {
    expect(findField(blocks, page, { path: "blocks.2", text: "Second paragraph about kits." })).toBe("blocks.2.body")
    expect(findField(blocks, page, { text: "Book now" })).toBe("blocks.0.buttons.0.label")
    expect(findField(blocks, page, { text: "گھر پر عید کی چمک" }, "ur")).toBe("blocks.0.title")
  })

  it("falls back to the block, or nothing, when no text matches", () => {
    expect(findField(blocks, page, { path: "blocks.1", text: "Something else entirely" })).toBe("blocks.1")
    expect(findField(blocks, page, { text: "Something else entirely" })).toBeNull()
  })

  it("works on designed pages too", () => {
    const about = getType("page-about")!
    const data = localizeObject(about.fields, about.defaults() as Record<string, unknown>)
    const leaves = textLeaves(about.fields, data, "en")
    const one = leaves.find((l) => l.text.length > 20 && !l.text.includes("{{"))!
    expect(findField(about.fields, data, { text: one.text.replace(/\*/g, "") })).toBe(one.path)
  })
})
