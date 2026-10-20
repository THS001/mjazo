import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { isoTimestamp, type Db } from "./db"
import { testCore } from "./test-db"

let db: Db & { close(): Promise<void> }
beforeAll(async () => {
  db = await testCore()
}, 60_000)
afterAll(() => db?.close())

describe("core schema", () => {
  it("creates every core table", async () => {
    const rows = await db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public'")
    const names = rows.map((r) => r.table_name)
    for (const t of ["customers", "zones", "addresses", "pros", "pro_availability", "bookings", "booking_items", "booking_events", "booking_payments", "booking_ratings", "ledger_accounts", "journal_entries", "postings", "payouts", "promo_codes", "promo_redemptions", "events", "notifications", "audit_log"]) {
      expect(names).toContain(t)
    }
  })

  it("parses dates, timestamps and big numbers into plain values", async () => {
    const r = await db.one<{ d: string; t: string; n: number }>("select date '2026-10-21' as d, timestamptz '2026-10-21 08:00:00+05' as t, 12345678901::int8 as n")
    expect(r).toEqual({ d: "2026-10-21", t: "2026-10-21T03:00:00.000Z", n: 12345678901 })
  })

  it("reads Postgres timestamps in any offset form", () => {
    expect(isoTimestamp("2026-10-21 08:00:00.123456+00")).toBe("2026-10-21T08:00:00.123Z")
    expect(isoTimestamp("2026-10-21 13:00:00+05:00")).toBe("2026-10-21T08:00:00.000Z")
  })
})

describe("ledger guards in the database", () => {
  const account = (id: string, kind: string) => db.query("insert into ledger_accounts (id, kind, name) values ($1, $2, $1) on conflict do nothing", [id, kind])

  it("rejects a journal entry that doesn't balance", async () => {
    await account("t:a", "asset")
    await account("t:b", "revenue")
    await expect(
      db.tx(async (t) => {
        const e = await t.one<{ id: number }>("insert into journal_entries (kind) values ('test') returning id")
        await t.query("insert into postings (entry_id, account_id, amount) values ($1, 't:a', 100), ($1, 't:b', -90)", [e!.id])
      }),
    ).rejects.toThrow(/does not balance/)
    expect(await db.query("select * from journal_entries where kind = 'test'")).toHaveLength(0)
  })

  it("accepts a balanced entry and refuses to edit it afterwards", async () => {
    const id = await db.tx(async (t) => {
      const e = await t.one<{ id: number }>("insert into journal_entries (kind) values ('test2') returning id")
      await t.query("insert into postings (entry_id, account_id, amount) values ($1, 't:a', 100), ($1, 't:b', -100)", [e!.id])
      return e!.id
    })
    await expect(db.query("update postings set amount = 5 where entry_id = $1", [id])).rejects.toThrow(/append-only/)
    await expect(db.query("delete from journal_entries where id = $1", [id])).rejects.toThrow(/append-only/)
  })

  it("rolls back everything when a transaction fails", async () => {
    await expect(
      db.tx(async (t) => {
        await t.query("insert into zones (slug, name) values ('rollback-test', 'x')")
        throw new Error("boom")
      }),
    ).rejects.toThrow("boom")
    expect(await db.one("select * from zones where slug = 'rollback-test'")).toBeNull()
  })
})
