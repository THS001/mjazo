// Setup for the Mjazo site's database and background jobs. The owner runs it in their own terminal:
//
//   node scripts/setup-supabase.mjs          (asks which steps to run)
//   node scripts/setup-supabase.mjs --cron   (only the scheduled-jobs step)
//   node scripts/setup-supabase.mjs --migrate (only the core engine step: new tables + DATABASE_URL)
//
// Step 1, Supabase: asks for the database password and the two API keys. They're typed into this
// terminal only, never saved to a file. Then it creates the database tables (supabase/migrations,
// safe to run again), checks the site can read them with the keys, and adds the Supabase settings
// and the Owner emails to the Vercel project (production).
//
// Step 2, scheduled jobs: makes a random CRON_SECRET on this computer, stores it in Vercel as a
// Secret, and shows it once, to paste into a 5-minute pinger (scheduled publishing, Safety
// Guardian). The weekly SEO check needs no pinger: Vercel runs it and sends the secret itself.
//
// Step 3, core engine: runs any new migrations (bookings, the money ledger, …) and stores the
// database address the site uses for them (DATABASE_URL, Supabase's transaction pooler) in Vercel.
//
// Step 4, the pro app (/pro): makes its sign-in secret (SESSION_SECRET) on this computer and
// stores it in Vercel as a Secret, the first time only. --migrate offers it too.
//
// Afterwards: redeploy, so the site picks the settings up.

import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import pg from "pg"
import { ask } from "./prompt.mjs"

const PROJECT_REF = "xjyafabyscamelebzrsb"
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
const SITE = "https://mjazo.vercel.app"
const OWNERS = "mjazosupport@gmail.com,thehashirsukhera@gmail.com"
const VERCEL_ACCOUNT = "thehashirsukhera-8511"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const say = (s = "") => console.log(s)
const fail = (s) => {
  console.error(`\n✗ ${s}`)
  process.exit(1)
}

/** A secret (password, key, connection string): shown as *, and an empty Enter is ignored. */
const askSecret = (question) => ask(question, { hidden: true, required: true })

/** A yes/no question; Enter picks the default. */
async function yes(question, byDefault) {
  const a = (await ask(`${question} ${byDefault ? "(Y/n)" : "(y/N)"} `)).toLowerCase()
  return a ? a.startsWith("y") : byDefault
}

async function askKey(label, prefix) {
  for (;;) {
    const v = await askSecret(`${label} (starts with ${prefix}): `)
    if (v.startsWith(prefix) || v.startsWith("eyJ")) return v
    say(`  That doesn't look like the ${label.toLowerCase()}. It should start with ${prefix}. Try again.`)
  }
}

function vercel(args, input) {
  const r = spawnSync(`npx vercel ${args}`, { cwd: ROOT, input, encoding: "utf8", shell: true })
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` }
}

function addToVercel(name, value, sensitive) {
  const r = vercel(`env add ${name} production --force --yes ${sensitive ? "--sensitive" : "--no-sensitive"}`, value)
  if (!r.ok) fail(`Couldn't add ${name} to Vercel:\n${r.out.slice(-400)}`)
  say(`  ✓ ${name}${sensitive ? " (secret)" : ""}`)
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
    say(`  Couldn't reach the database directly (${err?.code ?? err?.message}). Trying Supabase's pooler…`)
    const found = await findPooler(password, 5432, "select 1")
    if (found) {
      const viaPooler = new pg.Client({ connectionString: found, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 })
      await viaPooler.connect().catch((e) => fail(`Couldn't connect through the pooler: ${e.message}`))
      say(`  ✓ Connected through ${new URL(found).hostname}`)
      return viaPooler
    }
    say("  In Supabase, click Connect → Session pooler and copy the connection string.")
    const url = await askSecret("  Paste it here, with your password in place of [YOUR-PASSWORD]: ")
    const pooled = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 })
    await pooled.connect().catch((e) => fail(`Still couldn't connect: ${e.message}`))
    return pooled
  }
}

/** Runs every migration in order; each is safe to run again. */
async function runMigrations(client) {
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
}

// ---------------------------------------------------------------------------
// Step 1: Supabase
// ---------------------------------------------------------------------------

