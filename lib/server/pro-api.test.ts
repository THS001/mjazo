import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { Db } from "@/lib/core/db"

// The pro app's API (/api/v1/pro), through the real routes on a real (in-memory) core database:
// sign-in by PIN (token and cookie) and by a Supabase token, every route refusing a signed-out
// caller, one pro never reaching another's visits or offers, what an offer shows before it's
// accepted, a whole visit from offer to earnings, and availability.

const jar = vi.hoisted(() => new Map<string, string>())
const mem = vi.hoisted(() => ({ docs: new Map<string, Map<string, unknown>>(), users: new Map<string, { id: string; email: string }>() }))

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k) } : undefined), set: (k: string, v: string) => void jar.set(k, v), delete: (k: string) => void jar.delete(k), getAll: () => [] }),
}))
vi.mock("@/lib/server/docs", () => {
  const col = (c: string) => {
    if (!mem.docs.has(c)) mem.docs.set(c, new Map())
    return mem.docs.get(c) as Map<string, { id: string }>
  }
  return {
    all: async (c: string) => [...col(c).values()].map((x) => structuredClone(x)),
    get: async (c: string, id: string) => structuredClone(col(c).get(id) ?? null),
    put: async (c: string, d: { id: string }) => void col(c).set(d.id, structuredClone(d)),
    insertNew: async (c: string, list: { id: string }[]) => list.forEach((d) => col(c).has(d.id) || col(c).set(d.id, structuredClone(d))),
    mutate: async () => null,
    remove: async (c: string, id: string) => void col(c).delete(id),
  }
})
// Supabase: only getUser, for the phone app's email sign-in (a token "sb-<user id>").
vi.mock("@/lib/server/store", async (orig) => ({
  ...(await orig<object>()),
  db: { auth: { getUser: async (t: string) => (mem.users.has(t) ? { data: { user: mem.users.get(t) }, error: null } : { data: { user: null }, error: new Error("bad token") }) } },
  listSubmissions: async () => [],
  notifyOps: async () => {},
}))
vi.mock("@/lib/cms/read", async () => {
  const { buildCatalog, DEFAULT_CATALOG } = await import("@/lib/catalog")
  const cat = buildCatalog(DEFAULT_CATALOG)
  return { getCatalog: async () => cat, getSettings: async () => ({ referral: { friendOff: 500 }, policy: { leadHours: 2 } }) }
})

type Ctx = { params: Promise<{ id: string }> }
type H = (req: Request, ctx: Ctx) => Promise<Response>
let R: Record<string, Partial<Record<"GET" | "POST" | "PUT" | "DELETE", H>>>
let db: Db & { close(): Promise<void> }
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10) // Karachi's date
const later = new Date(Date.now() + 5 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10)
let mine = "" // a visit for Sana today
let hers = "" // a visit for Hina today
let open = "" // an unassigned visit in three days, offered to Sana

