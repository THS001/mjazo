import "server-only"
import type { Db } from "./db"
import { writeAudit } from "./audit"
import { InputError } from "./errors"
import { emit } from "./events"
import { customerBalances } from "./ledger"
import { coreId, normalisePhone } from "./phone"
import { inKarachi, zoneFor } from "@/lib/geo"

// Customer accounts. A customer signs in with an emailed link (a Supabase account) and then adds
// their phone number, which joins the account to the bookings made with that number. To stop
// anyone reading someone else's bookings by typing their number, a number that already has
// bookings is joined only with proof: a booking made on this device with that number, or a
// booking number from one of its confirmations. Also: saved addresses (with a map pin and the
// area it falls in) and wallet credit (the ledger's balance, less what open bookings have set
// aside).

export type Customer = { id: string; name: string; phone: string | null; email: string | null; lang: string; marketingOk: boolean }
type CustomerRow = { id: string; name: string; phone: string | null; email: string | null; lang: string; marketing_ok: boolean; auth_user_id: string | null }
const toCustomer = (r: CustomerRow): Customer => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, lang: r.lang, marketingOk: r.marketing_ok })

export class LinkError extends InputError {
  constructor(
    message: string,
    readonly code: "taken" | "proof" | "phone" | "hasPhone",
  ) {
    super(message)
  }
}

/** The customer behind a signed-in account, or null when they haven't added their number yet. */
export async function customerForAccount(db: Db, userId: string): Promise<Customer | null> {
  const r = await db.one<CustomerRow>("select * from customers where auth_user_id = $1", [userId])
  return r ? toCustomer(r) : null
}

const PHONE = /^03\d{9}$/

/**
 * Joins a signed-in account to a phone number (once). A number nobody has used yet starts a new
 * customer; a number with bookings needs `proof`: booking ids that belong to it (saved on the
 * device, or typed from a confirmation).
 */
export async function linkAccount(db: Db, a: { userId: string; email: string; name: string; phone: string; proof?: string[] }): Promise<Customer> {
  const phone = normalisePhone(a.phone)
  if (!PHONE.test(phone)) throw new LinkError("Enter a Pakistani mobile number (03xx xxxxxxx)", "phone")
  const name = a.name.trim().slice(0, 80)
  const email = a.email.trim().toLowerCase()
  return db.tx(async (t) => {
    const mine = await t.one<CustomerRow>("select * from customers where auth_user_id = $1 for update", [a.userId])
    if (mine) {
      if (mine.phone === phone) return toCustomer(mine)
      throw new LinkError("Your account already has a number. To change it, message us on WhatsApp.", "hasPhone")
    }
    const existing = await t.one<CustomerRow>("select * from customers where phone = $1 for update", [phone])
    // The email belongs to this account from now on (an older customer row may have had it).
    await t.query("update customers set email = null where lower(email) = $1 and (auth_user_id is null or auth_user_id <> $2)", [email, a.userId])
    let id: string
    if (!existing) {
      id = coreId("C")
      await t.query("insert into customers (id, phone, email, name, auth_user_id) values ($1, $2, $3, $4, $5)", [id, phone, email, name, a.userId])
    } else {
      if (existing.auth_user_id && existing.auth_user_id !== a.userId) throw new LinkError("This number is already on another Mjazo account. Message us on WhatsApp if it's yours.", "taken")
      const has = (await t.one<{ n: number }>("select count(*)::int as n from bookings where customer_id = $1", [existing.id]))!.n
      const proof = (a.proof ?? []).map((x) => x.trim().toUpperCase()).filter(Boolean).slice(0, 50)
      const proven = proof.length ? (await t.one<{ n: number }>("select count(*)::int as n from bookings where customer_id = $1 and upper(id) = any($2::text[])", [existing.id, proof]))!.n : 0
      if (has && !proven) throw new LinkError("This number already has bookings. Enter a booking number from one of its confirmations (MJ-…) to show it's yours.", "proof")
      id = existing.id
      await t.query("update customers set auth_user_id = $2, email = $3, name = case when name = '' then $4 else name end, updated_at = now() where id = $1", [id, a.userId, email, name])
    }
    await emit(t, "customer.linked", { customerId: id }, { existing: Boolean(existing) })
    await writeAudit(t, { actor: `customer:${id}`, action: existing ? "joined their account to their number" : "made an account", target: id })
    return toCustomer((await t.one<CustomerRow>("select * from customers where id = $1", [id]))!)
  })
}

export async function updateCustomer(db: Db, id: string, p: { name?: string; lang?: string; marketingOk?: boolean }) {
  if (p.name !== undefined && p.name.trim().length < 2) throw new InputError("Enter your name")
  if (p.lang !== undefined && !["en", "ur"].includes(p.lang)) throw new InputError("Pick a language")
  await db.query("update customers set name = coalesce($2, name), lang = coalesce($3, lang), marketing_ok = coalesce($4, marketing_ok), updated_at = now() where id = $1", [id, p.name?.trim().slice(0, 80) ?? null, p.lang ?? null, p.marketingOk ?? null])
  return toCustomer((await db.one<CustomerRow>("select * from customers where id = $1", [id]))!)
}

