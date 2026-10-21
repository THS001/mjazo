import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { Db } from "@/lib/core/db"

// The client account's API (/api/v1/customer and the checkout's /api/submit), through the real
// routes on a real (in-memory) core database: sign-in (test token locally, Supabase token
// otherwise), joining a phone number (with proof for a number that has bookings), one customer
// never reaching another's bookings or addresses, booking with a promo code, credit and a
// requested pro, moving and cancelling within the policy, saved addresses and the pro's slots.

const mode = vi.hoisted(() => ({ auth: "dev" as "dev" | "supabase" }))
const mem = vi.hoisted(() => ({ docs: new Map<string, Map<string, unknown>>(), subs: 0, users: new Map<string, { id: string; email: string }>() }))

vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [] }) }))
vi.mock("@/lib/cms/auth", async (orig) => ({ ...(await orig<object>()), authMode: () => mode.auth }))
vi.mock("@/lib/server/docs", () => {
  const col = (c: string) => {
    if (!mem.docs.has(c)) mem.docs.set(c, new Map())
    return mem.docs.get(c) as Map<string, { id: string }>
  }
  return {
    all: async (c: string) => [...col(c).values()],
    get: async (c: string, id: string) => col(c).get(id) ?? null,
    put: async (c: string, d: { id: string }) => void col(c).set(d.id, d),
    insertNew: async () => {},
    mutate: async () => null,
    remove: async (c: string, id: string) => void col(c).delete(id),
  }
})
vi.mock("@/lib/server/store", async (orig) => ({
  ...(await orig<object>()),
  db: { auth: { getUser: async (t: string) => (mem.users.has(t) ? { data: { user: mem.users.get(t) }, error: null } : { data: { user: null }, error: new Error("bad token") }) } },
  listSubmissions: async () => [],
  saveSubmission: async () => ({ id: `MJ-T${++mem.subs}`, record: {} }),
  notifyOps: async () => {},
}))
vi.mock("@/lib/cms/read", async () => {
  const { buildCatalog, DEFAULT_CATALOG } = await import("@/lib/catalog")
  const cat = buildCatalog(DEFAULT_CATALOG)
  return { getCatalog: async () => cat, getSettings: async () => ({ referral: { friendOff: 500 }, policy: { leadHours: 2, freeChangeHours: 3 } }) }
})

type Ctx = { params: Promise<{ id: string }> }
type H = (req: Request, ctx: Ctx) => Promise<Response>
let R: Record<string, Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", H>>>
let db: Db & { close(): Promise<void> }
const day = (n: number) => new Date(Date.now() + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10)
const item = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1, unitPrice: 0 }
const booking = (phone: string, extra: Record<string, unknown> = {}) => ({ name: "Ayesha Khan", phone, area: "dha", address: "House 7, Street 3", date: day(3), window: "3–5 pm", payment: "cash", items: [item], total: 0, ...extra })

const call = (m: H, o: { method?: string; body?: unknown; token?: string; id?: string } = {}) =>
  m(new Request("http://localhost/api/x", { method: o.method ?? (o.body === undefined ? "GET" : "POST"), headers: { "content-type": "application/json", ...(o.token ? { authorization: `Bearer ${o.token}` } : {}) }, body: o.body === undefined ? undefined : JSON.stringify(o.body) }), { params: Promise.resolve({ id: o.id ?? "x" }) })
const json = async (r: Response) => ({ status: r.status, ...(await r.json()) })
async function devToken(email: string) {
  return (await json(await call(R.dev.POST!, { body: { email } }))).token as string
}

beforeAll(async () => {
  const { testCore } = await import("@/lib/core/test-db")
  db = await testCore()
  R = {
    dev: await import("../../app/api/v1/customer/dev-login/route"),
    me: await import("../../app/api/v1/customer/me/route"),
    link: await import("../../app/api/v1/customer/me/link/route"),
    bookings: await import("../../app/api/v1/customer/bookings/route"),
    booking: await import("../../app/api/v1/customer/bookings/[id]/route"),
    addresses: await import("../../app/api/v1/customer/addresses/route"),
    address: await import("../../app/api/v1/customer/addresses/[id]/route"),
    promo: await import("../../app/api/v1/customer/promo/route"),
    submit: await import("../../app/api/submit/route"),
    slots: await import("../../app/api/v1/slots/route"),
  } as typeof R
  const cj = await import("@/lib/core/jobs")
  await cj.savePro(db, { id: "P-SANA", name: "Sana Bibi", phone: "03111111111", area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })
  await cj.savePro(db, { id: "P-AC", name: "Bilal", phone: "03122222222", area: "dha", skills: ["ac-appliances"], women: false, status: "active", createdAt: new Date().toISOString() })
  const { savePromo } = await import("@/lib/core/promos")
  await savePromo(db, { code: "HELLO10", kind: "percent", value: 10 }, "finance@mjazo.test", true)
}, 180_000)
afterAll(() => db?.close())

