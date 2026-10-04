import "server-only"
import type Anthropic from "@anthropic-ai/sdk"
import { formatDuration, formatPKR, type Catalog } from "@/lib/catalog"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { karachiNow, nextDays, windowAvailable, WINDOW_LABELS } from "@/lib/time"
import { PK_PHONE, saveSubmission, ValidationError } from "@/lib/server/store"

// Tools the Concierge can call. Every price, slot and policy comes from here (the catalogue and
// the rulebook), never from the model. Results go back to the model as JSON; `ui` carries things
// the website should render or do (service cards, cart additions, a created booking).

export type CardData = { category: string; service: string; name: string; categoryName: string; price: number; duration: number; short: string; hasOptions: boolean; url: string }
export type UiAction =
  | { type: "cards"; cards: CardData[] }
  | { type: "cart_add"; item: { category: string; categoryName: string; service: string; name: string; options: string[]; addOns: { id: string; name: string; price: number }[]; unitPrice: number; duration: number }; qty: number }
  | { type: "booking"; booking: Record<string, unknown> & { id: string } }
  | { type: "handoff"; reason: string }

export type ToolOutcome = { result: unknown; ui?: UiAction[] }
export type Channel = "web" | "whatsapp"

const itemSchema = {
  type: "object",
  properties: {
    category: { type: "string", description: "Category slug, e.g. womens-salon" },
    service: { type: "string", description: "Service slug, e.g. full-body-wax" },
    options: { type: "array", items: { type: "string" }, description: "Chosen option label for each variant, in order (e.g. ['Rica (peel-off)']). Omit to use the first option of each variant." },
    addOns: { type: "array", items: { type: "string" }, description: "Add-on ids from get_service" },
    qty: { type: "integer", minimum: 1, maximum: 6, description: "Number of people" },
  },
  required: ["category", "service"],
} as const

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_services",
    description: "Search the Mjazo catalogue by what the customer wants (any language, e.g. 'waxing', 'AC thanda nahi kar raha', 'mehndi'). Returns matching services with all-in prices. Use before recommending anything.",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 8 } }, required: ["query"] },
  },
  {
    name: "get_service",
    description: "Full details for one service: variants with price changes, add-ons, what's included, duration.",
    input_schema: { type: "object", properties: { category: { type: "string" }, service: { type: "string" } }, required: ["category", "service"] },
  },
  {
    name: "list_areas",
    description: "Karachi neighbourhoods and sub-areas Mjazo covers.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_time_windows",
    description: "Bookable dates (next 7 days, Karachi time) and two-hour arrival windows for a date. Windows too soon to reach are marked unavailable.",
    input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD; omit to list the next 7 days" } } },
  },
  {
    name: "get_policies",
    description: "Payment methods, minimum order, cancellation/changes, redo guarantee, Plus membership and referral terms.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "quote",
    description: "Price a list of services exactly (variants, add-ons, people) and check the minimum order. Use this to show the customer a total before booking.",
    input_schema: { type: "object", properties: { items: { type: "array", items: itemSchema, minItems: 1 } }, required: ["items"] },
  },
  {
    name: "add_to_cart",
    description: "Website only: put priced services into the customer's cart so they can check out themselves.",
    input_schema: { type: "object", properties: { items: { type: "array", items: itemSchema, minItems: 1 } }, required: ["items"] },
  },
  {
    name: "create_booking",
    description: "Place a booking. ONLY call after you have shown the customer a full summary (services, date, window, address, total, payment) and they have explicitly said yes.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string", description: "Pakistani mobile, e.g. 03001234567" },
        area: { type: "string", description: "Area slug from list_areas, e.g. dha" },
        subArea: { type: "string" },
        address: { type: "string", description: "House number and street" },
        landmark: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        window: { type: "string", description: "Exact window label from get_time_windows" },
        payment: { type: "string", enum: ["cash", "jazzcash", "easypaisa", "raast"] },
        notes: { type: "string" },
        items: { type: "array", items: itemSchema, minItems: 1 },
      },
      required: ["name", "phone", "area", "address", "date", "window", "payment", "items"],
    },
  },
  {
    name: "handoff_to_human",
    description: "Hand the conversation to a person on the Mjazo team: when the customer asks for a human, is upset, has a safety concern, a complaint, a refund, a medical question, or anything outside these tools.",
    input_schema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
  },
]

type ItemInput = { category: string; service: string; options?: string[]; addOns?: string[]; qty?: number }