// ---------------------------------------------------------------------------
// Wallet credit
// ---------------------------------------------------------------------------

const OPEN = "('new', 'assigned', 'en_route', 'checked_in', 'checked_out')"

/** Their credit in the ledger, and what's left after open bookings set theirs aside. */
export async function creditFor(db: Db, customerId: string) {
  const { credit } = await customerBalances(db, customerId)
  const held = (await db.one<{ n: number }>(`select coalesce(sum(credit_used), 0)::int as n from bookings where customer_id = $1 and status in ${OPEN}`, [customerId]))!.n
  return { balance: Math.max(0, credit), available: Math.max(0, credit - held) }
}

// ---------------------------------------------------------------------------
// Saved addresses
// ---------------------------------------------------------------------------

export type Address = { id: string; label: string | null; area: string; subArea: string | null; line: string; landmark: string | null; lat: number | null; lng: number | null; isDefault: boolean }
type AddressRow = { id: string; customer_id: string; label: string | null; zone: string; sub_area: string | null; line: string; landmark: string | null; lat: number | null; lng: number | null; is_default: boolean }
const toAddress = (r: AddressRow): Address => ({ id: r.id, label: r.label, area: r.zone, subArea: r.sub_area, line: r.line, landmark: r.landmark, lat: r.lat, lng: r.lng, isDefault: r.is_default })

export type AddressInput = { label?: string | null; area?: string; subArea?: string | null; line: string; landmark?: string | null; lat?: number | null; lng?: number | null; isDefault?: boolean }

/**
 * Checks an address and works out its area: from the map pin when there is one (it must be inside
 * an area we cover), otherwise the area picked. `areas`: the live areas.
 */
export function addressArea(a: AddressInput, areas: string[]): string {
  if (a.line.trim().length < 5) throw new InputError("Enter the house, street and block")
  if (a.lat != null && a.lng != null) {
    if (!inKarachi(a.lat, a.lng)) throw new InputError("That pin isn't in Karachi")
    const zone = zoneFor(a.lat, a.lng, areas)
    if (!zone) throw new InputError("We don't cover that spot yet")
    return zone
  }
  if (!a.area || !areas.includes(a.area)) throw new InputError("Pick your area")
  return a.area
}

export const listAddresses = async (db: Db, customerId: string) => (await db.query<AddressRow>("select * from addresses where customer_id = $1 order by is_default desc, created_at desc", [customerId])).map(toAddress)

/** Adds an address (`id` missing) or changes one of theirs. At most 10; one is the default. */
export async function saveAddress(db: Db, customerId: string, a: AddressInput & { id?: string }, areas: string[]): Promise<Address> {
  const zone = addressArea(a, areas)
  return db.tx(async (t) => {
    if (a.id && !(await t.one("select 1 from addresses where id = $1 and customer_id = $2 for update", [a.id, customerId]))) throw new InputError("Address not found")
    if (!a.id && (await t.one<{ n: number }>("select count(*)::int as n from addresses where customer_id = $1", [customerId]))!.n >= 10) throw new InputError("You can save up to 10 addresses")
    const first = !(await t.one("select 1 from addresses where customer_id = $1", [customerId]))
    const isDefault = Boolean(a.isDefault) || first
    if (isDefault) await t.query("update addresses set is_default = false where customer_id = $1", [customerId])
    const vals = [a.label?.trim().slice(0, 40) || null, zone, a.subArea?.trim().slice(0, 60) || null, a.line.trim().slice(0, 200), a.landmark?.trim().slice(0, 120) || null, a.lat ?? null, a.lng ?? null, isDefault]
    const row = a.id
      ? await t.one<AddressRow>("update addresses set label = $3, zone = $4, sub_area = $5, line = $6, landmark = $7, lat = $8, lng = $9, is_default = $10 where id = $1 and customer_id = $2 returning *", [a.id, customerId, ...vals])
      : await t.one<AddressRow>("insert into addresses (id, customer_id, label, zone, sub_area, line, landmark, lat, lng, is_default) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *", [coreId("AD"), customerId, ...vals])
    return toAddress(row!)
  })
}

export async function deleteAddress(db: Db, customerId: string, id: string) {
  const gone = await db.one<{ is_default: boolean }>("delete from addresses where id = $1 and customer_id = $2 returning is_default", [id, customerId])
  if (!gone) throw new InputError("Address not found")
  // Another one becomes the default.
  if (gone.is_default) await db.query("update addresses set is_default = true where id = (select id from addresses where customer_id = $1 order by created_at desc limit 1)", [customerId])
}

export async function getAddress(db: Db, customerId: string, id: string) {
  const r = await db.one<AddressRow>("select * from addresses where id = $1 and customer_id = $2", [id, customerId])
  return r ? toAddress(r) : null
}