describe("signing in", () => {
  it("refuses every account route to a signed-out caller (the promo check is open to all)", async () => {
    const routes: [H, string?][] = [[R.me.GET!], [R.me.PATCH!, "PATCH"], [R.link.POST!, "POST"], [R.bookings.GET!], [R.bookings.POST!, "POST"], [R.booking.GET!], [R.booking.POST!, "POST"], [R.addresses.GET!], [R.addresses.POST!, "POST"], [R.address.PUT!, "PUT"], [R.address.DELETE!, "DELETE"]]
    for (const [h, method] of routes) expect((await call(h, { method, body: method && method !== "DELETE" ? {} : undefined })).status).toBe(401)
    expect((await call(R.me.GET!, { token: "mjc.forged.x" })).status).toBe(401)
    expect((await call(R.promo.POST!, { body: { code: "NOPE", items: [item] } })).status).toBe(200)
  })

  it("gives a local test sign-in only in development, and refuses its token elsewhere", async () => {
    const t = await devToken("dev@example.com")
    expect(t).toMatch(/^mjc\./)
    expect((await call(R.me.GET!, { token: t })).status).toBe(200)
    mode.auth = "supabase"
    expect((await call(R.dev.POST!, { body: { email: "x@example.com" } })).status).toBe(404)
    expect((await call(R.me.GET!, { token: t })).status).toBe(401)
    // A Supabase access token works there.
    mem.users.set("sb-1", { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "Real@Example.com" })
    expect(await json(await call(R.me.GET!, { token: "sb-1" }))).toMatchObject({ status: 200, email: "real@example.com", customer: null })
    mode.auth = "dev"
  })
})

describe("joining a phone number", () => {
  it("joins a new number at once, and asks for proof for a number with bookings", async () => {
    const t = await devToken("ayesha@example.com")
    expect(await json(await call(R.me.GET!, { token: t }))).toMatchObject({ customer: null, credit: { balance: 0, available: 0 } })
    // A guest booking made earlier with this number.
    const guest = await json(await call(R.submit.POST!, { body: { type: "booking", data: booking("03001234567") } }))
    expect(guest.status).toBe(200)
    const noProof = await json(await call(R.link.POST!, { token: t, body: { name: "Ayesha", phone: "0300 1234567" } }))
    expect(noProof).toMatchObject({ status: 400, code: "proof" })
    const ok = await json(await call(R.link.POST!, { token: t, body: { name: "Ayesha", phone: "03001234567", proof: [guest.id] } }))
    expect(ok.customer).toMatchObject({ phone: "03001234567", email: "ayesha@example.com" })
    const list = await json(await call(R.bookings.GET!, { token: t }))
    expect(list.upcoming.map((b: { id: string }) => b.id)).toEqual([guest.id])
    // Another account can't take the number.
    const other = await devToken("someone@example.com")
    expect(await json(await call(R.link.POST!, { token: other, body: { name: "Sam", phone: "03001234567", proof: [guest.id] } }))).toMatchObject({ status: 400, code: "taken" })
  })
})

