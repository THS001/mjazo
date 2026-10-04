import "server-only"
import { db } from "@/lib/server/store"
import { ValidationError } from "./action"
import { addAudit } from "./store"
import { listRedirects, matchRedirect, normalise, readLocal, STAFF, writeLocal, type Redirect } from "./redirect-rules"

// Redirects (cms_redirects, migration 0004; .data/cms/redirects.json locally), applied by proxy.ts
// before any page renders. Sources are site paths without a locale; /ur/<source> redirects to
// /ur/<destination> automatically. A source ending in /* matches everything under it, and a * in
// the destination is replaced with the matched remainder.

export { listRedirects, matchRedirect, normalise, type Redirect }
type Actor = { id: string; name: string }

/** Adds or updates a redirect after checking it can't loop or hijack the staff apps. */
export async function saveRedirect(user: Actor, r: { source: string; destination: string; permanent?: boolean; note?: string | null }, opts: { auto?: boolean } = {}) {
  const source = normalise(r.source)
  const destination = normalise(r.destination)
  const issues: string[] = []
  if (/^https?:/i.test(source)) issues.push("The old address must be a path on this site, like /old-page.")
  if (source === "/") issues.push("The home page can't be redirected.")
  if (STAFF.test(source)) issues.push("Staff and system paths can't be redirected.")
  if (source === destination) issues.push("The old and new addresses are the same.")
  const rows = await listRedirects()
  // Following the new redirect must not lead back to its source.
  let hop: string | null = destination
  for (let i = 0; i < 10 && hop && !/^https?:/i.test(hop); i++) {
    if (hop === source) {
      issues.push("That would create a redirect loop.")
      break
    }
    hop = matchRedirect(hop, rows.filter((x) => x.source !== source))?.destination ?? null
  }
  if (issues.length) throw new ValidationError(issues)
  const row: Redirect = { source, destination, permanent: r.permanent ?? true, hits: rows.find((x) => x.source === source)?.hits ?? 0, note: r.note?.slice(0, 200) || null, created_by: user.name, created_at: new Date().toISOString() }
  if (db) {
    const { error } = await db.from("cms_redirects").upsert(row, { onConflict: "source" })
    if (error) throw error
  } else {
    await writeLocal([row, ...rows.filter((x) => x.source !== source)])
  }
  await addAudit({ user_id: user.id, user_name: user.name, action: opts.auto ? "added a redirect (slug changed)" : "saved a redirect", type: "redirect", entry_id: source, title: `${source} → ${destination}`, detail: null })
  return row
}

export async function deleteRedirect(user: Actor, source: string) {
  if (db) {
    const { error } = await db.from("cms_redirects").delete().eq("source", source)
    if (error) throw error
  } else {
    await writeLocal((await readLocal()).filter((x) => x.source !== source))
  }
  await addAudit({ user_id: user.id, user_name: user.name, action: "deleted a redirect", type: "redirect", entry_id: source, title: source, detail: null })
}

