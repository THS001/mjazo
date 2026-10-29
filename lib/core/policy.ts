import "server-only"
import type { Db } from "./db"
import { writeAudit } from "./audit"
import { InputError } from "./errors"
import { DEFAULT_GUARANTEE, DEFAULT_PAIR_RATE, DEFAULT_TAX, guaranteeProblems, pairRateProblems, taxProblems, taxTermsOn, type GuaranteePolicy, type PairRatePolicy, type TaxPolicy, type TaxTerms } from "@/lib/ops/policy"
import { DEFAULT_MINIMUM, minimumProblems, type MinimumPolicy } from "@/lib/ops/minimum"
import { karachiNow } from "@/lib/time"

// The money policies (lib/ops/policy.ts, lib/ops/minimum.ts), one row each in core_meta
// ("policy:<key>"). Finance or an Owner changes them in mission control → Money → Policies; every
// change is in the audit log.

type Policies = { tax: TaxPolicy; pair_rate: PairRatePolicy; guarantee: GuaranteePolicy; pro_minimum: MinimumPolicy }
export type PolicyKey = keyof Policies

const DEFAULTS: { [K in PolicyKey]: Policies[K] } = { tax: DEFAULT_TAX, pair_rate: DEFAULT_PAIR_RATE, guarantee: DEFAULT_GUARANTEE, pro_minimum: DEFAULT_MINIMUM }
const PROBLEMS: { [K in PolicyKey]: (p: Partial<Policies[K]>) => string[] } = { tax: taxProblems, pair_rate: pairRateProblems, guarantee: guaranteeProblems, pro_minimum: minimumProblems }
const LABELS: Record<PolicyKey, string> = { tax: "sales tax", pair_rate: "regular customer rate", guarantee: "favourite-pro guarantee", pro_minimum: "pros' weekly minimum" }
const metaKey = (k: PolicyKey) => `policy:${k}`

export async function policy<K extends PolicyKey>(db: Db, key: K): Promise<Policies[K]> {
  const r = await db.one<{ value: Partial<Policies[K]> | null }>("select value from core_meta where key = $1", [metaKey(key)])
  return { ...DEFAULTS[key], ...(r?.value ?? {}) }
}

/** Changes a policy (only the fields given). */
export async function savePolicy<K extends PolicyKey>(db: Db, key: K, patch: Partial<Policies[K]>, actor: string): Promise<Policies[K]> {
  // Rates are kept to four decimal places (7% typed as 7 / 100 is 0.07000000000000001).
  const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined).map(([k, v]) => [k, k === "rate" && typeof v === "number" ? Math.round(v * 10000) / 10000 : v])) as Partial<Policies[K]>
  const problem = PROBLEMS[key](given)[0]
  if (problem) throw new InputError(problem)
  return db.tx(async (t) => {
    await t.query("insert into core_meta (key, value) values ($1, $2::jsonb) on conflict (key) do nothing", [metaKey(key), JSON.stringify(DEFAULTS[key])])
    const row = await t.one<{ value: Partial<Policies[K]> | null }>("select value from core_meta where key = $1 for update", [metaKey(key)])
    const next = { ...DEFAULTS[key], ...(row?.value ?? {}), ...given }
    await t.query("update core_meta set value = $2::jsonb, at = now() where key = $1", [metaKey(key), JSON.stringify(next)])
    await writeAudit(t, { actor, action: `changed the ${LABELS[key]} policy`, target: key, detail: JSON.stringify(given) })
    return next
  })
}

/**
 * Whether migration 0014 has run (the tax columns and receipts). Until it has, sales tax and
 * receipts are simply off and bookings are made as before. Remembered once it's there.
 */
let ready = false
export async function receiptsReady(db: Db) {
  if (ready) return true
  ready = Boolean((await db.one<{ ok: boolean }>("select to_regclass('public.receipts') is not null as ok"))?.ok)
  return ready
}

/** The sales tax a booking made now carries, or null (none, or migration 0014 not run yet). */
export async function bookingTaxTerms(db: Db, now?: Date): Promise<TaxTerms | null> {
  if (!(await receiptsReady(db))) return null
  return taxTermsOn(await policy(db, "tax"), karachiNow(now).date)
}