/** Prices items strictly from the catalogue; unknown options/add-ons are reported, not guessed. */
function priceItems(items: ItemInput[], { getService }: Catalog) {
  const priced = []
  const problems: string[] = []
  for (const it of items) {
    const found = getService(it.category, it.service)
    if (!found) {
      problems.push(`Unknown service ${it.category}/${it.service}`)
      continue
    }
    const { category, service } = found
    if (category.status !== "live") problems.push(`${service.name} is not bookable yet`)
    if (service.price <= 0) problems.push(`${service.name} is priced on request; offer a quote via WhatsApp instead`)
    const variants = service.variants ?? []
    const options = variants.map((v, i) => {
      const wanted = it.options?.[i]
      const match = wanted ? v.options.find((o) => o.label.toLowerCase() === wanted.toLowerCase()) : undefined
      if (wanted && !match) problems.push(`"${wanted}" is not an option for ${v.label}; options are ${v.options.map((o) => o.label).join(", ")}`)
      return match ?? v.options[0]
    })
    const addOns = (it.addOns ?? []).map((id) => {
      const a = service.addOns?.find((x) => x.id === id)
      if (!a) problems.push(`Unknown add-on ${id} for ${service.name}`)
      return a
    }).filter(Boolean) as { id: string; name: string; price: number }[]
    const unitPrice = service.price + options.reduce((s, o) => s + o.delta, 0) + addOns.reduce((s, a) => s + a.price, 0)
    const qty = Math.min(6, Math.max(1, it.qty ?? 1))
    priced.push({ category, service, options: options.map((o) => o.label), addOns, unitPrice, qty })
  }
  const total = priced.reduce((s, p) => s + p.unitPrice * p.qty, 0)
  return { priced, problems, total }
}

const card = (c: NonNullable<ReturnType<Catalog["getService"]>>): CardData => ({
  category: c.category.slug,
  service: c.service.slug,
  name: c.service.name,
  categoryName: c.category.name,
  price: c.service.price,
  duration: c.service.duration,
  short: c.service.short,
  hasOptions: Boolean(c.service.variants?.length || c.service.addOns?.length),
  url: `/services/${c.category.slug}/${c.service.slug}`,
})

