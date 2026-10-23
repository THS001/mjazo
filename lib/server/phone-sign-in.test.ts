import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { Db } from "@/lib/core/db"

// Phone-number sign-in, through the real routes on a real (in-memory) core database: a code for a
// number (shown on screen in test mode, or sent by WhatsApp or Twilio Verify), signing in with it
// to the customer that number belongs to (bookings made with it included), the limits on codes and
// tries, "sign out everywhere", and a code as the proof when an emailed sign-in adds its number.

vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [] }) }))
vi.mock("@/lib/cms/auth", async (orig) => ({ ...(await orig<object>()), authMode: () => "dev" }))
vi.mock("@/lib/server/docs", () => ({ all: async () => [], get: async () => null, put: async () => {}, insertNew: async () => {}, mutate: async () => null, remove: async () => {} }))
vi.mock("@/lib/server/store", async (orig) => ({
  ...(await orig<object>()),
  db: null,
  listSubmissions: async () => [],
  saveSubmission: async () => ({ id: `MJ-T${Math.random().toString(36).slice(2, 8)}`, record: {} }),
  notifyOps: async () => {},
}))
vi.mock("@/lib/cms/read", async () => {
  const { buildCatalog, DEFAULT_CATALOG } = await import("@/lib/catalog")
  const cat = buildCatalog(DEFAULT_CATALOG)
  return { getCatalog: async () => cat, getSettings: async () => ({ referral: { friendOff: 500, youGet: 500 }, plus: { price: 2500, period: "year", discount: 0.1 }, policy: { leadHours: 2, freeChangeHours: 3, redoHours: 24 }, site: { phone: "+92 300 0000000", whatsapp: "923000000000", email: "hello@mjazo.pk" } }) }
})

type H = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let R: Record<string, Partial<Record<"GET" | "POST" | "PATCH" | "DELETE", H>>>
let db: Db & { close(): Promise<void> }
let ipN = 0
const day = (n: number) => new Date(Date.now() + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10)
const item = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1, unitPrice: 0 }

/** Each call comes from its own internet address unless one is given (the per-address limits are tested on their own). */
const call = (m: H, o: { method?: string; body?: unknown; token?: string; ip?: string } = {}) =>
  m(
    new Request("http://localhost/api/x", {
      method: o.method ?? (o.body === undefined ? "GET" : "POST"),
      headers: { "content-type": "application/json", "x-forwarded-for": o.ip ?? `10.0.0.${++ipN}`, ...(o.token ? { authorization: `Bearer ${o.token}` } : {}) },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }),
    { params: Promise.resolve({ id: "x" }) },
  )
const json = async (r: Response) => ({ status: r.status, ...(await r.json()) })
const askCode = async (phone: string, extra: Record<string, unknown> = {}) => json(await call(R.code.POST!, { body: { phone, ...extra } }))
async function signIn(phone: string) {
  const sent = await askCode(phone)
  expect(sent).toMatchObject({ status: 200, via: "test" })
  return json(await call(R.session.POST!, { body: { phone, code: sent.testCode } }))
}

