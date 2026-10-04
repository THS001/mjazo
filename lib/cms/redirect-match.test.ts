import { describe, expect, it } from "vitest"
import { BUILTIN, matchRedirect, normalise, redirectIssues, traceRedirect, type Rule } from "./redirect-match"

// Redirect matching (what proxy.ts does on every request), tracing (the admin's "where does this
// address go?" box) and the checks that stop a saved redirect from looping or clashing.

const r = (source: string, destination: string, permanent = true): Rule => ({ source, destination, permanent })

describe("normalise", () => {
  it("adds the leading slash and drops trailing slashes and the locale", () => {
    expect(normalise("old-page/")).toBe("/old-page")
    expect(normalise("  /ur/old-page//  ")).toBe("/old-page")
    expect(normalise("/en")).toBe("/")
    expect(normalise("/ur")).toBe("/")
    expect(normalise("/")).toBe("/")
  })

  it("keeps full addresses and paths that only start like a locale", () => {
    expect(normalise("https://example.com/x/")).toBe("https://example.com/x/")
    expect(normalise("/urgent-care")).toBe("/urgent-care")
    expect(normalise("/english")).toBe("/english")
  })
})

describe("matchRedirect", () => {
  const rows = [r("/old", "/new"), r("/blog/*", "/articles/*"), r("/blog/tips/*", "/help"), r("/shop/*", "/services", false)]

  it("matches exact sources, ignoring the locale and trailing slashes", () => {
    expect(matchRedirect("/old", rows)).toEqual({ source: "/old", destination: "/new", permanent: true })
    expect(matchRedirect("/ur/old/", rows)?.destination).toBe("/new")
    expect(matchRedirect("/older", rows)).toBeNull()
  })

  it("fills the wildcard and prefers the longest one", () => {
    expect(matchRedirect("/blog/how-to-wax", rows)?.destination).toBe("/articles/how-to-wax")
    expect(matchRedirect("/blog/a/b", rows)?.destination).toBe("/articles/a/b")
    expect(matchRedirect("/blog/tips/ac", rows)?.destination).toBe("/help")
    expect(matchRedirect("/blog", rows)?.destination).toBe("/articles")
    expect(matchRedirect("/blogger", rows)).toBeNull()
  })

  it("prefers an exact source over a wildcard, and keeps temporary redirects temporary", () => {
    expect(matchRedirect("/blog/x", [...rows, r("/blog/x", "/x")])?.destination).toBe("/x")
    expect(matchRedirect("/shop/anything", rows)?.permanent).toBe(false)
  })
})

describe("traceRedirect", () => {
  it("follows a chain to the end", () => {
    const t = traceRedirect("/a", [r("/a", "/b"), r("/b", "/c")])
    expect(t.hops.map((h) => h.to)).toEqual(["/b", "/c"])
    expect(t).toMatchObject({ final: "/c", loop: false, external: false })
  })

  it("stops at an address that doesn't redirect", () => {
    expect(traceRedirect("/services", [r("/a", "/b")])).toEqual({ hops: [], final: "/services", loop: false, external: false })
  })

  it("spots loops, including ones that grow through a wildcard", () => {
    expect(traceRedirect("/a", [r("/a", "/b"), r("/b", "/a")]).loop).toBe(true)
    expect(traceRedirect("/a/x", [r("/a/*", "/a/b/*")]).loop).toBe(true)
  })

  it("ends at an outside address", () => {
    expect(traceRedirect("/insta", [r("/insta", "https://instagram.com/mjazo")])).toMatchObject({ final: "https://instagram.com/mjazo", external: true, loop: false })
  })

  it("applies the built-in redirects first", () => {
    const builtin = BUILTIN[0]
    const t = traceRedirect(builtin.source, [r(builtin.source, "/elsewhere")])
    expect(t.hops[0]).toMatchObject({ builtin: true, to: builtin.destination })
  })
})

describe("redirectIssues", () => {
  it("accepts a normal redirect and a wildcard one", () => {
    expect(redirectIssues("/old-offer", "/offers", [])).toEqual([])
    expect(redirectIssues("/old-blog/*", "/blog/*", [])).toEqual([])
    expect(redirectIssues("/insta", "https://instagram.com/mjazo", [])).toEqual([])
  })

  it("refuses the home page, staff paths, outside sources and no-ops", () => {
    expect(redirectIssues("/", "/services", [])).toContain("The home page can't be redirected.")
    expect(redirectIssues("/ur", "/services", [])).toContain("The home page can't be redirected.")
    for (const p of ["/admin", "/admin/seo", "/api/submit", "/ops", "/pro/today", "/_next/x"]) expect(redirectIssues(p, "/", [])).toContain("Staff and system paths can't be redirected.")
    expect(redirectIssues("https://x.com/a", "/b", [])).toContain("The old address must be a path on this site, like /old-page.")
    expect(redirectIssues("/same/", "/ur/same", [])).toContain("The old and new addresses are the same.")
    expect(redirectIssues("", "/b", [])).toEqual(["Fill in both the old and the new address."])
  })

  it("refuses misplaced wildcards", () => {
    expect(redirectIssues("/a*/b", "/c", []).join()).toMatch(/very end/)
    expect(redirectIssues("/a", "/c/*", []).join()).toMatch(/needs a \/\*/)
    expect(redirectIssues("/a/*", "/c/*/*", []).join()).toMatch(/one \* at most/)
  })

  it("refuses a source the site's code already redirects", () => {
    expect(redirectIssues(BUILTIN[0].source, "/x", []).join()).toMatch(/site's code already sends/)
  })

  it("refuses loops, direct or through other redirects", () => {
    expect(redirectIssues("/b", "/a", [r("/a", "/b")])).toContain("That would create a redirect loop.")
    expect(redirectIssues("/c", "/a", [r("/a", "/b"), r("/b", "/c")])).toContain("That would create a redirect loop.")
    expect(redirectIssues("/a/*", "/a/b/*", [])).toContain("That would create a redirect loop.")
    expect(redirectIssues("/a/*", "/a", [])).toContain("That would create a redirect loop.")
    expect(redirectIssues("/x/*", "/y/*", [r("/y/*", "/x/*")])).toContain("That would create a redirect loop.")
  })

  it("ignores the redirect being replaced when checking for loops", () => {
    // Editing /b → /a into /b → /c: the old version mustn't count against the new one.
    expect(redirectIssues("/b", "/c", [r("/a", "/b"), r("/b", "/a")])).toEqual([])
  })

  it("loops through a built-in redirect too", () => {
    const b = BUILTIN.find((x) => !x.destination.includes("*"))!
    expect(redirectIssues(b.destination, b.source, [])).toContain("That would create a redirect loop.")
  })
})