export async function runTool(name: string, input: Record<string, unknown>, ctx: { channel: Channel; attribution?: Record<string, unknown> }): Promise<ToolOutcome> {
  const cat = await getCatalog()
  const { MIN_ORDER, areas, getArea, getService, searchServices, visibleCategories } = cat
  const { site, policy, plus, referral, flags } = await getSettings()
  switch (name) {
    case "search_services": {
      const hits = searchServices(String(input.query ?? "")).slice(0, Number(input.limit ?? 6))
      const found = hits.map((h) => {
        const [, , cat, svc] = h.href.split("/")
        return getService(cat, svc)!
      }).filter(Boolean)
      if (!found.length) return { result: { matches: [], hint: `No direct match. Categories: ${visibleCategories.map((c) => `${c.name} (${c.slug})`).join(", ")}` } }
      const cards = found.map(card)
      return {
        result: { matches: cards.map((c) => ({ category: c.category, service: c.service, name: c.name, from: formatPKR(c.price), duration: formatDuration(c.duration), hasOptions: c.hasOptions })) },
        ui: [{ type: "cards", cards: cards.slice(0, 4) }],
      }
    }
    case "get_service": {
      const f = getService(String(input.category), String(input.service))
      if (!f) return { result: { error: "Not found. Use search_services first." } }
      const { category, service } = f
      return {
        result: {
          name: service.name,
          category: category.name,
          bookable: category.status === "live",
          price: service.price > 0 ? formatPKR(service.price) : "On request",
          duration: formatDuration(service.duration),
          description: service.short,
          variants: service.variants?.map((v) => ({ label: v.label, options: v.options.map((o) => ({ label: o.label, change: o.delta })) })) ?? [],
          addOns: service.addOns?.map((a) => ({ id: a.id, name: a.name, price: a.price })) ?? [],
          included: [...(service.includes ?? []), ...category.includes],
          notIncluded: category.excludes,
          pros: category.proType === "women" ? "Women-only pros" : "Verified technicians",
          url: `${site.url}/services/${category.slug}/${service.slug}`,
        },
        ui: [{ type: "cards", cards: [card(f)] }],
      }
    }
    case "list_areas":
      return { result: { areas: areas.map((a) => ({ slug: a.slug, name: a.name, subAreas: a.subAreas })) } }
    case "get_time_windows": {
      const days = nextDays(7)
      const date = input.date ? String(input.date) : null
      if (!date) return { result: { today: karachiNow().date, dates: days.map((d) => `${d.iso} (${d.label})`), windows: WINDOW_LABELS } }
      if (!days.some((d) => d.iso === date)) return { result: { error: `Bookable dates are ${days[0].iso} to ${days[6].iso}.` } }
      return { result: { date, windows: WINDOW_LABELS.map((w, i) => ({ window: w, available: windowAvailable(date, i, policy.leadHours) })) } }
    }
    case "get_policies":
      return {
        result: {
          payment: "Pay after the service: cash, JazzCash, Easypaisa or Raast. Nothing is paid at booking. No card payments.",
          minimumOrder: `${formatPKR(MIN_ORDER)} per visit`,
          visitFee: "None. Prices are all-in.",
          changes: `Free cancel or reschedule up to ${policy.freeChangeHours} hours before the slot; later changes may carry ${policy.lateFee}.`,
          redo: `Not happy? Tell us within ${policy.redoHours} hours for a free redo.`,
          beautyPros: "Every beauty and spa pro is a woman, CNIC-verified, background-checked and trained.",
          plus: `Mjazo Plus: ${formatPKR(plus.price)} a ${plus.period}, ${Math.round(plus.discount * 100)}% off every booking. Join at ${site.url}/plus`,
          referral: `Friends get ${formatPKR(referral.friendOff)} off their first booking with your link; you get ${formatPKR(referral.youGet)} credit. ${site.url}/refer`,
          onlinePayments: flags.ONLINE_PAYMENTS ? "available" : "not offered",
        },
      }
    case "quote":
    case "add_to_cart": {
      const items = (input.items as ItemInput[]) ?? []
      const { priced, problems, total } = priceItems(items, cat)
      const lines = priced.map((p) => ({ name: p.service.name, options: p.options, addOns: p.addOns.map((a) => a.name), people: p.qty, each: formatPKR(p.unitPrice), subtotal: formatPKR(p.unitPrice * p.qty) }))
      const result = { lines, total: formatPKR(total), meetsMinimum: total >= MIN_ORDER, minimum: formatPKR(MIN_ORDER), problems }
      if (name === "quote" || ctx.channel !== "web" || problems.length) return { result }
      return {
        result: { ...result, added: true },
        ui: priced.map((p) => ({
          type: "cart_add" as const,
          qty: p.qty,
          item: { category: p.category.slug, categoryName: p.category.name, service: p.service.slug, name: p.service.name, options: p.options, addOns: p.addOns, unitPrice: p.unitPrice, duration: p.service.duration },
        })),
      }
    }
    case "create_booking": {
      const items = (input.items as ItemInput[]) ?? []
      const { priced, problems, total } = priceItems(items, cat)
      const errs = [...problems]
      const area = getArea(String(input.area ?? ""))
      if (!area || area.status !== "live") errs.push(`Area must be one of: ${areas.filter((a) => a.status === "live").map((a) => a.slug).join(", ")}`)
      const phone = String(input.phone ?? "").replace(/[\s-]/g, "")
      if (!PK_PHONE.test(phone)) errs.push("Phone must be a Pakistani mobile like 03001234567")
      const date = String(input.date ?? "")
      const days = nextDays(7)
      if (!days.some((d) => d.iso === date)) errs.push(`Date must be between ${days[0].iso} and ${days[6].iso}`)
      const wi = WINDOW_LABELS.indexOf(String(input.window ?? ""))
      if (wi < 0) errs.push(`Window must be one of: ${WINDOW_LABELS.join(", ")}`)
      else if (!windowAvailable(date, wi, policy.leadHours)) errs.push("That window is too soon to reach; pick a later one")
      if (total < MIN_ORDER) errs.push(`Total ${formatPKR(total)} is below the ${formatPKR(MIN_ORDER)} minimum`)
      if (errs.length) return { result: { booked: false, fix: errs } }
      const data = {
        name: String(input.name),
        phone,
        area: area!.slug,
        subArea: input.subArea ? String(input.subArea) : undefined,
        address: String(input.address),
        landmark: input.landmark ? String(input.landmark) : undefined,
        date,
        window: WINDOW_LABELS[wi],
        payment: String(input.payment) as "cash",
        notes: [input.notes ? String(input.notes) : "", "Booked via Mjazo Concierge (AI)"].filter(Boolean).join(" · "),
        items: priced.map((p) => ({ name: p.service.name, category: p.category.slug, service: p.service.slug, options: p.options, addOns: p.addOns.map((a) => a.name), qty: p.qty, unitPrice: p.unitPrice })),
        total,
        channel: ctx.channel === "web" ? ("concierge-web" as const) : ("concierge-whatsapp" as const),
      }
      try {
        const { id } = await saveSubmission("booking", data, ctx.attribution ?? {}, "concierge")
        return {
          result: { booked: true, id, total: formatPKR(total), next: "Tell the customer the booking reference, that the team confirms on WhatsApp, and that they pay after the service." },
          ui: [{ type: "booking", booking: { id, ...data, areaName: area!.name, cartItems: priced.map((p) => ({ category: p.category.slug, categoryName: p.category.name, service: p.service.slug, name: p.service.name, options: p.options, addOns: p.addOns, unitPrice: p.unitPrice, duration: p.service.duration, qty: p.qty })) } }],
        }
      } catch (e) {
        if (e instanceof ValidationError) return { result: { booked: false, fix: [e.message] } }
        console.error("[concierge] booking failed", e)
        return { result: { booked: false, fix: ["The booking system is unavailable right now; offer to hand over to the team on WhatsApp."] } }
      }
    }
    case "handoff_to_human":
      return { result: { handedOff: true, say: "Tell the customer a person from the Mjazo team will take over on WhatsApp." }, ui: [{ type: "handoff", reason: String(input.reason ?? "") }] }
    default:
      return { result: { error: `Unknown tool ${name}` } }
  }
}

export function catalogueBrief({ worlds, visibleCategories }: Catalog) {
  return worlds
    .map((w) => `${w.name}: ${visibleCategories.filter((c) => c.world === w.slug).map((c) => `${c.name} [${c.slug}] (${c.proType === "women" ? "women-only pros" : "verified technicians"})`).join("; ")}`)
    .join("\n")
}