beforeAll(async () => {
  const { testCore } = await import("@/lib/core/test-db")
  db = await testCore()
  R = {
    code: await import("../../app/api/v1/customer/phone/code/route"),
    session: await import("../../app/api/v1/customer/phone/session/route"),
    me: await import("../../app/api/v1/customer/me/route"),
    link: await import("../../app/api/v1/customer/me/link/route"),
    sessions: await import("../../app/api/v1/customer/me/sessions/route"),
    bookings: await import("../../app/api/v1/customer/bookings/route"),
    dev: await import("../../app/api/v1/customer/dev-login/route"),
    submit: await import("../../app/api/submit/route"),
    config: await import("../../app/api/v1/config/route"),
  } as typeof R
}, 180_000)
afterAll(() => db?.close())
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("signing in with a phone number (test mode: the code shows on screen)", () => {
  it("signs a new number in with its code, and the token works on the account API", async () => {
    const sent = await askCode("0300 5550001")
    expect(sent).toMatchObject({ status: 200, via: "test", resendIn: 30, expiresIn: 600, testCode: expect.stringMatching(/^\d{6}$/) })
    const wrong = sent.testCode === "000000" ? "111111" : "000000"
    expect(await json(await call(R.session.POST!, { body: { phone: "03005550001", code: wrong } }))).toMatchObject({ status: 400, code: "wrong" })
    const s = await json(await call(R.session.POST!, { body: { phone: "+92 300 5550001", code: sent.testCode } }))
    expect(s).toMatchObject({ status: 200, token: expect.stringMatching(/^mjs\./), isNew: true, customer: { phone: "03005550001", name: "" } })
    expect(await json(await call(R.me.GET!, { token: s.token }))).toMatchObject({ status: 200, by: "phone", email: null, customer: { phone: "03005550001" } })
    expect((await call(R.me.PATCH!, { method: "PATCH", token: s.token, body: { name: "Hira Ali" } })).status).toBe(200)
    // A code works once.
    expect(await json(await call(R.session.POST!, { body: { phone: "03005550001", code: sent.testCode } }))).toMatchObject({ status: 400, code: "expired" })
  })

  it("brings in every booking made with the number, with no other proof", async () => {
    const guest = await json(await call(R.submit.POST!, { body: { type: "booking", data: { name: "Maryam", phone: "03005550002", area: "dha", address: "House 1", date: day(3), window: "3–5 pm", payment: "cash", items: [item], total: 0 } } }))
    expect(guest.status).toBe(200)
    const s = await signIn("03005550002")
    expect(s).toMatchObject({ status: 200, isNew: false, customer: { name: "Maryam" } })
    const list = await json(await call(R.bookings.GET!, { token: s.token }))
    expect(list.upcoming.map((b: { id: string }) => b.id)).toEqual([guest.id])
  })

  it("refuses numbers that aren't Pakistani mobiles, a second code within 30 seconds, and forged tokens", async () => {
    expect(await askCode("12345")).toMatchObject({ status: 400, code: "phone" })
    expect(await askCode("+44 7700 900123")).toMatchObject({ status: 400, code: "phone" })
    expect((await askCode("03005550003")).status).toBe(200)
    const again = await askCode("03005550003")
    expect(again).toMatchObject({ status: 429, code: "wait" })
    expect(again.retryIn).toBeGreaterThan(0)
    expect(again.retryIn).toBeLessThanOrEqual(30)
    expect((await call(R.me.GET!, { token: "mjs.forged.x" })).status).toBe(401)
  })

  it("signs every device out with Sign out everywhere", async () => {
    const s = await signIn("03005550004")
    expect((await call(R.me.GET!, { token: s.token })).status).toBe(200)
    expect((await call(R.sessions.DELETE!, { method: "DELETE", token: s.token })).status).toBe(200)
    expect((await call(R.me.GET!, { token: s.token })).status).toBe(401)
  })

  it("tells the apps how codes can go", async () => {
    expect(await json(await call(R.config.GET!))).toMatchObject({ phoneSignIn: { whatsapp: false, sms: false, test: true } })
  })
})

