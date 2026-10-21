import { describe, expect, it } from "vitest"
import { layoutLocale, pageLocale } from "./locale"

// A missing file like /some-file.pdf skips proxy.ts (it ends in a file extension) and reaches the
// [locale] routes with locale "some-file.pdf". Pages must 404 then, not render the English home
// page with a 200; the root layout falls back to English so the 404 page has a layout.

const is404 = (e: unknown) => String((e as { digest?: string })?.digest ?? "").includes("404")

describe("pageLocale", () => {
  it("returns en and ur", async () => {
    expect(await pageLocale({ locale: "en" })).toBe("en")
    expect(await pageLocale(Promise.resolve({ locale: "ur" }))).toBe("ur")
  })

  it("is a 404 for anything else in the locale's place", async () => {
    for (const locale of ["some-file.pdf", "Mjazo_Website_Plan_v2.md", "EN", "fr"]) {
      const err = await pageLocale({ locale }).then(
        () => null,
        (e: unknown) => e,
      )
      expect(is404(err), locale).toBe(true)
    }
  })

  it("falls back to English when there's no locale param at all", async () => {
    expect(await pageLocale({})).toBe("en")
    expect(await pageLocale(undefined)).toBe("en")
  })
})

describe("layoutLocale", () => {
  it("falls back to English instead of a 404", async () => {
    expect(await layoutLocale({ locale: "some-file.pdf" })).toBe("en")
    expect(await layoutLocale({ locale: "ur" })).toBe("ur")
  })
})
