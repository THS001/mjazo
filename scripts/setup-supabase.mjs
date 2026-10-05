// Setup for the Mjazo site's database and background jobs. The owner runs it in their own terminal:
//
//   node scripts/setup-supabase.mjs          (asks which steps to run)
//   node scripts/setup-supabase.mjs --cron   (only the scheduled-jobs step)
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
// Afterwards: redeploy, so the site picks the settings up.

import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import readline from "node:readline"
import pg from "pg"

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

/** A yes/no question; Enter picks the default. */
async function yes(question, byDefault) {
  const a = (await ask(`${question} ${byDefault ? "(Y/n)" : "(y/N)"} `)).toLowerCase()
  return a ? a.startsWith("y") : byDefault
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
    say(`  Couldn't reach the database directly (${err?.code ?? err?.message}).`)
    say("  In Supabase, click Connect → Session pooler and copy the connection string.")
    const url = await ask("  Paste it here, with your password in place of [YOUR-PASSWORD]: ", true)
    const pooled = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 })
    await pooled.connect().catch((e) => fail(`Still couldn't connect: ${e.message}`))
    return pooled
  }
}

// ---------------------------------------------------------------------------
// Step 1: Supabase
// ---------------------------------------------------------------------------

async function setupSupabase() {
  say("\nSupabase")
  const password = process.env.SUPABASE_DB_PASSWORD || (await ask("Database password: ", true))
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || (await askKey("Publishable key", "sb_publishable_"))
  const secret = process.env.SUPABASE_SECRET_KEY || (await askKey("Secret key", "sb_secret_"))

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

say("Mjazo setup")
say(`Site: ${SITE} · Supabase: ${SUPABASE_URL}`)
say("Nothing you paste is shown or saved to a file.")

const who = vercel("whoami")
if (!who.out.includes(VERCEL_ACCOUNT)) fail(`The Vercel CLI isn't signed in as ${VERCEL_ACCOUNT}. Run "npx vercel login" with that account first.`)
const env = vercel("env ls production").out
const has = (name) => new RegExp(`^\\s*${name}\\s`, "m").test(env)

const cronOnly = process.argv.includes("--cron")
let changed = false
if (!cronOnly) {
  if (!has("SUPABASE_SERVICE_ROLE_KEY") || (await yes("\nSupabase is already set up in Vercel. Set it up again?", false))) {
    await setupSupabase()
    changed = true
  }
}
if (cronOnly || (await yes("\nSet up scheduled publishing and the other background jobs (CRON_SECRET)?", true))) changed = (await setupCron(has("CRON_SECRET"))) || changed

say(changed ? "\nDone. Tell Claude it worked: it redeploys the site so the new settings take effect." : "\nNothing changed.")