describe("booking, and changing a booking", () => {
  let t = ""
  let mine = ""
  beforeAll(async () => {
    t = await devToken("bee@example.com")
    const c = (await json(await call(R.link.POST!, { token: t, body: { name: "Bee", phone: "03007654321" } }))).customer
    const { issueCredit } = await import("@/lib/core/ledger")
    await issueCredit(db, { customerId: c.id, amount: 400, reason: "Sorry" })
  })

  it("places a booking with a promo code, credit and a requested pro, and shows it", async () => {
    expect(await json(await call(R.promo.POST!, { token: t, body: { code: "hello10", items: [item] } }))).toMatchObject({ ok: true, code: "HELLO10" })
    expect(await json(await call(R.promo.POST!, { body: { code: "NOPE", items: [item] } }))).toMatchObject({ ok: false, problem: "invalid" })
    const placed = await json(await call(R.bookings.POST!, { token: t, body: booking("03007654321", { promo: "HELLO10", useCredit: true, preferredProId: "P-SANA", lat: 24.796, lng: 67.06, date: day(5), window: "9–11 am" }) }))
    expect(placed, JSON.stringify(placed)).toMatchObject({ status: 200, credit: 400 })
    mine = placed.id
    const b = await json(await call(R.booking.GET!, { token: t, id: mine }))
    expect(b).toMatchObject({ id: mine, status: "new", credit: 400, askedFor: { id: "P-SANA", firstName: "Sana" }, canChange: true })
    expect(b.discount).toBe(Math.round(b.subtotal * 0.1))
    expect(b.due).toBe(b.total - 400)
    expect((await json(await call(R.me.GET!, { token: t }))).credit).toEqual({ balance: 400, available: 0 })
    // The same code can't be used twice by them.
    const again = await json(await call(R.bookings.POST!, { token: t, body: booking("03007654321", { promo: "HELLO10", date: day(5), window: "11 am–1 pm" }) }))
    expect(again, JSON.stringify(again)).toMatchObject({ status: 422, code: "promo-used" })
  })

  it("never shows or changes another customer's booking", async () => {
    const other = await devToken("ayesha@example.com")
    expect((await call(R.booking.GET!, { token: other, id: mine })).status).toBe(400)
    expect((await call(R.booking.POST!, { token: other, id: mine, body: { action: "cancel" } })).status).toBe(400)
    expect((await json(await call(R.bookings.GET!, { token: other }))).upcoming.map((x: { id: string }) => x.id)).not.toContain(mine)
  })

  it("moves it within the policy, keeping who they asked for", async () => {
    const r = await json(await call(R.booking.POST!, { token: t, id: mine, body: { action: "reschedule", date: day(4), window: "5–7 pm" } }))
    expect(r.booking).toMatchObject({ date: day(4), window: "5–7 pm", status: "new", askedFor: { id: "P-SANA" } })
    const ev = await db.one<{ by: string; actor: string }>("select by, actor from booking_events where booking_id = $1 and type = 'rescheduled'", [mine])
    expect(ev).toMatchObject({ by: "customer" })
  })

  it("cancels it, and their credit is free again", async () => {
    const r = await json(await call(R.booking.POST!, { token: t, id: mine, body: { action: "cancel", reason: "Travelling" } }))
    expect(r.booking.status).toBe("cancelled")
    expect((await json(await call(R.me.GET!, { token: t }))).credit).toEqual({ balance: 400, available: 400 })
    expect((await call(R.booking.POST!, { token: t, id: mine, body: { action: "cancel" } })).status).toBe(400)
  })

  it("refuses a change once the free-change time has passed", async () => {
    const { createBooking } = await import("@/lib/core/jobs")
    const { buildCatalog, DEFAULT_CATALOG } = await import("@/lib/catalog")
    const c = (await db.one<{ id: string }>("select id from customers where phone = '03007654321'"))!.id
    const late = await createBooking(db, { id: "MJ-LATE", ...booking("03007654321"), date: day(-1), customerId: c }, buildCatalog(DEFAULT_CATALOG))
    const b = await json(await call(R.booking.GET!, { token: t, id: late.id }))
    expect(b.canChange).toBe(false)
    const r = await json(await call(R.booking.POST!, { token: t, id: late.id, body: { action: "cancel" } }))
    expect(r).toMatchObject({ status: 400, error: expect.stringMatching(/too late/) })
  })

  it("uses credit from the website's checkout only when signed in", async () => {
    const guest = await json(await call(R.submit.POST!, { body: { type: "booking", data: booking("03007654321", { useCredit: true, date: day(6), window: "9–11 am" }) } }))
    expect(guest.credit ?? 0).toBe(0)
    const signed = await json(await call(R.submit.POST!, { token: t, body: { type: "booking", data: booking("03007654321", { useCredit: true, date: day(6), window: "11 am–1 pm" }) } }))
    expect(signed.credit).toBe(400)
  })
})

describe("saved addresses", () => {
  it("saves, changes and deletes them, finding the area from the pin; never someone else's", async () => {
    const t = await devToken("bee@example.com")
    const a = await json(await call(R.addresses.POST!, { token: t, body: { label: "Home", line: "House 12, Street 9", lat: 24.796, lng: 67.06 } }))
    expect(a.address).toMatchObject({ area: "dha", isDefault: true })
    expect((await json(await call(R.addresses.POST!, { token: t, body: { line: "Far away street", lat: 25.6, lng: 68.4 } }))).status).toBe(400)
    const b = await json(await call(R.addresses.POST!, { token: t, body: { label: "Office", area: "clifton", line: "Office 3, Block 5" } }))
    expect((await json(await call(R.address.PUT!, { token: t, method: "PUT", id: b.address.id, body: { ...b.address, isDefault: true } }))).address.isDefault).toBe(true)
    const other = await devToken("ayesha@example.com")
    expect((await call(R.address.DELETE!, { token: other, method: "DELETE", id: a.address.id })).status).toBe(400)
    expect((await call(R.address.DELETE!, { token: t, method: "DELETE", id: a.address.id })).status).toBe(200)
    expect((await json(await call(R.addresses.GET!, { token: t }))).addresses.map((x: { label: string }) => x.label)).toEqual(["Office"])
  })
})

describe("booking a pro again", () => {
  it("shows only her free windows, and says when she can't do it", async () => {
    const slots = (b: unknown) => call(R.slots.POST!, { body: b }).then(json)
    const hers = await slots({ area: "dha", proId: "P-SANA", items: [{ category: "womens-salon", service: "full-body-wax", qty: 1 }] })
    expect(hers.mode).toBe("capacity")
    expect(hers.days).toHaveLength(7)
    expect(await slots({ area: "dha", proId: "P-AC", items: [{ category: "womens-salon", service: "full-body-wax", qty: 1 }] })).toMatchObject({ mode: "unavailable", days: [] })
  })
})
