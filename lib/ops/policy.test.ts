import { describe, expect, it } from "vitest"
import { DEFAULT_TAX, taxAmount, taxPct, taxProblems, taxTermsOn, totalWithTax } from "./policy"

// The money policies' pure rules: sales tax terms by day, and the tax inside or on top of the
// price, on the whole booking or on Mjazo's share.

describe("sales tax", () => {
  const on = { ...DEFAULT_TAX, from: "2026-11-01", rate: 0.08 }

  it("applies only to bookings made from its start day, with a rate", () => {
    expect(taxTermsOn(DEFAULT_TAX, "2026-11-05")).toBeNull()
    expect(taxTermsOn(on, "2026-10-31")).toBeNull()
    expect(taxTermsOn(on, "2026-11-01")).toEqual({ rate: 0.08, inclusive: true, base: "total" })
    expect(taxTermsOn({ ...on, rate: 0 }, "2026-11-05")).toBeNull()
    // On Mjazo's share only, it's always inside the price.
    expect(taxTermsOn({ ...on, inclusive: false, base: "commission" }, "2026-11-05")).toEqual({ rate: 0.08, inclusive: true, base: "commission" })
  })

  it("works out the tax inside the price or on top, after discounts", () => {
    const inside = { rate: 0.08, inclusive: true, base: "total" } as const
    const onTop = { ...inside, inclusive: false }
    expect(taxAmount(inside, { subtotal: 3700, discount: 0 })).toBe(274) // the analysis's 8% row
    expect(taxAmount(inside, { subtotal: 4000, discount: 400 })).toBe(267)
    expect(taxAmount(onTop, { subtotal: 4000, discount: 400 })).toBe(288)
    expect(totalWithTax(4000, 400, onTop, 288)).toBe(3888)
    expect(totalWithTax(4000, 400, inside, 267)).toBe(3600)
    expect(totalWithTax(4000, 400, null, 0)).toBe(3600)
  })

  it("on Mjazo's share: its share less the discount it funds, the usual 25% until a pro does it", () => {
    const fee = { rate: 0.08, inclusive: true, base: "commission" } as const
    expect(taxAmount(fee, { subtotal: 4000, discount: 0 })).toBe(74) // 1,000 × 8/108
    expect(taxAmount(fee, { subtotal: 4000, discount: 400, commission: 800 })).toBe(30)
    expect(taxAmount(fee, { subtotal: 4000, discount: 900, commission: 800 })).toBe(0)
  })

  it("checks what Finance types", () => {
    expect(taxProblems({ rate: 0.08, from: "2026-11-01", registration: "S1234567-8" })).toEqual([])
    expect(taxProblems({ rate: 0.3 })).toHaveLength(1)
    expect(taxProblems({ rate: 0.08123 })).toHaveLength(1)
    expect(taxProblems({ rate: 7 / 100 })).toEqual([]) // 0.07000000000000001
    expect(taxProblems({ from: "1 Nov" })).toHaveLength(1)
    expect(taxPct(0.08)).toBe("8")
    expect(taxPct(0.075)).toBe("7.5")
    expect(taxPct(0.0725)).toBe("7.25")
  })
})