async function setupSupabase() {
  say("\nSupabase")
  const password = process.env.SUPABASE_DB_PASSWORD || (await askSecret("Database password: "))
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || (await askKey("Publishable key", "sb_publishable_"))
  const secret = process.env.SUPABASE_SECRET_KEY || (await askKey("Secret key", "sb_secret_"))

  say("\n1. Creating the database tables")
  const client = await connect(password)
  await runMigrations(client)
  const { rows } = await client.query("select table_name from information_schema.tables where table_schema = 'public' order by 1")
  const bucket = await client.query("select id from storage.buckets where id = 'media'")
  say(`  Tables: ${rows.map((r) => r.table_name).join(", ")}`)
  say(`  Media storage bucket: ${bucket.rowCount ? "ready" : "missing"}`)
  // Let the API see the new tables straight away.
  await client.query("notify pgrst, 'reload schema'").catch(() => {})

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

  say("\n3. Adding the settings to Vercel (production)")
  addToVercel("SUPABASE_URL", SUPABASE_URL, false)
  addToVercel("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL, false)
  addToVercel("NEXT_PUBLIC_SUPABASE_ANON_KEY", publishable, false)
  addToVercel("SUPABASE_SERVICE_ROLE_KEY", secret, true)
  addToVercel("CMS_OWNER_EMAIL", OWNERS, false)
}

// ---------------------------------------------------------------------------
// Step 2: scheduled jobs (CRON_SECRET)
// ---------------------------------------------------------------------------

async function setupCron(exists) {
  say("\nScheduled jobs")
  if (exists && !(await yes("A CRON_SECRET is already set in Vercel. Replace it with a new one? Your pingers then need the new one too.", false))) return false
  // 32 random bytes: long enough that nobody can guess it, and safe to paste into a header.
  const secret = randomBytes(32).toString("base64url")
  addToVercel("CRON_SECRET", secret, true)
  say(`
Your CRON_SECRET (shown only now; Vercel keeps it as a Secret):

  ${secret}

Copy it, then set up a free 5-minute pinger, for example at https://cron-job.org:
  1. Create an account, then click "Create cronjob".
  2. URL:       ${SITE}/api/cron/cms-publish
  3. Schedule:  every 5 minutes
  4. Advanced → Headers → add one:
       Key:   Authorization
       Value: Bearer ${secret}
  5. Save. It should report "401 Unauthorized" until the site is redeployed, then "200 OK".
  6. Make a second cronjob the same way for ${SITE}/api/cron/safety
     (the Safety Guardian for the staff tools).

The weekly SEO check needs no pinger: Vercel runs it every Monday and sends the secret itself.
Keep the secret private: anyone with it can trigger these jobs (they can't change content).`)
  return true
}

// ---------------------------------------------------------------------------
// Step 3: the core engine (DATABASE_URL)
// ---------------------------------------------------------------------------

/** Why a pooler connection string doesn't work (null when it reaches the core tables). */
async function poolerProblem(url, probe = "select 1 from bookings limit 1") {
  const test = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 })
  try {
    await test.connect()
    await test.query(probe)
    return null
  } catch (e) {
    return e.message
  } finally {
    await test.end().catch(() => {})
  }
}

// Supabase pooler hosts are aws-0-<region> or aws-1-<region>; a wrong region answers "tenant not
// found" without trying the password, so trying them all is quick and harmless.
const POOLER_REGIONS = ["ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "me-central-1", "eu-central-1", "eu-central-2", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1", "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1", "sa-east-1"]

/** The project's transaction pooler string (with the password in it), or null if not found. */
async function findPooler(password, port = 6543, probe) {
  const urls = ["aws-0", "aws-1"].flatMap((p) => POOLER_REGIONS.map((r) => `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(password)}@${p}-${r}.pooler.supabase.com:${port}/postgres`))
  const results = await Promise.all(urls.map(async (url) => ((await poolerProblem(url, probe)) ? null : url)))
  return results.find(Boolean) ?? null
}

