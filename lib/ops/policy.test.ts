import { describe, expect, it } from "vitest"
import { DEFAULT_GUARANTEE, DEFAULT_PAIR_RATE, DEFAULT_TAX, guaranteeProblems, keepPct, standsIn, pairRateProblems, taxAmount, taxPct, taxProblems, taxTermsOn, totalWithTax, visitRate } from "./policy"

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

describe("the regular customer rate", () => {
  it("lowers Mjazo's share from the customer's 2nd visit with the same pro, never above her own rate", () => {
    expect(visitRate(0.25, 0, DEFAULT_PAIR_RATE)).toEqual({ rate: 0.25, regular: false })
    expect(visitRate(0.25, 1, DEFAULT_PAIR_RATE)).toEqual({ rate: 0.15, regular: true })
    expect(visitRate(0.25, 7, DEFAULT_PAIR_RATE)).toEqual({ rate: 0.15, regular: true })
    // Her own rate is already lower: it stays, and it isn't a "regular customer" rate.
    expect(visitRate(0.1, 3, DEFAULT_PAIR_RATE)).toEqual({ rate: 0.1, regular: false })
    expect(visitRate(0.25, 3, { ...DEFAULT_PAIR_RATE, on: false })).toEqual({ rate: 0.25, regular: false })
    expect(visitRate(0.25, 1, { ...DEFAULT_PAIR_RATE, fromVisit: 3 }).regular).toBe(false)
    expect(visitRate(0.25, 2, { ...DEFAULT_PAIR_RATE, fromVisit: 3 }).regular).toBe(true)
    expect(keepPct(0.15)).toBe(85)
    expect(keepPct(0.125)).toBe(87.5)
  })

  it("refuses values out of range", () => {
    expect(pairRateProblems(DEFAULT_PAIR_RATE)).toEqual([])
    expect(pairRateProblems({ rate: 0.6 })).toHaveLength(1)
    expect(pairRateProblems({ fromVisit: 1 })).toHaveLength(1)
    expect(pairRateProblems({ fromVisit: 2.5 })).toHaveLength(1)
    expect(pairRateProblems({ days: 10 })).toHaveLength(1)
  })
})

describe("the favourite-pro guarantee", () => {
  it("lets a pro stand in only when she's rated well enough on enough visits", () => {
    expect(standsIn({ stars: 4.8, count: 5 }, DEFAULT_GUARANTEE)).toBe(true)
    expect(standsIn({ stars: 4.5, count: 3 }, DEFAULT_GUARANTEE)).toBe(true)
    expect(standsIn({ stars: 4.4, count: 30 }, DEFAULT_GUARANTEE)).toBe(false)
    expect(standsIn({ stars: 5, count: 2 }, DEFAULT_GUARANTEE)).toBe(false)
    expect(standsIn(undefined, DEFAULT_GUARANTEE)).toBe(false)
    expect(standsIn(undefined, { minStars: 4.5, minRatings: 0 })).toBe(false)
  })

  it("starts with the credit off, and refuses values out of range", () => {
    expect(DEFAULT_GUARANTEE).toMatchObject({ on: true, creditOn: false, credit: 500 })
    expect(guaranteeProblems(DEFAULT_GUARANTEE)).toEqual([])
    expect(guaranteeProblems({ minStars: 2.5 })).toHaveLength(1)
    expect(guaranteeProblems({ minStars: 4.55 })).toHaveLength(1)
    expect(guaranteeProblems({ minRatings: -1 })).toHaveLength(1)
    expect(guaranteeProblems({ credit: 2500 })).toHaveLength(1)
  })
})
