import { describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import { rankPros } from "./match"
import { VERIFICATION_ITEMS, type Job, type Pro } from "./types"

// Auto-assign's ranking: who qualifies, and who comes first.

const cat = buildCatalog(DEFAULT_CATALOG)
const DAY = "2099-03-02"
const done = Object.fromEntries(VERIFICATION_ITEMS.map((i) => [i.key, { by: "ops", at: "2099-01-01T00:00:00Z" }]))
const pro = (id: string, p: Partial<Pro> = {}): Pro => ({ id, name: id, phone: "03000000000", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: "", verification: done, ...p })
const job = (id: string, p: Partial<Job> = {}): Job => ({ id, createdAt: "", date: DAY, window: "3–5 pm", area: "dha", address: "x", customer: { name: "A", phone: "03001112223" }, items: [{ name: "Wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1, unitPrice: 4500 }], total: 4500, payment: "cash", status: "new", events: [], ...p })

describe("ranking pros for a visit", () => {
  it("leaves out pros who can't do it, aren't working then, are busy in that window, or are full", () => {
    const pros = [
      pro("P-OK"),
      pro("P-SKILL", { skills: ["ac-appliances"] }),
      pro("P-MAN", { women: false }),
      pro("P-OFF", { timeOff: [DAY] }),
      pro("P-AREA", { zones: ["clifton"], area: "clifton" }),
      pro("P-BUSY"),
      pro("P-FULL", { dailyCap: 1 }),
      pro("P-PAUSED", { status: "paused" }),
    ]
    const day = [job("MJ-B", { proId: "P-BUSY", status: "assigned" }), job("MJ-F", { proId: "P-FULL", status: "assigned", window: "9–11 am" })]
    expect(rankPros(job("MJ-1"), pros, day, cat).map((c) => c.proId)).toEqual(["P-OK"])
  })

  it("puts the pro the customer asked for first, then the shortest drive, then the lighter day", () => {
    const pros = [pro("P-NEAR"), pro("P-FAR", { area: "bahria" }), pro("P-ASKED", { area: "gulshan" })]
    expect(rankPros(job("MJ-1"), pros, [], cat).map((c) => c.proId)).toEqual(["P-NEAR", "P-ASKED", "P-FAR"])
    const asked = rankPros(job("MJ-1", { preferredProId: "P-ASKED" }), pros, [], cat)
    expect(asked[0]).toMatchObject({ proId: "P-ASKED", reasons: expect.arrayContaining(["asked for"]) })
    // A busier day counts against a pro (two equally close).
    const twins = [pro("P-A"), pro("P-B")]
    expect(rankPros(job("MJ-1"), twins, [job("MJ-X", { proId: "P-A", status: "assigned", window: "9–11 am" })], cat)[0].proId).toBe("P-B")
  })

  it("counts the drive from her visit just before, and skips pros who turned it down or aren't verified", () => {
    const pros = [pro("P-HOME-DHA"), pro("P-IN-CLIFTON", { area: "bahria" })]
    const day = [job("MJ-C", { proId: "P-IN-CLIFTON", status: "assigned", window: "1–3 pm", area: "dha" })]
    const r = rankPros(job("MJ-1"), pros, day, cat)
    expect(r.find((c) => c.proId === "P-IN-CLIFTON")!.reasons).toContain("15 min from her visit before")
    expect(rankPros(job("MJ-1"), pros, day, cat, { exclude: ["P-HOME-DHA"] }).map((c) => c.proId)).toEqual(["P-IN-CLIFTON"])
    expect(rankPros(job("MJ-1"), [pro("P-NEW", { verification: undefined })], [], cat, { verifiedOnly: true })).toEqual([])
    expect(rankPros(job("MJ-1"), [pro("P-NEW", { verification: undefined })], [], cat)[0].reasons).toContain("not verified")
  })
})
