import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Db } from "./db"
import { testCore } from "./test-db"
import { createBooking, getJob, mutateJob, savePro } from "./jobs"
import { answerOffer, expireOffers, listOffers, offerExpiry, offerJob, withdrawOffers } from "./offers"
import { setProProfile } from "./pros"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"

// Job offers: one open offer per visit, accept → hers, decline → still unassigned with her reason,
// expiry (two hours, and an hour before the window), and the checks that stop a pro taking a
// visit she can't do (a day off, the same window, a full day).

let db: Db & { close(): Promise<void> }
const cat = buildCatalog(DEFAULT_CATALOG)
const DAY = "2099-01-05"
const NOW = new Date("2099-01-05T06:00:00+05:00") // 6 am on the day
let n = 0

const pro = (id: string, name: string, phone: string) => savePro(db, { id, name, phone, area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
async function visit(window = "3–5 pm", day = DAY) {
  n++
  const j = await createBooking(db, { id: `MJ-OF${n}`, name: "Ayesha Khan", phone: `0300123${String(n).padStart(4, "0")}`, area: "dha", address: `House ${n}, Street 4`, date: day, window, payment: "cash", items: [{ name: "x", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1 }] }, cat)
  return j.id
}
const events = async (type: string) => (await db.query<{ type: string }>("select type from events where type = $1", [type])).length

beforeAll(async () => {
  db = await testCore()
  await pro("P-1", "Sana", "03111111111")
  await pro("P-2", "Hina", "03122222222")
}, 60_000)
afterAll(() => db?.close())

describe("when an offer closes", () => {
  it("is two hours after it's made, but never later than an hour before the window", () => {
    expect(offerExpiry(NOW, DAY, "3–5 pm")!.toISOString()).toBe(new Date("2099-01-05T08:00:00+05:00").toISOString())
    expect(offerExpiry(NOW, DAY, "9–11 am")!.toISOString()).toBe(new Date("2099-01-05T08:00:00+05:00").toISOString())
    expect(offerExpiry(new Date("2099-01-05T07:30:00+05:00"), DAY, "9–11 am")!.toISOString()).toBe(new Date("2099-01-05T08:00:00+05:00").toISOString())
  })
  it("can't be made when the visit is too close", () => {
    expect(offerExpiry(new Date("2099-01-05T07:55:00+05:00"), DAY, "9–11 am")).toBeNull()
    expect(offerExpiry(new Date("2099-01-05T10:00:00+05:00"), DAY, "9–11 am")).toBeNull()
  })
})

describe("offering a visit", () => {
  it("keeps one open offer per visit: offering it to someone else withdraws the first", async () => {
    const id = await visit()
    const a = await offerJob(db, { bookingId: id, proId: "P-1", by: "ops@mjazo.test", now: NOW })
    expect(a).toMatchObject({ status: "pending", proId: "P-1", offeredBy: "ops@mjazo.test" })
    await expect(offerJob(db, { bookingId: id, proId: "P-1", by: "ops@mjazo.test", now: NOW })).rejects.toThrow(/already offered/)
    const b = await offerJob(db, { bookingId: id, proId: "P-2", by: "ops@mjazo.test", now: NOW })
    const all = await listOffers(db, { bookingIds: [id] })
    expect(all.map((o) => [o.id, o.status])).toEqual(expect.arrayContaining([[a.id, "withdrawn"], [b.id, "pending"]]))
    expect((await getJob(db, id))!.events.at(-1)!.note).toMatch(/^Offered to Hina \(open until/)
    expect(await events("offer.made")).toBeGreaterThanOrEqual(2)
  })

  it("only offers an unassigned visit", async () => {
    const id = await visit()
    await mutateJob(db, id, (j) => Object.assign(j, { proId: "P-1", status: "assigned" }))
    await expect(offerJob(db, { bookingId: id, proId: "P-2", by: "ops", now: NOW })).rejects.toThrow(/Only an unassigned visit/)
    await expect(offerJob(db, { bookingId: "MJ-NONE", proId: "P-2", by: "ops", now: NOW })).rejects.toThrow(/not found/)
  })

  it("won't offer a visit she can't take: a visit in the same window, or a day off", async () => {
    const busy = await visit("11 am–1 pm")
    await mutateJob(db, busy, (j) => Object.assign(j, { proId: "P-2", status: "assigned" }))
    const clash = await visit("11 am–1 pm")
    await expect(offerJob(db, { bookingId: clash, proId: "P-2", by: "ops", now: NOW })).rejects.toThrow("Hina already has a visit in that window")
    await setProProfile(db, "P-2", { timeOff: { add: ["2099-01-06"] } }, ["dha"])
    const off = await visit("3–5 pm", "2099-01-06")
    await expect(offerJob(db, { bookingId: off, proId: "P-2", by: "ops", now: NOW })).rejects.toThrow("Hina has that day off")
  })
})

describe("answering an offer", () => {
  it("accepting makes the visit hers", async () => {
    const id = await visit("5–7 pm")
    const o = await offerJob(db, { bookingId: id, proId: "P-1", by: "ops", now: NOW })
    const r = await answerOffer(db, { offerId: o.id, proId: "P-1", accept: true, now: NOW })
    expect(r.status).toBe("accepted")
    const j = (await getJob(db, id))!
    expect(j).toMatchObject({ proId: "P-1", status: "assigned" })
    expect(j.events.at(-1)).toMatchObject({ type: "assigned", by: "pro", actor: "P-1" })
    expect(await events("offer.accepted")).toBe(1)
    expect(await events("booking.assigned")).toBeGreaterThanOrEqual(1)
    const audit = await db.one<{ actor: string; action: string }>("select actor, action from audit_log where target = $1 order by id desc limit 1", [id])
    expect(audit).toEqual({ actor: "pro:P-1", action: "accepted a visit" })
    await expect(answerOffer(db, { offerId: o.id, proId: "P-1", accept: true, now: NOW })).rejects.toThrow(/already accepted/)
  })

  it("declining leaves it unassigned, with her reason on the timeline", async () => {
    const id = await visit("7–9 pm")
    const o = await offerJob(db, { bookingId: id, proId: "P-1", by: "ops", now: NOW })
    const r = await answerOffer(db, { offerId: o.id, proId: "P-1", accept: false, reason: "Too far tonight", now: NOW })
    expect(r).toMatchObject({ status: "declined", reason: "Too far tonight" })
    const j = (await getJob(db, id))!
    expect(j.status).toBe("new")
    expect(j.proId).toBeUndefined()
    expect(j.events.at(-1)).toMatchObject({ type: "note", by: "pro", note: "Sana declined the offer: Too far tonight" })
  })

  it("only she can answer her offer", async () => {
    const id = await visit("9–11 am", "2099-01-07")
    const o = await offerJob(db, { bookingId: id, proId: "P-1", by: "ops", now: NOW })
    await expect(answerOffer(db, { offerId: o.id, proId: "P-2", accept: true, now: NOW })).rejects.toThrow("Offer not found")
  })

  it("comes back expired once its time is up (and stays closed)", async () => {
    const id = await visit("1–3 pm", "2099-01-07")
    const o = await offerJob(db, { bookingId: id, proId: "P-1", by: "ops", now: NOW })
    const late = new Date(NOW.getTime() + 3 * 3600_000)
    expect((await answerOffer(db, { offerId: o.id, proId: "P-1", accept: true, now: late })).status).toBe("expired")
    expect((await listOffers(db, { bookingIds: [id] }))[0].status).toBe("expired")
    expect((await getJob(db, id))!.status).toBe("new")
  })

  it("expires stale offers whenever offers are read", async () => {
    const id = await visit("3–5 pm", "2099-01-08")
    await offerJob(db, { bookingId: id, proId: "P-2", by: "ops", now: new Date("2000-01-01T00:00:00Z") })
    expect(await expireOffers(db)).toBeGreaterThanOrEqual(1)
    expect((await listOffers(db, { bookingIds: [id] }))[0].status).toBe("expired")
  })

  it("comes back withdrawn when ops gave the visit to someone else meanwhile", async () => {
    const id = await visit("5–7 pm", "2099-01-08")
    const o = await offerJob(db, { bookingId: id, proId: "P-1", by: "ops", now: NOW })
    await mutateJob(db, id, (j) => Object.assign(j, { proId: "P-2", status: "assigned" }))
    expect((await answerOffer(db, { offerId: o.id, proId: "P-1", accept: true, now: NOW })).status).toBe("withdrawn")
    expect((await getJob(db, id))!.proId).toBe("P-2")
  })

  it("refuses an accept she can't do any more, worded for her", async () => {
    const id = await visit("9–11 am", "2099-01-09")
    const o = await offerJob(db, { bookingId: id, proId: "P-1", by: "ops", now: NOW })
    await setProProfile(db, "P-1", { timeOff: { add: ["2099-01-09"] } }, ["dha"])
    await expect(answerOffer(db, { offerId: o.id, proId: "P-1", accept: true, now: NOW })).rejects.toThrow("You have that day off")
    expect((await listOffers(db, { bookingIds: [id] }))[0].status).toBe("pending")
  })

  it("ops can withdraw an open offer", async () => {
    const id = await visit("11 am–1 pm", "2099-01-10")
    await offerJob(db, { bookingId: id, proId: "P-1", by: "ops", now: NOW })
    expect(await withdrawOffers(db, id, "ops@mjazo.test")).toBe(1)
    expect((await listOffers(db, { bookingIds: [id] }))[0]).toMatchObject({ status: "withdrawn", reason: "Withdrawn by ops" })
    expect(await withdrawOffers(db, id, "ops@mjazo.test")).toBe(0)
  })
})