describe("the limits on codes", () => {
  const at = (s: number) => new Date(Date.UTC(2026, 9, 23, 6, 0, s))
  it("allows a new code every 30 seconds, 5 an hour and 10 a day for a number; the newest code is the only one that works", async () => {
    const { newCode, useCode } = await import("@/lib/core/phone-sign-in")
    const first = await newCode(db, { phone: "03006660001", channel: "test", now: at(0) })
    await expect(newCode(db, { phone: "03006660001", channel: "test", now: at(10) })).rejects.toMatchObject({ code: "wait", retryIn: 20 })
    const second = await newCode(db, { phone: "03006660001", channel: "test", now: at(31) })
    if (first.code !== second.code) await expect(useCode(db, { phone: "03006660001", code: first.code!, now: at(40) })).rejects.toMatchObject({ code: "wrong" })
    for (const s of [62, 93, 124]) await newCode(db, { phone: "03006660001", channel: "test", now: at(s) })
    await expect(newCode(db, { phone: "03006660001", channel: "test", now: at(155) })).rejects.toMatchObject({ code: "limit" })
    // An hour later, five more; then the day's ten are used up.
    for (const s of [3700, 3731, 3762, 3793, 3824]) await newCode(db, { phone: "03006660001", channel: "test", now: at(s) })
    await expect(newCode(db, { phone: "03006660001", channel: "test", now: at(7600) })).rejects.toMatchObject({ code: "limit" })
  })

  it("allows 20 codes an hour from one internet address", async () => {
    const { newCode } = await import("@/lib/core/phone-sign-in")
    for (let i = 0; i < 20; i++) await newCode(db, { phone: `0300777${String(i).padStart(4, "0")}`, channel: "test", ip: "203.0.113.9", now: at(i) })
    await expect(newCode(db, { phone: "03007779999", channel: "test", ip: "203.0.113.9", now: at(30) })).rejects.toMatchObject({ code: "limit" })
    await newCode(db, { phone: "03007779999", channel: "test", ip: "203.0.113.10", now: at(30) })
  })

  it("pauses codes for the whole site after 300 in an hour, and clears codes older than two days", async () => {
    const { newCode } = await import("@/lib/core/phone-sign-in")
    const day3 = (s: number) => new Date(Date.UTC(2026, 9, 26, 6, 0, s))
    await db.query("insert into phone_codes (id, phone, channel, code_hash, created_at, expires_at) select 'PC-BULK' || g, '0301' || lpad(g::text, 7, '0'), 'test', 'x', $1, $1 from generate_series(1, 300) g", [day3(0).toISOString()])
    await expect(newCode(db, { phone: "03018880001", channel: "test", now: day3(60) })).rejects.toMatchObject({ code: "limit" })
    // Two days on, the old rows are gone and codes flow again.
    await newCode(db, { phone: "03018880001", channel: "test", now: new Date(day3(0).getTime() + 2 * 86400_000 + 60_000) })
    expect((await db.one<{ n: number }>("select count(*)::int as n from phone_codes where id like 'PC-BULK%'"))!.n).toBe(0)
  })

  it("takes 5 tries, then even the right code is refused; and a code lasts 10 minutes", async () => {
    const { newCode, useCode } = await import("@/lib/core/phone-sign-in")
    const c = await newCode(db, { phone: "03006660002", channel: "test", now: at(0) })
    const wrong = c.code === "999999" ? "888888" : "999999"
    for (let i = 0; i < 4; i++) await expect(useCode(db, { phone: "03006660002", code: wrong, now: at(5) })).rejects.toMatchObject({ code: "wrong" })
    await expect(useCode(db, { phone: "03006660002", code: wrong, now: at(5) })).rejects.toMatchObject({ code: "tries" })
    await expect(useCode(db, { phone: "03006660002", code: c.code!, now: at(6) })).rejects.toMatchObject({ code: "tries" })
    const d = await newCode(db, { phone: "03006660003", channel: "test", now: at(0) })
    await expect(useCode(db, { phone: "03006660003", code: d.code!, now: at(601) })).rejects.toMatchObject({ code: "expired" })
    const e = await newCode(db, { phone: "03006660004", channel: "test", now: at(0) })
    expect(await useCode(db, { phone: "0300 6660004", code: e.code!, now: at(599) })).toBe("03006660004")
  })
})

