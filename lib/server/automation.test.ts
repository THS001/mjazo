import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { Db } from "@/lib/core/db"
import type { Job, Pro } from "@/lib/ops/types"

// Automation (stage 5) on a real (in-memory) core database: booking messages from the outbox (in
// the customer's language, once each, never about the past), the day-before reminder and "rate
// your visit" at their hours, auto-assign offering the visit pro by pro (verified only) and telling
// ops when nobody is left, the Monday payout draft, the opt-in Home Pulse and win-back messages
// (quiet hours, at most 2 a month, STOP), and delivery by WhatsApp and push with retries.

const mem = vi.hoisted(() => ({ docs: new Map<string, Map<string, unknown>>(), ops: [] as string[], pulse: [] as { created_at: string; data: Record<string, unknown> }[], after: [] as Promise<unknown>[] }))

// The WhatsApp webhook answers first and works after the response: run that work in the test.
vi.mock("next/server", async (orig) => ({ ...(await orig<object>()), after: (fn: () => Promise<unknown>) => void mem.after.push(fn()) }))

vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [] }) }))
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
  listSubmissions: async () => mem.pulse,
  notifyOps: async (subject: string) => void mem.ops.push(subject),
}))
vi.mock("@/lib/cms/read", async () => {
  const { buildCatalog, DEFAULT_CATALOG } = await import("@/lib/catalog")
  const { MESSAGES, MESSAGES_UR } = await import("@/lib/cms/types/messages")
  const cat = buildCatalog(DEFAULT_CATALOG)
  return { getCatalog: async () => cat, getSettings: async () => ({ referral: { friendOff: 500 }, policy: { leadHours: 2, freeChangeHours: 3 } }), getMessages: async (l: string) => (l === "ur" ? MESSAGES_UR : MESSAGES) }
})

type Note = { id: number; rule: string; channel: string; recipient: string; template: string; body: string; params: string[]; lang: string; status: string; attempts: number; error: string | null; provider_id: string | null; booking_id: string | null; dedupe_key: string }