let ip = 0
const call = (m: H, opts: { method?: string; body?: unknown; token?: string; id?: string; query?: string; ip?: string } = {}) =>
  m(
    new Request(`http://localhost/api/v1/pro/x${opts.query ?? ""}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.ip ? { "x-forwarded-for": opts.ip } : {}), "content-type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
    { params: Promise.resolve({ id: opts.id ?? "none" }) },
  )
/** Signs in from a new address each time, so the sign-in rate limit (8 tries per address) stays out of the way. */
async function signIn(phone: string, pin: string) {
  const res = await call(R.session.POST!, { body: { phone, pin }, ip: `10.0.0.${++ip}` })
  return { res, body: (await res.json()) as { token: string; error?: string } }
}

beforeAll(async () => {
  const { testCore } = await import("@/lib/core/test-db")
  db = await testCore()
  R = {
    session: await import("../../app/api/v1/pro/session/route"),
    me: await import("../../app/api/v1/pro/me/route"),
    jobs: await import("../../app/api/v1/pro/jobs/route"),
    job: await import("../../app/api/v1/pro/jobs/[id]/route"),
    offers: await import("../../app/api/v1/pro/offers/route"),
    offer: await import("../../app/api/v1/pro/offers/[id]/route"),
    earnings: await import("../../app/api/v1/pro/earnings/route"),
    ratings: await import("../../app/api/v1/pro/ratings/route"),
    availability: await import("../../app/api/v1/pro/availability/route"),
    sos: await import("../../app/api/v1/pro/sos/route"),
    copilot: await import("../../app/api/v1/pro/copilot/route"),
  } as typeof R
  const cj = await import("@/lib/core/jobs")
  const { hashPin } = await import("@/lib/server/session")
  const { buildCatalog, DEFAULT_CATALOG } = await import("@/lib/catalog")
  const cat = buildCatalog(DEFAULT_CATALOG)
  const base = { area: "dha", skills: ["womens-salon"], women: true, status: "active" as const, createdAt: new Date().toISOString() }
  await cj.savePro(db, { ...base, id: "P-SANA", name: "Sana", phone: "03111111111", pinHash: hashPin("1234"), email: "sana@example.com" })
  await cj.savePro(db, { ...base, id: "P-HINA", name: "Hina", phone: "03122222222", pinHash: hashPin("5678") })
  const book = (id: string, date: string, window: string, phone: string) =>
    cj.createBooking(db, { id, name: "Ayesha Khan", phone, area: "dha", address: "House 7, Khayaban-e-Ittehad", date, window, payment: "cash", items: [{ name: "x", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1 }] }, cat)
  mine = (await book("MJ-PA1", today, "7–9 pm", "03001110001")).id
  hers = (await book("MJ-PA2", today, "7–9 pm", "03001110002")).id
  open = (await book("MJ-PA3", later, "3–5 pm", "03001110003")).id
  await cj.mutateJob(db, mine, (j) => Object.assign(j, { proId: "P-SANA", status: "assigned" }))
  await cj.mutateJob(db, hers, (j) => Object.assign(j, { proId: "P-HINA", status: "assigned" }))
  const { offerJob } = await import("@/lib/core/offers")
  await offerJob(db, { bookingId: open, proId: "P-SANA", by: "ops@mjazo.test" })
}, 180_000)
afterAll(() => db?.close())
beforeEach(() => jar.clear())

describe("signing in", () => {
  it("refuses every route to a signed-out caller", async () => {
    const routes: [string, H][] = [
      ["me", R.me.GET!], ["jobs", R.jobs.GET!], ["job", R.job.POST!], ["offers", R.offers.GET!], ["offer", R.offer.POST!], ["earnings", R.earnings.GET!],
      ["ratings", R.ratings.GET!], ["availability", R.availability.GET!], ["availability put", R.availability.PUT!], ["sos", R.sos.POST!], ["copilot", R.copilot.POST!],
    ]
    for (const [name, h] of routes) expect((await call(h, { body: name === "jobs" ? undefined : {}, method: name.endsWith("put") ? "PUT" : undefined })).status, name).toBe(401)
    expect((await call(R.me.GET!, { token: "mjp.forged.token" })).status).toBe(401)
    expect((await call(R.me.GET!, { token: "not-a-supabase-token" })).status).toBe(401)
  })

  it("gives a token for the phone app and a cookie for the web on the right PIN only", async () => {
    expect((await signIn("0311 1111111", "9999")).res.status).toBe(401)
    expect(jar.size).toBe(0)
    const { res, body } = await signIn("0311 1111111", "1234")
    expect(res.status).toBe(200)
    expect(body.token).toMatch(/^mjp\./)
    expect(jar.get("mjz_staff")).toBe(body.token.slice(4))
    // The token alone, and the cookie alone.
    const viaToken = await call(R.me.GET!, { token: body.token })
    expect(await viaToken.json()).toMatchObject({ id: "P-SANA", name: "Sana", rating: { count: 0 } })
    expect((await call(R.me.GET!)).status).toBe(200)
    // A changed character breaks the signature.
    const forged = body.token.slice(0, -2) + (body.token.endsWith("A") ? "BB" : "AA")
    jar.clear()
    expect((await call(R.me.GET!, { token: forged })).status).toBe(401)
  })

  it("ends every session when ops reset her PIN, and refuses a paused pro", async () => {
    const { body } = await signIn("03122222222", "5678")
    expect((await call(R.me.GET!, { token: body.token })).status).toBe(200)
    const cj = await import("@/lib/core/jobs")
    const { hashPin } = await import("@/lib/server/session")
    const hina = (await cj.getProRow(db, "P-HINA"))!
    await cj.savePro(db, { ...hina, pinHash: hashPin("2468") })
    expect((await call(R.me.GET!, { token: body.token })).status).toBe(401)
    const again = await signIn("03122222222", "2468")
    await cj.savePro(db, { ...(await cj.getProRow(db, "P-HINA"))!, status: "paused" })
    const paused = await call(R.me.GET!, { token: again.body.token })
    expect(paused.status).toBe(403)
    expect((await paused.json()).error).toMatch(/paused/)
    expect((await signIn("03122222222", "2468")).res.status).toBe(403)
    await cj.savePro(db, { ...(await cj.getProRow(db, "P-HINA"))!, status: "active", pinHash: hashPin("5678") })
  })

  it("slows down guessing: nine wrong tries from one address are refused", async () => {
    let last = 0
    for (let i = 0; i < 9; i++) last = (await call(R.session.POST!, { body: { phone: "03111111111", pin: "0000" }, ip: "10.9.9.9" })).status
    expect(last).toBe(429)
  })

  it("accepts the phone app's Supabase token for a pro with that email, and links her account", async () => {
    mem.users.set("sb-u1", { id: "00000000-0000-4000-8000-000000000001", email: "SANA@example.com" })
    mem.users.set("sb-u2", { id: "00000000-0000-4000-8000-000000000002", email: "stranger@example.com" })
    const res = await call(R.me.GET!, { token: "sb-u1" })
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe("P-SANA")
    expect((await db.one<{ auth_user_id: string }>("select auth_user_id from pros where id = 'P-SANA'"))!.auth_user_id).toBe("00000000-0000-4000-8000-000000000001")
    expect((await call(R.me.GET!, { token: "sb-u2" })).status).toBe(401)
  })
})

describe("one pro, her own visits", () => {
  it("never reaches another pro's visit or offer", async () => {
    const { body } = await signIn("03111111111", "1234")
    const res = await call(R.job.POST!, { token: body.token, id: hers, body: { action: "en_route" } })
    expect(res.status).toBe(400)
    expect((await call(R.job.POST!, { token: body.token, id: hers, body: { action: "note", note: "Hello there" } })).status).toBe(400)
    const hina = (await signIn("03122222222", "5678")).body.token
    const offers = (await (await call(R.offers.GET!, { token: body.token })).json()).offers as { id: string }[]
    expect((await call(R.offer.POST!, { token: hina, id: offers[0].id, body: { accept: true } })).status).toBe(400)
    const hinaOffers = (await (await call(R.offers.GET!, { token: hina })).json()).offers
    expect(hinaOffers).toEqual([])
  })

  it("shows where and what in an offer, never who, until she accepts", async () => {
    const { body } = await signIn("03111111111", "1234")
    const res = await call(R.offers.GET!, { token: body.token })
    const text = await res.clone().text()
    const { offers } = (await res.json()) as { offers: { status: string; visit: { id: string; area: string; earn: number; services: { name: string }[] } }[] }
    expect(offers[0]).toMatchObject({ status: "pending", visit: { id: open, area: "DHA" } })
    expect(offers[0].visit.earn).toBeGreaterThan(0)
    for (const secret of ["Ayesha", "03001110003", "House 7", "Khayaban"]) expect(text).not.toContain(secret)
  })
})

describe("a visit from offer to earnings", () => {
  it("accept → in her schedule → on the way → check in → finish with cash → the ledger", async () => {
    const { body } = await signIn("03111111111", "1234")
    const t = body.token
    const { offers } = (await (await call(R.offers.GET!, { token: t })).json()) as { offers: { id: string }[] }
    const ok = await call(R.offer.POST!, { token: t, id: offers[0].id, body: { accept: true } })
    expect(await ok.json()).toEqual({ offer: { id: offers[0].id, status: "accepted" } })
    // Accepted: it's in her schedule, now with the customer's details.
    const sched = (await (await call(R.jobs.GET!, { token: t, query: "?days=7" })).json()) as { today: string; days: { date: string; visits: { id: string; customer: { name: string }; earn: number }[] }[]; openOffers: number }
    expect(sched.today).toBe(today)
    expect(sched.days).toHaveLength(7)
    expect(sched.openOffers).toBe(0)
    const accepted = sched.days.flatMap((d) => d.visits).find((v) => v.id === open)!
    expect(accepted.customer.name).toBe("Ayesha Khan")
    // Today's visit, all the way through.
    for (const action of ["en_route", "check_in"]) expect((await call(R.job.POST!, { token: t, id: mine, body: { action, lat: 24.8, lng: 67.06 } })).status).toBe(200)
    const total = (await db.one<{ total: number }>("select total from bookings where id = $1", [mine]))!.total
    const done = await call(R.job.POST!, { token: t, id: mine, body: { action: "complete", payment: { method: "cash", amount: total } } })
    expect(await done.json()).toMatchObject({ status: "completed", message: expect.stringContaining("Cash") })
    const e = (await (await call(R.earnings.GET!, { token: t })).json()) as { balances: { owed: number; cashHeld: number; net: number }; week: { visits: number }; statement: { kind: string }[] }
    expect(e.balances.cashHeld).toBe(total)
    expect(e.balances.owed).toBeGreaterThan(0)
    expect(e.balances.net).toBe(e.balances.owed - total)
    expect(e.week.visits).toBe(1)
    expect(e.statement.map((l) => l.kind).sort()).toEqual(["payment", "visit_completed"])
    // A note for next time, saved on her visit.
    expect((await call(R.job.POST!, { token: t, id: mine, body: { action: "note", note: "Gate code 4411" } })).status).toBe(200)
  })

  it("shows her ratings without the customer's name", async () => {
    const cj = await import("@/lib/core/jobs")
    await cj.mutateJob(db, mine, (j) => void (j.rating = { stars: 5, tags: ["On time"], comment: "Lovely", at: new Date().toISOString() }))
    const { body } = await signIn("03111111111", "1234")
    const res = await call(R.ratings.GET!, { token: body.token })
    const text = await res.clone().text()
    expect(await res.json()).toMatchObject({ count: 1, average: 5, recent: [{ stars: 5, tags: ["On time"], comment: "Lovely" }] })
    expect(text).not.toContain("Ayesha")
  })
})

describe("availability", () => {
  it("lets her change her windows and days off, but not take off a day she has visits on", async () => {
    const { body } = await signIn("03111111111", "1234")
    const t = body.token
    const busy = await call(R.availability.PUT!, { token: t, method: "PUT", body: { timeOff: { add: [later] } } })
    expect(busy.status).toBe(400)
    expect((await busy.json()).error).toMatch(/You have visits on/)
    const free = new Date(Date.now() + 5 * 3600_000 + 9 * 86400_000).toISOString().slice(0, 10)
    expect((await call(R.availability.PUT!, { token: t, method: "PUT", body: { availability: { "1": ["9–11 am"] }, timeOff: { add: [free] } } })).status).toBe(200)
    const a = (await (await call(R.availability.GET!, { token: t })).json()) as { availability: Record<string, string[]>; timeOff: string[]; busyDays: string[] }
    expect(a.availability).toEqual({ "1": ["9–11 am"] })
    expect(a.timeOff).toContain(free)
    expect(a.busyDays).toContain(later)
    expect((await call(R.availability.PUT!, { token: t, method: "PUT", body: { timeOff: { add: ["2000-01-01"] } } })).status).toBe(400)
    const audit = await db.one<{ actor: string }>("select actor from audit_log where action = 'changed her availability' order by id desc limit 1")
    expect(audit?.actor).toBe("pro:P-SANA")
  })
})

describe("SOS", () => {
  it("reaches ops between visits too", async () => {
    const { body } = await signIn("03111111111", "1234")
    expect((await call(R.sos.POST!, { token: body.token, body: { lat: 24.8, lng: 67.0 } })).status).toBe(200)
    expect([...(mem.docs.get("sos")?.values() ?? [])]).toEqual([expect.objectContaining({ proId: "P-SANA", lat: 24.8 })])
  })
})
