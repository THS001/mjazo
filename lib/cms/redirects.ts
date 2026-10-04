import "server-only"
import { db } from "@/lib/server/store"
import { ValidationError } from "./action"
import { addAudit } from "./store"
import { redirectIssues } from "./redirect-match"
import { listRedirects, matchRedirect, normalise, readLocal, writeLocal, type Redirect } from "./redirect-rules"

// Redirects (cms_redirects, migration 0004; .data/cms/redirects.json locally), applied by proxy.ts
// before any page renders. Sources are site paths without a locale; /ur/<source> redirects to
// /ur/<destination> automatically. A source ending in /* matches everything under it, and a * in
// the destination is replaced with the matched remainder.

export { listRedirects, matchRedirect, normalise, type Redirect }
type Actor = { id: string; name: string }

async function put(row: Redirect) {
  if (db) {
    const { error } = await db.from("cms_redirects").upsert(row, { onConflict: "source" })
    if (error) throw error
  } else await writeLocal([row, ...(await readLocal()).filter((x) => x.source !== row.source)])
}

async function drop(source: string) {
  if (db) {
    const { error } = await db.from("cms_redirects").delete().eq("source", source)
    if (error) throw error
  } else await writeLocal((await readLocal()).filter((x) => x.source !== source))
}

/**
 * Adds or updates a redirect after checking it can't loop, clash with the built-in redirects or
 * hijack the staff apps. `previous` is the old address of a redirect being edited. `auto` is for a
 * published item whose address changed: the item now lives at the destination, so redirects away
 * from it are removed and redirects to its old address are pointed straight at the new one.
 */
export async function saveRedirect(user: Actor, r: { source: string; destination: string; permanent?: boolean; note?: string | null; previous?: string | null }, opts: { auto?: boolean } = {}) {
  const source = normalise(r.source)
  const destination = normalise(r.destination)
  let rows = await listRedirects()
  if (opts.auto) {
    for (const x of rows.filter((x) => x.source === destination)) await drop(x.source)
    for (const x of rows.filter((x) => x.source !== destination && normalise(x.destination) === source)) await put({ ...x, destination })
    rows = await listRedirects()
  }
  const previous = r.previous ? normalise(r.previous) : null
  const others = rows.filter((x) => x.source !== previous)
  const issues = redirectIssues(r.source, r.destination, others)
  if (!opts.auto && previous !== source && others.some((x) => x.source === source)) issues.push(`There's already a redirect from ${source}. Edit that one instead.`)
  if (issues.length) throw new ValidationError(issues)
  const kept = rows.find((x) => x.source === (previous ?? source))
  const row: Redirect = { source, destination, permanent: r.permanent ?? true, hits: kept?.hits ?? 0, note: r.note?.slice(0, 200) || null, created_by: user.name, created_at: new Date().toISOString() }
  if (previous && previous !== source) await drop(previous)
  await put(row)
  await addAudit({ user_id: user.id, user_name: user.name, action: opts.auto ? "added a redirect (address changed)" : "saved a redirect", type: "redirect", entry_id: source, title: `${source} → ${destination}`, detail: null })
  return row
}

export async function deleteRedirect(user: Actor, source: string) {
  await drop(source)
  await addAudit({ user_id: user.id, user_name: user.name, action: "deleted a redirect", type: "redirect", entry_id: source, title: source, detail: null })
}
