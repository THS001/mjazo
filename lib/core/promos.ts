import "server-only"
import type { Db } from "./db"
import { InputError } from "./errors"

// Promo codes, managed in mission control. Checkout applies them from stage 4 (client account);
// until then a code can be set up, switched on or off, and its uses are shown here.

export type PromoInput = {
  code: string
  kind: "percent" | "fixed"
  value: number
  minOrder?: number
  maxDiscount?: number | null
  maxUses?: number | null
  perCustomer?: number
  startsAt?: string | null
  endsAt?: string | null
  active?: boolean
  note?: string
}

export type Promo = Required<Omit<PromoInput, "note">> & { note: string; createdAt: string; createdBy: string | null; updatedAt: string; updatedBy: string | null; uses: number; given: number }

export const normaliseCode = (c: string) => c.trim().toUpperCase()

/** What's wrong with a promo code, if anything. */
export function promoIssues(p: PromoInput): string[] {
  const issues: string[] = []
  if (!/^[A-Z0-9-]{3,20}$/.test(normaliseCode(p.code))) issues.push("A code is 3 to 20 letters, digits or dashes")
  if (!Number.isInteger(p.value) || p.value <= 0) issues.push("The value is a whole number above zero")
  else if (p.kind === "percent" && p.value > 90) issues.push("A percentage is at most 90")
  else if (p.kind === "fixed" && p.value > 50_000) issues.push("A fixed discount is at most PKR 50,000")
  for (const [v, label] of [
    [p.minOrder, "minimum order"],
    [p.maxDiscount, "largest discount"],
    [p.maxUses, "most uses"],
    [p.perCustomer, "uses per customer"],
  ] as const)
    if (v !== undefined && v !== null && (!Number.isInteger(v) || v < 0)) issues.push(`The ${label} is a whole number`)
  if (p.perCustomer !== undefined && p.perCustomer < 1) issues.push("Each customer can use it at least once")
  const start = p.startsAt ? Date.parse(p.startsAt) : null
  const end = p.endsAt ? Date.parse(p.endsAt) : null
  if ((p.startsAt && Number.isNaN(start)) || (p.endsAt && Number.isNaN(end))) issues.push("Dates don't look right")
  else if (start && end && end <= start) issues.push("It has to end after it starts")
  return issues
}

/** The discount a code gives on a subtotal now (0 when it doesn't apply). Uses are checked separately. */
export function promoDiscount(p: Pick<Promo, "kind" | "value" | "minOrder" | "maxDiscount" | "startsAt" | "endsAt" | "active">, subtotal: number, now = new Date()) {
  if (!p.active || subtotal < p.minOrder) return 0
  if (p.startsAt && now < new Date(p.startsAt)) return 0
  if (p.endsAt && now >= new Date(p.endsAt)) return 0
  const raw = p.kind === "percent" ? Math.round((subtotal * p.value) / 100) : p.value
  return Math.min(raw, p.maxDiscount ?? Infinity, subtotal)
}

type PromoRow = { code: string; kind: Promo["kind"]; value: number; min_order: number; max_discount: number | null; max_uses: number | null; per_customer: number; starts_at: string | null; ends_at: string | null; active: boolean; note: string | null; created_at: string; created_by: string | null; updated_at: string; updated_by: string | null; uses: number; given: number }

export async function listPromos(db: Db): Promise<Promo[]> {
  const rows = await db.query<PromoRow>(
    `select c.*, coalesce(r.uses, 0)::int as uses, coalesce(r.given, 0)::int as given
     from promo_codes c left join (select code, count(*) as uses, sum(amount) as given from promo_redemptions group by code) r on r.code = c.code
     order by c.active desc, c.created_at desc`,
  )
  return rows.map((r) => ({ code: r.code, kind: r.kind, value: r.value, minOrder: r.min_order, maxDiscount: r.max_discount, maxUses: r.max_uses, perCustomer: r.per_customer, startsAt: r.starts_at, endsAt: r.ends_at, active: r.active, note: r.note ?? "", createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by, uses: r.uses, given: r.given }))
}

