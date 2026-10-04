import { describe, expect, it, vi } from "vitest"
import { f, approveAll, docFrom } from "./fields"

vi.mock("@/lib/ai/anthropic", () => ({ aiEnabled: () => false, MODELS: { concierge: "x" } }))
vi.mock("@/lib/ai/structured", () => ({ structured: async () => null }))
vi.mock("./action", () => ({ ValidationError: class extends Error {} }))

const fields = {
  title: f.text("Title"),
  slug: f.code("Slug"),
  ai: f.group("AI section", { title: f.text("Title") }),
  faq: f.list("FAQ", f.group("Q", { q: f.text("Q"), a: f.textarea("A") })),
  body: f.richText("Body"),
}

describe("Urdu translation plumbing", () => {
  const data = {
    title: { en: "Hello {{site.name}}", ur: "" },
    slug: "hello",
    ai: { title: { en: "Ask Mjazo", ur: "مجازو سے پوچھیں" } },
    faq: [{ q: { en: "How?" }, a: { en: "Like this." } }],
    body: { en: docFrom([{ h: "Heading", p: "First.\n\nSecond." }]) },
  }

  it("collects only localised English that has no Urdu (or everything in 'all' mode)", async () => {
    const { collect } = await import("./translate")
    const missing = collect(fields, data, "missing").map((x) => x.text)
    expect(missing).toEqual(["Hello {{site.name}}", "How?", "Like this.", "Heading", "First.", "Second."])
    expect(collect(fields, data, "all").map((x) => x.text)).toContain("Ask Mjazo")
  })

  it("writes Urdu back, flags it as AI, and builds the Urdu rich-text document", async () => {
    const { collect, apply } = await import("./translate")
    const items = collect(fields, data, "missing")
    const out = apply(data, items, ["ہیلو {{site.name}}", "کیسے؟", "ایسے۔", "سرخی", "پہلا۔", "دوسرا۔"]) as typeof data & { body: { ur: { content: { content: { text: string }[] }[] }; ai: boolean } }
    expect(out.title).toEqual({ en: "Hello {{site.name}}", ur: "ہیلو {{site.name}}", ai: true })
    expect(out.slug).toBe("hello")
    expect(out.body.ai).toBe(true)
    expect(out.body.ur.content.map((n) => n.content[0].text)).toEqual(["سرخی", "پہلا۔", "دوسرا۔"])
    expect((data.body.en.content[0].content![0] as { text: string }).text).toBe("Heading") // English untouched
  })

  it("approves AI Urdu without touching a section that happens to be called 'ai'", () => {
    const out = approveAll({ ai: { title: { en: "x", ur: "y", ai: true } } }) as { ai: { title: Record<string, unknown> } }
    expect(out.ai.title).toEqual({ en: "x", ur: "y" })
  })
})
