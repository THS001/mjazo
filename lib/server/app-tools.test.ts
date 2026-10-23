import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { Db } from "@/lib/core/db"

// The AI tools as the phone app uses them: Home Pulse's plan from /api/v1/pulse (the same engine
// and wording as the website, with a signed-in customer's finished visits), and the Concierge's
// tools on the app's channel (cart additions come back to the app; its bookings are marked
// "concierge-app").

vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [] }) }))
vi.mock("@/lib/cms/auth", async (orig) => ({ ...(await orig<object>()), authMode: () => "dev" }))
vi.mock("@/lib/server/docs", () => ({ all: async () => [], get: async () => null, put: async () => {}, insertNew: async () => {}, mutate: async () => null, remove: async () => {} }))
vi.mock("@/lib/server/store", async (orig) => ({
  ...(await orig<object>()),
  db: null,
  listSubmissions: async () => [],
  saveSubmission: async () => ({ id: `MJ-A${Math.random().toString(36).slice(2, 8).toUpperCase()}`, record: {} }),
  notifyOps: async () => {},
}))
vi.mock("@/lib/cms/read", async () => {
  const { buildCatalog, DEFAULT_CATALOG } = await import("@/lib/catalog")
  const { HOME_PULSE_TEXT, HOME_PULSE_TEXT_UR } = await import("@/lib/cms/types/tool-text/home-pulse")
  const cat = buildCatalog(DEFAULT_CATALOG)
  const settings = { referral: { friendOff: 500, youGet: 500 }, plus: { price: 2500, period: "year", discount: 0.1 }, policy: { leadHours: 2, freeChangeHours: 3, redoHours: 24 }, site: { url: "https://mjazo.vercel.app", phone: "+92 300 0000000", whatsapp: "923000000000", email: "hello@mjazo.pk" }, flags: {} }
  return {
    getCatalog: async () => cat,
    getSettings: async () => settings,
    getPage: async (_key: string, lang?: string) => ({ tool: lang === "ur" ? HOME_PULSE_TEXT_UR : HOME_PULSE_TEXT }),
  }
})
// No network in tests: the forecast is unavailable, so the plan has no weather items.
vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })))

type H = (req: Request) => Promise<Response>
let db: Db & { close(): Promise<void> }
let pulse: H
let dev: H
const profile = { acs: 2, tankUnderground: true, tankOverhead: true, solar: false, geyser: "gas", pets: false, waxWeeks: 4, threadWeeks: 0, facialWeeks: 0, maniWeeks: 0, events: [] }
const post = (h: H, body: unknown, token?: string) => h(new Request("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }))
const json = async (r: Response) => ({ status: r.status, ...(await r.json()) })

beforeAll(async () => {
  const { testCore } = await import("@/lib/core/test-db")
  db = await testCore()
  pulse = (await import("../../app/api/v1/pulse/route")).POST
  dev = (await import("../../app/api/v1/customer/dev-login/route")).POST
}, 180_000)
afterAll(() => db?.close())

describe("Home Pulse for the app", () => {
  it("plans the next 90 days with each item's service and price, and the tool's text", async () => {
    const r = await json(await post(pulse, { lang: "en", profile }))
    expect(r.status).toBe(200)
    expect(r.text.profile.acs).toBe("Air conditioners")
    expect(r.items.length).toBeGreaterThan(2)
    const wax = r.items.find((i: { category: string }) => i.category === "womens-salon")
    expect(wax).toMatchObject({ kind: "beauty", name: expect.any(String), price: expect.any(Number) })
    expect(wax.price).toBeGreaterThan(0)
    expect(r.items.some((i: { category: string }) => i.category === "water-tank-cleaning")).toBe(true)
    // "Done" items drop out.
    const again = await json(await post(pulse, { lang: "en", profile, done: [wax.id] }))
    expect(again.items.find((i: { id: string }) => i.id === wax.id)).toBeUndefined()
  })

  it("answers in Urdu, and refuses a broken profile", async () => {
    const r = await json(await post(pulse, { lang: "ur", profile }))
    expect(r.text.profile.acs).toMatch(/[؀-ۿ]/)
    expect((await post(pulse, { lang: "en", profile: { ...profile, acs: -1 } })).status).toBe(422)
  })

  it("counts a signed-in customer's finished visits: a wax done last week moves the next one out", async () => {
    const before = await json(await post(pulse, { lang: "en", profile }))
    const firstWax = before.items.find((i: { category: string }) => i.category === "womens-salon").date
    const { karachiNow } = await import("@/lib/time")
    const weekAgo = new Date(Date.parse(`${karachiNow().date}T00:00:00Z`) - 7 * 86400_000).toISOString().slice(0, 10)
    // A signed-in customer (local test sign-in) with a full-body wax, done a week ago.
    const token = (await json(await post(dev, { email: "pulse@example.com" }))).token
    const { accountOf } = await import("@/lib/server/customer-auth")
    const account = (await accountOf(new Request("http://x", { headers: { authorization: `Bearer ${token}` } }))) as { userId: string }
    const { linkAccount } = await import("@/lib/core/customers")
    const c = await linkAccount(db, { userId: account.userId, email: "pulse@example.com", name: "Pulse", phone: "03003330001" })
    const { placeBooking } = await import("@/lib/server/bookings-core")
    const { nextDays } = await import("@/lib/time")
    const item = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1, unitPrice: 0 }
    const { id } = await placeBooking({ name: "Pulse", phone: "03003330001", area: "dha", address: "House 1", date: nextDays(7)[3].iso, window: "3–5 pm", payment: "cash", items: [item], total: 0 }, {}, "test", c.id)
    await db.query("update bookings set day = $2, status = 'completed' where id = $1", [id, weekAgo])
    const after = await json(await post(pulse, { lang: "en", profile }, token))
    const nextWax = after.items.find((i: { category: string }) => i.category === "womens-salon").date
    expect(nextWax > firstWax).toBe(true)
  })
})

describe("the Concierge on the app's channel", () => {
  it("adds items to the app's cart, and marks its bookings as made in the app by the AI", async () => {
    const { runTool } = await import("@/lib/ai/tools")
    const items = [{ category: "womens-salon", service: "full-body-wax" }]
    const added = await runTool("add_to_cart", { items }, { channel: "app" })
    expect(added.ui?.[0]).toMatchObject({ type: "cart_add", item: { service: "full-body-wax" } })
    expect((await runTool("add_to_cart", { items }, { channel: "whatsapp" })).ui).toBeUndefined()
    const { nextDays } = await import("@/lib/time")
    const r = await runTool("create_booking", { items, name: "App Chat", phone: "03003330002", area: "dha", address: "House 2", date: nextDays(7)[3].iso, window: "3–5 pm", payment: "cash" }, { channel: "app" })
    expect(r.result).toMatchObject({ booked: true })
    const id = (r.result as { id: string }).id
    expect(await db.one("select channel from bookings where id = $1", [id])).toEqual({ channel: "concierge-app" })
  })
})