/** Creates a code (`create`) or changes one. A code that has been used can't change its kind or value: make a new one. */
export async function savePromo(db: Db, p: PromoInput, by: string, create: boolean) {
  const issues = promoIssues(p)
  if (issues.length) throw new InputError(issues.join(". "))
  const code = normaliseCode(p.code)
  const vals = [code, p.kind, p.value, p.minOrder ?? 0, p.maxDiscount ?? null, p.maxUses ?? null, p.perCustomer ?? 1, p.startsAt || null, p.endsAt || null, p.active ?? true, p.note?.trim().slice(0, 300) || null, by]
  await db.tx(async (t) => {
    const cur = await t.one<{ kind: string; value: number }>("select kind, value from promo_codes where code = $1 for update", [code])
    if (create && cur) throw new InputError(`${code} already exists`)
    if (!create && !cur) throw new InputError(`${code} doesn't exist`)
    if (cur && (cur.kind !== p.kind || cur.value !== p.value) && (await t.one("select 1 from promo_redemptions where code = $1 limit 1", [code]))) throw new InputError("This code has been used, so its discount can't change. Switch it off and make a new one.")
    if (create)
      await t.query(
        "insert into promo_codes (code, kind, value, min_order, max_discount, max_uses, per_customer, starts_at, ends_at, active, note, created_by, updated_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)",
        vals,
      )
    else
      await t.query(
        "update promo_codes set kind = $2, value = $3, min_order = $4, max_discount = $5, max_uses = $6, per_customer = $7, starts_at = $8, ends_at = $9, active = $10, note = $11, updated_by = $12, updated_at = now() where code = $1",
        vals,
      )
  })
  return code
}

export type PromoProblem = "invalid" | "notYet" | "expired" | "minOrder" | "usedUp" | "used"

/** A promo code typed at checkout that can't be used (`problem` says why, for the customer's language). */
export class PromoError extends InputError {
  constructor(
    readonly problem: PromoProblem,
    readonly minOrder?: number,
  ) {
    super(problem === "minOrder" ? `This code needs an order of at least PKR ${minOrder}` : "This promo code can't be used")
  }
}
export type PromoCheck = { ok: true; code: string; discount: number } | { ok: false; code: string; problem: PromoProblem; minOrder?: number }

/**
 * Whether a code can be used on an order now, and what it takes off. Uses count only bookings that
 * weren't cancelled; `customerId` (the phone's or the account's customer) is checked against the
 * per-customer limit. The checkout shows the problem in the customer's language.
 */
export async function checkPromo(db: Db, raw: string, o: { subtotal: number; customerId?: string | null; now?: Date }): Promise<PromoCheck> {
  const code = normaliseCode(raw)
  const now = o.now ?? new Date()
  const p = await db.one<PromoRow>("select *, 0 as uses, 0 as given from promo_codes where code = $1", [code])
  if (!p || !p.active) return { ok: false, code, problem: "invalid" }
  if (p.starts_at && now < new Date(p.starts_at)) return { ok: false, code, problem: "notYet" }
  if (p.ends_at && now >= new Date(p.ends_at)) return { ok: false, code, problem: "expired" }
  if (o.subtotal < p.min_order) return { ok: false, code, problem: "minOrder", minOrder: p.min_order }
  const used = (sql: string, vals: unknown[]) => db.one<{ n: number }>(`select count(*)::int as n from promo_redemptions r join bookings b on b.id = r.booking_id where r.code = $1 and b.status <> 'cancelled'${sql}`, [code, ...vals])
  if (p.max_uses != null && (await used("", []))!.n >= p.max_uses) return { ok: false, code, problem: "usedUp" }
  if (o.customerId && (await used(" and r.customer_id = $2", [o.customerId]))!.n >= p.per_customer) return { ok: false, code, problem: "used" }
  const discount = promoDiscount({ kind: p.kind, value: p.value, minOrder: p.min_order, maxDiscount: p.max_discount, startsAt: p.starts_at, endsAt: p.ends_at, active: p.active }, o.subtotal, now)
  return discount > 0 ? { ok: true, code, discount } : { ok: false, code, problem: "invalid" }
}
