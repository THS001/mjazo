// One-time Supabase setup for the Mjazo site. The owner runs it in their own terminal, from website/:
//
//   node scripts/setup-supabase.mjs
//
// It asks for the database password and the two API keys. They're typed into this terminal only,
// never saved to a file. Then it:
//   1. creates the database tables (supabase/migrations/*.sql, safe to run again),
//   2. checks that the site can read them with the keys,
//   3. adds the Supabase settings and the Owner emails to the Vercel project (production).
// Afterwards: redeploy, so the site picks the settings up.

import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import readline from "node:readline"
import pg from "pg"

const PROJECT_REF = "xjyafabyscamelebzrsb"
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
const OWNERS = "mjazosupport@gmail.com,thehashirsukhera@gmail.com"
const VERCEL_ACCOUNT = "thehashirsukhera-8511"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const say = (s = "") => console.log(s)
const fail = (s) => {
  console.error(`\n✗ ${s}`)
  process.exit(1)
}

/** Asks in the terminal; with `hidden`, nothing typed or pasted is shown. */
function ask(question, hidden = false) {
  return new Promise((resolve) => {
    // The question is written first, so it shows even when everything typed after it is hidden.
    process.stdout.write(question)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) rl._writeToOutput = () => {}
    rl.question("", (answer) => {
      rl.close()
      if (hidden) process.stdout.write(" (received)\n")
      resolve(answer.trim())
    })
  })
}

async function askKey(label, prefix) {
  for (;;) {
    const v = await ask(`${label} (starts with ${prefix}): `, true)
    if (v.startsWith(prefix) || v.startsWith("eyJ")) return v
    say(`  That doesn't look like the ${label.toLowerCase()}. It should start with ${prefix}. Try again.`)
  }
}

function vercel(args, input) {
  const r = spawnSync(`npx vercel ${args}`, { cwd: ROOT, input, encoding: "utf8", shell: true })
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` }
}

/** The site's own read: the REST API with a key. */
async function rest(path, key) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers: { apikey: key, authorization: `Bearer ${key}` } })
  return { status: res.status, body: await res.text() }
}

async function connect(password) {
  const direct = new pg.Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    // Supabase signs its database certificate with its own authority, which Node doesn't know.
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  })
  try {
    await direct.connect()
    return direct
  } catch (err) {
    if (/password authentication failed/i.test(String(err?.message))) fail("Supabase says that database password is wrong. Reset it under Project Settings → Database, then run this again.")
    say(`  Couldn't reach the database directly (${err?.code ?? err?.message}).`)
    say("  In Supabase, click Connect → Session pooler and copy the connection string.")
    const url = await ask("  Paste it here, with your password in place of [YOUR-PASSWORD]: ", true)
    const pooled = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 })
    await pooled.connect().catch((e) => fail(`Still couldn't connect: ${e.message}`))
    return pooled
  }
}

say("Mjazo × Supabase setup")
say(`Project: ${SUPABASE_URL}`)
say("Nothing you paste is shown or saved to a file.\n")

const who = vercel("whoami")
if (!who.out.includes(VERCEL_ACCOUNT)) fail(`The Vercel CLI isn't signed in as ${VERCEL_ACCOUNT}. Run "npx vercel login" with that account first.`)

const password = process.env.SUPABASE_DB_PASSWORD || (await ask("Database password: ", true))
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || (await askKey("Publishable key", "sb_publishable_"))
const secret = process.env.SUPABASE_SECRET_KEY || (await askKey("Secret key", "sb_secret_"))

// 1. Tables
say("\n1. Creating the database tables")
const client = await connect(password)
const files = readdirSync(join(ROOT, "supabase", "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
for (const f of files) {
  const sql = readFileSync(join(ROOT, "supabase", "migrations", f), "utf8")
  try {
    await client.query("begin")
    await client.query(sql)
    await client.query("commit")
    say(`  ✓ ${f}`)
  } catch (err) {
    await client.query("rollback").catch(() => {})
    await client.end()
    fail(`${f} failed: ${err.message}`)
  }
}
const { rows } = await client.query("select table_name from information_schema.tables where table_schema = 'public' order by 1")
const bucket = await client.query("select id from storage.buckets where id = 'media'")
say(`  Tables: ${rows.map((r) => r.table_name).join(", ")}`)
say(`  Media storage bucket: ${bucket.rowCount ? "ready" : "missing"}`)
// Let the API see the new tables straight away.
await client.query("notify pgrst, 'reload schema'").catch(() => {})

// 2. The site's view, with the keys
say("\n2. Checking the keys")
let read = { status: 0, body: "" }
for (let i = 0; i < 5; i++) {
  read = await rest("/rest/v1/cms_entries?select=type&limit=1", secret)
  if (read.status === 200) break
  if (/permission denied/i.test(read.body)) {
    // Projects created with the Data API's automatic grants switched off: give the server's role access.
    await client.query("grant usage on schema public to service_role; grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role; notify pgrst, 'reload schema';")
  }
  await new Promise((r) => setTimeout(r, 2000))
}
await client.end()
if (read.status !== 200) fail(`The secret key can't read the tables (${read.status}): ${read.body.slice(0, 200)}`)
say("  ✓ Secret key reads the CMS tables")
const auth = await rest("/auth/v1/settings", publishable)
if (auth.status !== 200) fail(`The publishable key was refused (${auth.status}): ${auth.body.slice(0, 200)}`)
say("  ✓ Publishable key works for sign-in")

// 3. Vercel
say("\n3. Adding the settings to Vercel (production)")
const vars = [
  ["SUPABASE_URL", SUPABASE_URL, false],
  ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL, false],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", publishable, false],
  ["SUPABASE_SERVICE_ROLE_KEY", secret, true],
  ["CMS_OWNER_EMAIL", OWNERS, false],
]
for (const [name, value, sensitive] of vars) {
  const r = vercel(`env add ${name} production --force --yes ${sensitive ? "--sensitive" : "--no-sensitive"}`, value)
  if (!r.ok) fail(`Couldn't add ${name} to Vercel:\n${r.out.slice(-400)}`)
  say(`  ✓ ${name}${sensitive ? " (secret)" : ""}`)
}

say("\nDone. Supabase is set up and Vercel has the settings.")
say("Tell Claude it worked: it redeploys the site and checks sign-in.")
