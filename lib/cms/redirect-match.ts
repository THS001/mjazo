import { BUILTIN_REDIRECTS } from "@/lib/builtin-redirects.mjs"

// Matching, tracing and checking redirects. Pure functions with no storage, so proxy.ts, the admin
// screens (in the browser) and the tests all share them. Storage lives in redirect-rules.ts.

export type Rule = { source: string; destination: string; permanent: boolean }

/** The redirects in next.config.mjs. They run before the CMS's, and only for English addresses. */
export const BUILTIN: Rule[] = BUILTIN_REDIRECTS

export const STAFF = /^\/(api|admin|ops|pro|_next)(\/|$)/
const EXTERNAL = /^https?:\/\//i

/** A site path without its locale or trailing slash ("ur/old/" → "/old"). Full addresses are kept as they are. */
export function normalise(p: string): string {
  let s = p.trim()
  if (EXTERNAL.test(s)) return s
  if (!s.startsWith("/")) s = `/${s}`
  s = s.replace(/^\/(en|ur)(?=\/|$)/, "") || "/"
  return s.length > 1 ? s.replace(/\/+$/, "") : s
}

/** Where a path should go, if anywhere. Exact sources win over wildcards; the longest wildcard wins. */
export function matchRedirect(p: string, rows: Rule[]): Rule | null {
  const target = normalise(p)
  const exact = rows.find((r) => r.source === target)
  if (exact) return { destination: exact.destination, permanent: exact.permanent, source: exact.source }
  let best: Rule | null = null
  for (const r of rows) {
    if (!r.source.endsWith("/*")) continue
    const base = r.source.slice(0, -2)
    if ((target === base || target.startsWith(`${base}/`)) && (!best || r.source.length > best.source.length)) best = r
  }
  if (!best) return null
  const rest = target.slice(best.source.length - 2).replace(/^\//, "")
  return { destination: best.destination.replace("*", rest).replace(/\/+$/, "") || "/", permanent: best.permanent, source: best.source }
}

export type Hop = { from: string; to: string; permanent: boolean; source: string; builtin: boolean }
export type Trace = { hops: Hop[]; final: string; loop: boolean; external: boolean }

/** Every hop a visitor to `p` goes through: the built-in redirects first, then the CMS's. */
export function traceRedirect(p: string, rows: Rule[], max = 10): Trace {
  const hops: Hop[] = []
  const seen = new Set<string>()
  let at = normalise(p)
  while (hops.length < max) {
    if (EXTERNAL.test(at)) return { hops, final: at, loop: false, external: true }
    if (seen.has(at)) return { hops, final: at, loop: true, external: false }
    seen.add(at)
    const builtin = BUILTIN.find((r) => r.source === at)
    const m = builtin ?? matchRedirect(at, rows)
    if (!m) return { hops, final: at, loop: false, external: false }
    const to = normalise(m.destination)
    hops.push({ from: at, to, permanent: m.permanent, source: m.source, builtin: Boolean(builtin) })
    at = to
  }
  // Still moving after `max` hops: browsers give up long before that, so treat it as a loop.
  return { hops, final: at, loop: true, external: EXTERNAL.test(at) }
}

/**
 * Problems with saving `source → destination` alongside `rows` (the redirect being replaced, if
 * any, is ignored). Empty when it's safe: no loop, no clash with the built-in redirects, and no
 * hijacking of the home page or the staff apps.
 */
export function redirectIssues(sourceIn: string, destinationIn: string, rows: Rule[]): string[] {
  const source = normalise(sourceIn)
  const destination = normalise(destinationIn)
  const issues: string[] = []
  if (!sourceIn.trim() || !destinationIn.trim()) return ["Fill in both the old and the new address."]
  if (EXTERNAL.test(source)) issues.push("The old address must be a path on this site, like /old-page.")
  if (source === "/") issues.push("The home page can't be redirected.")
  if (STAFF.test(source)) issues.push("Staff and system paths can't be redirected.")
  if (source === destination) issues.push("The old and new addresses are the same.")
  if (/\s/.test(source) || /\s/.test(destination)) issues.push("Addresses can't contain spaces.")
  if (source.includes("*") && (!source.endsWith("/*") || source.indexOf("*") !== source.length - 1)) issues.push("A * can only go at the very end of the old address, as in /old-section/*.")
  if (destination.split("*").length > 2) issues.push("The new address can contain one * at most.")
  if (destination.includes("*") && !source.endsWith("/*")) issues.push("A * in the new address needs a /* at the end of the old one.")
  const builtin = BUILTIN.find((b) => b.source === source)
  if (builtin) issues.push(`The site's code already sends ${source} to ${builtin.destination}.`)
  if (issues.length) return issues
  // Follow a sample visit through every redirect, the new one included: it must end somewhere.
  const sample = source.endsWith("/*") ? `${source.slice(0, -2)}/sample-page` : source
  const others = rows.filter((r) => normalise(r.source) !== source)
  if (traceRedirect(sample, [{ source, destination, permanent: true }, ...others]).loop) issues.push("That would create a redirect loop.")
  return issues
}