let db: Db & { close(): Promise<void> }
let A: typeof import("./automation")
let S: typeof import("@/lib/core/automation")
let cj: typeof import("@/lib/core/jobs")
let today: string

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
/** A moment, Karachi time. */
const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+05:00`)
const item = { name: "Full body wax", category: "womens-salon", service: "full-body-wax", options: [], addOns: [], qty: 1, unitPrice: 0 }
let n = 0
const book = async (o: { date?: string; window?: string; phone?: string; name?: string } = {}) => {
  const { getCatalog } = await import("@/lib/cms/read")
  n++
  return cj.createBooking(db, { id: `MJ-AU${n}`, name: o.name ?? "Ayesha Khan", phone: o.phone ?? `0301${String(1000000 + n)}`, area: "dha", address: "House 7, Street 3", date: o.date ?? addDays(today, 3), window: o.window ?? "3–5 pm", payment: "cash", items: [item] }, await getCatalog())
}
const notes = (where: string, vals: unknown[] = []) => db.query<Note>(`select * from notifications where ${where} order by id`, vals)
const forBooking = (id: string, rule?: string) => notes(rule ? "booking_id = $1 and rule = $2" : "booking_id = $1", rule ? [id, rule] : [id])
const customerOf = async (bookingId: string) => (await db.one<{ customer_id: string }>("select customer_id from bookings where id = $1", [bookingId]))!.customer_id
const rule = (key: string, enabled: boolean, config: Record<string, unknown> = {}) => S.saveRule(db, key, { enabled, config }, "owner@mjazo.test")

/** A visit through to done: assigned, on the way, in, out, completed (cash), at the given times. */
async function complete(id: string, proId: string, doneAt = new Date()) {
  const steps: [Job["events"][number]["type"], Job["status"]][] = [
    ["assigned", "assigned"],
    ["en_route", "en_route"],
    ["checked_in", "checked_in"],
    ["checked_out", "checked_out"],
    ["completed", "completed"],
  ]
  for (const [type, status] of steps)
    await cj.mutateJob(db, id, (j) => {
      if (type === "assigned") j.proId = proId
      j.status = status
      j.events.push({ type, at: (type === "completed" ? doneAt : new Date(doneAt.getTime() - 60_000)).toISOString(), by: type === "assigned" ? "ops" : "pro", actor: "test" })
      if (type === "completed") j.paymentRecord = { amount: j.total, method: "cash", at: doneAt.toISOString(), status: "cash" }
    })
}

const verified = Object.fromEntries(["cnic", "references", "address", "practical", "training", "conduct"].map((k) => [k, { by: "ops@mjazo.test", at: new Date().toISOString() }])) as Pro["verification"]
const pro = (id: string, name: string, phone: string): Pro => ({ id, name, phone, area: "dha", skills: ["womens-salon"], women: true, status: "active", createdAt: new Date().toISOString() })

beforeAll(async () => {
  const { testCore } = await import("@/lib/core/test-db")
  db = await testCore()
  A = await import("./automation")
  S = await import("@/lib/core/automation")
  cj = await import("@/lib/core/jobs")
  today = (await import("@/lib/time")).karachiNow().date
  await cj.savePro(db, pro("P-SANA", "Sana Bibi", "03111111111"))
  await cj.savePro(db, pro("P-HINA", "Hina Malik", "03122222222"))
  await cj.savePro(db, pro("P-NEW", "Rabia New", "03133333333"))
  // Verification is kept apart from the profile (mission control → Trust).
  await db.query("update pros set verification = $1::jsonb where id in ('P-SANA', 'P-HINA')", [JSON.stringify(verified)])
}, 180_000)
afterAll(() => db?.close())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("booking messages", () => {
  it("confirms a new booking once, logged in test mode, in the customer's words", async () => {
    const b = await book({ name: "Ayesha Khan" })
    const r = await A.runAutomation()
    expect(r?.testMode).toBe(true)
    const [m, ...more] = await forBooking(b.id, "confirm")
    expect(more).toHaveLength(0)
    expect(m).toMatchObject({ channel: "log", status: "logged", recipient: b.customer.phone, lang: "en", template: "bookingConfirmed" })
    expect(m.body).toContain("Ayesha")
    expect(m.body).toContain(b.id)
    // WhatsApp's {{1}}…{{6}}: name, services, date, window, id, link.
    expect(m.params[0]).toBe("Ayesha")
    expect(m.params[4]).toBe(b.id)
    await A.runAutomation()
    expect(await forBooking(b.id, "confirm")).toHaveLength(1)
    // The same reason never queues twice.
    expect(await S.queueMessage(db, { rule: "confirm", dedupeKey: `confirm:${b.id}`, channel: "log", recipient: "x", template: "t", body: "b", lang: "en" })).toBeNull()
  })

  it("writes in Urdu to a customer who uses the site in Urdu", async () => {
    // Their second booking: the customer (by phone) is set to Urdu before it's handled.
    const first = await book({ phone: "03019999999" })
    await A.runAutomation()
    await db.query("update customers set lang = 'ur' where id = $1", [await customerOf(first.id)])
    const b = await book({ phone: "03019999999" })
    await A.runAutomation()
    const [m] = await forBooking(b.id, "confirm")
    expect(m.lang).toBe("ur")
    expect(m.body).toMatch(/[؀-ۿ]/)
  })

  it("doesn't message anyone about an event from long ago", async () => {
    const b = await book()
    await A.runAutomation(new Date(Date.now() + 7 * 3600_000))
    expect(await forBooking(b.id, "confirm")).toHaveLength(0)
    expect(await db.one("select 1 from events where booking_id = $1 and processed_at is null", [b.id])).toBeNull()
  })

  it("tells the customer her pro is on the way", async () => {
    const b = await book()
    await A.runAutomation()
    await cj.mutateJob(db, b.id, (j) => {
      j.proId = "P-SANA"
      j.status = "assigned"
    })
    await cj.mutateJob(db, b.id, (j) => {
      j.status = "en_route"
      j.eta = "15:40"
    })
    await A.runAutomation()
    const [m] = await forBooking(b.id, "onTheWay")
    expect(m.body).toContain("Sana")
    expect(m.body).toContain("3:40 pm")
  })

  it("is quiet when a rule is switched off", async () => {
    await rule("confirm", false)
    const b = await book()
    await A.runAutomation()
    expect(await forBooking(b.id)).toHaveLength(0)
    await rule("confirm", true)
  })
})

describe("on a timer", () => {
  it("reminds the evening before the visit, from 6 pm", async () => {
    const b = await book({ date: addDays(today, 1) })
    await A.runAutomation(at(today, 15))
    expect(await forBooking(b.id, "reminder")).toHaveLength(0)
    await A.runAutomation(at(today, 19))
    await A.runAutomation(at(today, 20))
    const r = await forBooking(b.id, "reminder")
    expect(r).toHaveLength(1)
    expect(r[0].dedupe_key).toBe(`reminder:${b.id}:${b.date}`)
  })

  it("asks for a rating two hours after the visit, in the daytime, if it isn't rated", async () => {
    const b = await book({ date: today })
    await complete(b.id, "P-SANA", at(today, 11))
    await A.runAutomation(at(today, 12))
    expect(await forBooking(b.id, "rateVisit")).toHaveLength(0)
    await A.runAutomation(at(today, 14))
    const [m] = await forBooking(b.id, "rateVisit")
    expect(m.body).toContain(`/rate?id=${b.id}`)
    // A rated visit isn't asked again (another rated one isn't asked at all).
    const rated = await book({ date: today })
    await complete(rated.id, "P-SANA", at(today, 11))
    await cj.mutateJob(db, rated.id, (j) => void (j.rating = { stars: 5, tags: [], at: new Date().toISOString() }))
    await A.runAutomation(at(today, 15))
    expect(await forBooking(rated.id, "rateVisit")).toHaveLength(0)
  })

  it("drafts last week's payout run on Monday from 9 am, once", async () => {
    const b = await book({ date: today })
    await complete(b.id, "P-NEW")
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay()
    const monday = addDays(today, (8 - dow) % 7 || 7)
    const r1 = await A.runAutomation(at(monday, 8))
    expect(r1?.scheduled.payoutRun).toBeUndefined()
    const r2 = await A.runAutomation(at(monday, 10))
    expect(String(r2?.scheduled.payoutRun)).toMatch(/^PR/)
    expect(mem.ops.some((s) => s.includes("ready to approve"))).toBe(true)
    expect(await db.one("select 1 from core_meta where key = $1", [`payout-week:${addDays(monday, -1)}`])).not.toBeNull()
    const r3 = await A.runAutomation(at(monday, 11))
    expect(r3?.scheduled.payoutRun).toBeUndefined()
  })
})

describe("opt-in messages", () => {
  it("Home Pulse: what's due, in the daytime, at most twice a month, never after STOP", async () => {
    await rule("pulseNudges", true)
    const plan = [0, 1, 2].map((d) => `${addDays(today, d)} · Clean the AC filters ${d}`)
    mem.pulse = [{ created_at: new Date().toISOString(), data: { kind: "pulse", phone: "0300-1112233", name: "Hina Ali", details: { lang: "en", plan } } }]
    await A.runAutomation(at(today, 21))
    expect(await notes("rule = 'pulseNudges'")).toHaveLength(0)
    await A.runAutomation(at(today, 11))
    await A.runAutomation(at(addDays(today, 1), 11))
    await A.runAutomation(at(addDays(today, 2), 11))
    const sent = await notes("rule = 'pulseNudges'")
    expect(sent.map((m) => m.body.match(/filters \d/)?.[0])).toEqual(["filters 0", "filters 1"])
    expect(sent[0].recipient).toBe("03001112233")

    // Another number said STOP: nothing, until they switch messages back on.
    mem.pulse.push({ created_at: new Date().toISOString(), data: { kind: "pulse", phone: "03004445566", name: "Zara", details: { lang: "ur", plan: [`${addDays(today, 3)} · Geyser service`] } } })
    await S.optOut(db, "03004445566", "whatsapp")
    await A.runAutomation(at(addDays(today, 3), 11))
    expect(await notes("recipient = '03004445566'")).toHaveLength(0)
    await S.optIn(db, "03004445566")
    await A.runAutomation(at(addDays(today, 3), 12))
    const [z] = await notes("recipient = '03004445566'")
    expect(z.lang).toBe("ur")
    expect(z.body).toContain("Geyser service")
    await rule("pulseNudges", false)
  })

  it("a WhatsApp reply of STOP turns them off for that number", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "test-token")
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345")
    const replies: string[] = []
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      replies.push((JSON.parse(String(init.body)) as { text: { body: string } }).text.body)
      return new Response("{}", { status: 200 })
    })
    const { POST } = await import("../../app/api/whatsapp/route")
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.stop-1", from: "923007778899", type: "text", text: { body: " Stop " } }] } }] }] }
    const res = await POST(new Request("http://localhost/api/whatsapp", { method: "POST", body: JSON.stringify(payload) }))
    expect(res.status).toBe(200)
    await Promise.all(mem.after)
    expect(await S.optedOut(db, "03007778899")).toBe(true)
    expect(replies[0]).toMatch(/no more reminders or offers/)
  })

  it("win-back: only to customers who said yes, at 60 and 90 days", async () => {
    await rule("winBack", true)
    const yes = await book({ phone: "03005550001", name: "Mehwish" })
    const no = await book({ phone: "03005550002" })
    await A.runAutomation()
    for (const [b, ok, uid] of [
      [yes, true, "00000000-0000-0000-0000-000000000001"],
      [no, false, "00000000-0000-0000-0000-000000000002"],
    ] as const) {
      await db.query("update bookings set status = 'completed', day = $2 where id = $1", [b.id, addDays(today, -65)])
      await db.query("update customers set marketing_ok = $2, auth_user_id = $3 where id = $1", [await customerOf(b.id), ok, uid])
    }
    await A.runAutomation(at(today, 11))
    await A.runAutomation(at(today, 12))
    const w = await notes("rule = 'winBack'")
    expect(w.map((m) => [m.recipient, m.template])).toEqual([["03005550001", "winBack60"]])
    expect(w[0].body).toContain("Mehwish")
    await db.query("update bookings set day = $2 where id = $1", [yes.id, addDays(today, -95)])
    await A.runAutomation(at(today, 13))
    expect((await notes("rule = 'winBack'")).map((m) => m.template)).toEqual(["winBack60", "winBack90"])
    // STOP: no more.
    await S.optOut(db, "03005550001", "whatsapp")
    expect((await db.one<{ marketing_ok: boolean }>("select marketing_ok from customers where id = $1", [await customerOf(yes.id)]))!.marketing_ok).toBe(false)
    await rule("winBack", false)
  })
})

describe("auto-assign", () => {
  it("offers the visit to the best verified pro, the next after a decline, then tells ops", async () => {
    // Both verified pros have the Pro app: their offers go as pushes.
    const pushes: string[] = []
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (!String(url).includes("exp.host")) throw new Error(`unexpected ${url}`)
      pushes.push(...(JSON.parse(String(init.body)) as { to: string }[]).map((p) => p.to))
      return new Response(JSON.stringify({ data: [{ status: "ok", id: "push-1" }] }), { status: 200 })
    })
    await S.savePushToken(db, { token: "ExponentPushToken[sana]", ownerType: "pro", ownerId: "P-SANA" })
    await S.savePushToken(db, { token: "ExponentPushToken[hina]", ownerType: "pro", ownerId: "P-HINA" })
    await rule("autoAssign", true, { mode: "auto" })
    const { listOffers, answerOffer } = await import("@/lib/core/offers")
    const b = await book({ date: addDays(today, 5), window: "11 am–1 pm" })
    await A.runAutomation()
    const first = (await listOffers(db, { bookingIds: [b.id] })).find((o) => o.status === "pending")!
    expect(["P-SANA", "P-HINA"]).toContain(first.proId)
    await answerOffer(db, { offerId: first.id, proId: first.proId, accept: false, reason: "Busy" })
    await A.runAutomation()
    const second = (await listOffers(db, { bookingIds: [b.id] })).find((o) => o.status === "pending")!
    expect(second.proId).toBe(first.proId === "P-SANA" ? "P-HINA" : "P-SANA")
    // Each offer reached her phone.
    const sent = await forBooking(b.id, "proOffer")
    expect(sent.map((m) => [m.channel, m.status])).toEqual([
      ["push", "sent"],
      ["push", "sent"],
    ])
    expect(pushes.sort()).toEqual(["ExponentPushToken[hina]", "ExponentPushToken[sana]"])
    // The unverified pro is never offered it: with both verified pros declined, ops hear.
    await answerOffer(db, { offerId: second.id, proId: second.proId, accept: false })
    await A.runAutomation()
    expect((await listOffers(db, { bookingIds: [b.id] })).some((o) => o.proId === "P-NEW")).toBe(false)
    expect(mem.ops.filter((s) => s === `[Mjazo] Needs a pro: ${b.id}`)).toHaveLength(1)
    await A.runAutomation()
    expect(mem.ops.filter((s) => s === `[Mjazo] Needs a pro: ${b.id}`)).toHaveLength(1)
  })

  it("suggests the best pro on the board without offering", async () => {
    await rule("autoAssign", true, { mode: "suggest" })
    const b = await book({ date: addDays(today, 6) })
    await A.runAutomation()
    const { listOffers } = await import("@/lib/core/offers")
    expect(await listOffers(db, { bookingIds: [b.id] })).toHaveLength(0)
    const job = (await cj.getJob(db, b.id))!
    const s = await A.boardSuggestions([job], await cj.listPros(db))
    expect(s.mode).toBe("suggest")
    expect(s.byJob[b.id].proId).toMatch(/^P-/)
    await rule("autoAssign", false)
    expect((await A.boardSuggestions([job], await cj.listPros(db))).mode).toBe("off")
  })
})

describe("sending by WhatsApp", () => {
  it("sends the template with its parameters, and retries a failure up to 3 times", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "test-token")
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345")
    await rule("confirm", true, { waTemplates: { bookingConfirmed: "booking_confirmed" } })
    let fail = false
    const calls: { url: string; body: { to: string; template: { name: string; components: { parameters: { text: string }[] }[] } } }[] = []
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init.body)) })
      return fail ? new Response(JSON.stringify({ error: { message: "Template not found" } }), { status: 400 }) : new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 })
    })
    const b = await book({ phone: "0302-7654321", name: "Nida Shah" })
    const r = await A.runAutomation()
    expect(r?.testMode).toBe(false)
    const [m] = await forBooking(b.id, "confirm")
    expect(m).toMatchObject({ channel: "whatsapp", status: "sent", provider_id: "wamid.1", template: "booking_confirmed" })
    const call = calls.find((c) => c.body.to === "923027654321")!
    expect(call.url).toContain("/12345/messages")
    expect(call.body.template.name).toBe("booking_confirmed")
    expect(call.body.template.components[0].parameters[0].text).toBe("Nida")

    fail = true
    const b2 = await book()
    await A.runAutomation()
    expect((await forBooking(b2.id, "confirm"))[0]).toMatchObject({ status: "queued", attempts: 1, error: "Template not found" })
    await A.runAutomation()
    await A.runAutomation()
    expect((await forBooking(b2.id, "confirm"))[0]).toMatchObject({ status: "failed", attempts: 3 })
    await A.runAutomation()
    expect((await forBooking(b2.id, "confirm"))[0].attempts).toBe(3)
    await rule("confirm", true, { waTemplates: {} })
  })
})

describe("previews", () => {
  it("fills every message with sample details", async () => {
    const { MESSAGES, MESSAGES_UR } = await import("@/lib/cms/types/messages")
    for (const k of Object.keys(MESSAGES) as (keyof typeof MESSAGES)[])
      for (const texts of [MESSAGES, MESSAGES_UR]) {
        const p = A.previewMessage(texts, k)
        expect(p.text).not.toMatch(/\{\{/)
        expect(p.text.length).toBeGreaterThan(10)
      }
  })
})