async function setupCore(exists) {
  say("\nCore engine (bookings, pros, the money ledger)")
  const replace = !exists || (await yes("DATABASE_URL is already set in Vercel. Replace it?", false))
  const password = process.env.SUPABASE_DB_PASSWORD || (await askSecret("Database password: "))

  say("\n1. Creating the new tables")
  const client = await connect(password)
  await runMigrations(client)
  const core = await client.query("select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name in ('bookings', 'postings', 'pros')")
  await client.end()
  if (core.rows[0].n !== 3) fail("The core tables weren't created. Send Claude the output above.")
  say("  ✓ Core tables ready")
  if (!replace) return true

  say("\n2. Finding the database address for the site (Supabase's transaction pooler)")
  let url = await findPooler(password)
  if (url) say(`  ✓ Found it: ${new URL(url).hostname}`)
  else
    say(`  Couldn't find it by itself.
   In Supabase, click Connect (top of the project page) → "Transaction pooler", and copy the
   connection string. It looks like:
     postgresql://postgres.${PROJECT_REF}:[YOUR-PASSWORD]@aws-0-….pooler.supabase.com:6543/postgres
   Paste it as it is, with [YOUR-PASSWORD] still in it: this script puts your password in.`)
  while (!url) {
    const pasted = await askSecret("  Transaction pooler string: ")
    if (!/^postgres(ql)?:\/\/.+:6543\//.test(pasted)) {
      say("  That isn't the transaction pooler string (it uses port 6543). Try again.")
      continue
    }
    const candidate = pasted.replace("[YOUR-PASSWORD]", encodeURIComponent(password))
    const problem = await poolerProblem(candidate)
    if (!problem) url = candidate
    else say(`  Couldn't use it (${problem}). Check it's the transaction pooler string and try again.`)
  }
  say("  ✓ The site can reach the core tables through the pooler")

  say("\n3. Adding the setting to Vercel (production)")
  addToVercel("DATABASE_URL", url, true)
  return true
}

// ---------------------------------------------------------------------------
// Step 4: the pro app (SESSION_SECRET)
// ---------------------------------------------------------------------------

async function setupProApp(exists) {
  if (exists) return false
  if (!(await yes("\nSwitch on the pro app (/pro)? It makes the app's sign-in secret (SESSION_SECRET) and stores it in Vercel.", true))) return false
  // Signs pros' sessions. Changing it later signs every pro out, so it's only made once.
  addToVercel("SESSION_SECRET", randomBytes(32).toString("base64url"), true)
  return true
}

// ---------------------------------------------------------------------------

say("Mjazo setup")
say(`Site: ${SITE} · Supabase: ${SUPABASE_URL}`)
say("Passwords and keys show as * while you type or paste them, and nothing is saved to a file.")

const who = vercel("whoami")
if (!who.out.includes(VERCEL_ACCOUNT)) fail(`The Vercel CLI isn't signed in as ${VERCEL_ACCOUNT}. Run "npx vercel login" with that account first.`)
const env = vercel("env ls production").out
const has = (name) => new RegExp(`^\\s*${name}\\s`, "m").test(env)

const cronOnly = process.argv.includes("--cron")
const migrateOnly = process.argv.includes("--migrate")
let changed = false
if (migrateOnly) {
  changed = await setupCore(has("DATABASE_URL"))
  changed = (await setupProApp(has("SESSION_SECRET"))) || changed
  say(changed ? "\nDone. Tell Claude it worked: it redeploys the site so the new settings take effect." : "\nNothing changed.")
  process.exit(0)
}
if (!cronOnly) {
  if (!has("SUPABASE_SERVICE_ROLE_KEY") || (await yes("\nSupabase is already set up in Vercel. Set it up again?", false))) {
    await setupSupabase()
    changed = true
  }
}
if (cronOnly || (await yes("\nSet up scheduled publishing and the other background jobs (CRON_SECRET)?", true))) changed = (await setupCron(has("CRON_SECRET"))) || changed
if (!cronOnly && (await yes("\nConnect the core engine (bookings, pros, the money ledger)?", true))) changed = (await setupCore(has("DATABASE_URL"))) || changed
if (!cronOnly) changed = (await setupProApp(has("SESSION_SECRET"))) || changed

say(changed ? "\nDone. Tell Claude it worked: it redeploys the site so the new settings take effect." : "\nNothing changed.")