describe("sending the code", () => {
  type Sent = { url: string; body: string }
  const provider = (fail: { whatsapp?: boolean } = {}) => {
    const sent: Sent[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const body = String(init.body)
        sent.push({ url, body })
        if (url.includes("graph.facebook.com")) return fail.whatsapp ? new Response(JSON.stringify({ error: { message: "Not a WhatsApp number" } }), { status: 400 }) : new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }))
        if (url.endsWith("/Verifications")) return new Response(JSON.stringify({ sid: "VE1", status: "pending" }), { status: 201 })
        if (url.endsWith("/VerificationCheck")) return new Response(JSON.stringify({ status: new URLSearchParams(body).get("Code") === "424242" ? "approved" : "pending" }))
        return new Response("{}", { status: 404 })
      }),
    )
    return sent
  }

  it("sends it on WhatsApp as the authentication template, with the code in its text and its copy button", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "wa-token")
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1234")
    vi.stubEnv("WHATSAPP_OTP_TEMPLATE", "mjazo_code")
    vi.stubEnv("WHATSAPP_OTP_LANGS", "en,ur")
    const sent = provider()
    const r = await askCode("03005550005", { lang: "ur" })
    expect(r).toMatchObject({ status: 200, via: "whatsapp" })
    expect(r.testCode).toBeUndefined()
    const msg = JSON.parse(sent[0].body)
    expect(sent[0].url).toContain("/1234/messages")
    expect(msg).toMatchObject({ to: "923005550005", type: "template", template: { name: "mjazo_code", language: { code: "ur" } } })
    const code = msg.template.components[0].parameters[0].text
    expect(code).toMatch(/^\d{6}$/)
    expect(msg.template.components[1]).toMatchObject({ type: "button", sub_type: "url", parameters: [{ text: code }] })
    expect(await json(await call(R.session.POST!, { body: { phone: "03005550005", code } }))).toMatchObject({ status: 200, isNew: true })
  })

  it("offers SMS when WhatsApp fails, and checks an SMS code with Twilio Verify", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "wa-token")
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1234")
    vi.stubEnv("WHATSAPP_OTP_TEMPLATE", "mjazo_code")
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC1")
    vi.stubEnv("TWILIO_AUTH_TOKEN", "secret")
    vi.stubEnv("TWILIO_VERIFY_SID", "VA1")
    const sent = provider({ whatsapp: true })
    expect(await askCode("03005550006")).toMatchObject({ status: 400, code: "send", error: expect.stringContaining("SMS") })
    // The failed send doesn't count, so SMS can be asked for at once.
    expect(await askCode("03005550006", { via: "sms" })).toMatchObject({ status: 200, via: "sms" })
    const v = sent.find((s) => s.url.endsWith("/Verifications"))!
    expect(v.url).toContain("/Services/VA1/")
    expect(Object.fromEntries(new URLSearchParams(v.body))).toEqual({ To: "+923005550006", Channel: "sms" })
    expect(await json(await call(R.session.POST!, { body: { phone: "03005550006", code: "111111" } }))).toMatchObject({ status: 400, code: "wrong" })
    expect(await json(await call(R.session.POST!, { body: { phone: "03005550006", code: "424242" } }))).toMatchObject({ status: 200, customer: { phone: "03005550006" } })
  })

  it("is off in production until WhatsApp or Twilio is set up", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("SESSION_SECRET", "a-production-secret")
    expect(await askCode("03005550007")).toMatchObject({ status: 403, code: "off" })
    expect(await json(await call(R.config.GET!))).toMatchObject({ phoneSignIn: null })
  })
})

describe("adding a number to an emailed sign-in", () => {
  it("takes the code sent to the number as proof that its bookings are theirs", async () => {
    const guest = await json(await call(R.submit.POST!, { body: { type: "booking", data: { name: "Sadia", phone: "03005550008", area: "dha", address: "House 2", date: day(4), window: "3–5 pm", payment: "cash", items: [item], total: 0 } } }))
    expect(guest.status).toBe(200)
    const t = (await json(await call(R.dev.POST!, { body: { email: "sadia@example.com" } }))).token
    expect(await json(await call(R.link.POST!, { token: t, body: { name: "Sadia", phone: "03005550008" } }))).toMatchObject({ status: 400, code: "proof" })
    const sent = await askCode("03005550008")
    expect(await json(await call(R.link.POST!, { token: t, body: { name: "Sadia", phone: "03005550008", code: "000000" === sent.testCode ? "111111" : "000000" } }))).toMatchObject({ status: 400, code: "wrong" })
    const ok = await json(await call(R.link.POST!, { token: t, body: { name: "Sadia", phone: "03005550008", code: sent.testCode } }))
    expect(ok).toMatchObject({ status: 200, customer: { phone: "03005550008", email: "sadia@example.com" } })
    expect((await json(await call(R.bookings.GET!, { token: t }))).upcoming.map((b: { id: string }) => b.id)).toEqual([guest.id])
  })

  it("leaves a phone sign-in's number as it is", async () => {
    const s = await signIn("03005550010")
    expect(await json(await call(R.link.POST!, { token: s.token, body: { name: "Zara", phone: "03005550010" } }))).toMatchObject({ status: 200, customer: { phone: "03005550010" } })
    expect(await json(await call(R.link.POST!, { token: s.token, body: { name: "Zara", phone: "03005550011" } }))).toMatchObject({ status: 400, code: "hasPhone" })
  })
})
