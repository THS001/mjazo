import { openLite, setCoreForTests } from "./db"

/** A fresh in-memory core database with the schema applied, made the current core for this test file. */
export async function testCore() {
  const db = await openLite()
  setCoreForTests(db)
  return db
}
