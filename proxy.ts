import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { countHit, listRedirects, matchRedirect, type Redirect } from "@/lib/cms/redirect-rules"
import { localePath, stripLocale } from "@/lib/i18n"

// Request proxy (Next 16's name for middleware).
// - Public site: English lives at plain paths (/services), served by app/[locale] with locale "en";
//   Urdu lives under /ur. /en/... redirects to the plain path so each page has one English address.
// - Redirects from the CMS (/admin/redirects) run first, in both languages.
// - /admin and /api/cms: keeps the Supabase sign-in session fresh (Server Components can't write cookies).

// Redirect rules, cached per server instance (a minute on Vercel, a few seconds locally).
let rules: { at: number; rows: Redirect[] } | null = null
async function redirectRules(): Promise<Redirect[]> {
  const ttl = process.env.VERCEL ? 60_000 : 3_000
  if (!rules || Date.now() - rules.at > ttl) {
    try {
      rules = { at: Date.now(), rows: await listRedirects() }
    } catch {
      rules = { at: Date.now(), rows: rules?.rows ?? [] }
    }
  }
  return rules.rows
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/cms")) return refreshSession(request)

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.slice(3) || "/"
    return NextResponse.redirect(url, 308)
  }
  const rows = await redirectRules()
  if (rows.length) {
    const m = matchRedirect(stripLocale(pathname), rows)
    if (m) {
      const locale = pathname === "/ur" || pathname.startsWith("/ur/") ? "ur" : "en"
      const to = /^https?:\/\//i.test(m.destination) ? m.destination : localePath(m.destination, locale)
      void countHit(m.source, rows.find((r) => r.source === m.source)?.hits ?? 0)
      return NextResponse.redirect(new URL(to + request.nextUrl.search, request.url), m.permanent ? 308 : 307)
    }
  }
  if (pathname === "/ur" || pathname.startsWith("/ur/")) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = pathname === "/" ? "/en" : `/en${pathname}`
  return NextResponse.rewrite(url)
}

async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  await supabase.auth.getUser()
  return response
}

// Everything except other APIs, Next's own files, the staff apps, root metadata files and static files.
export const config = {
  matcher: ["/((?!api/(?!cms)|_next/|ops(?:/|$)|pro(?:/|$)|icon|apple-icon|opengraph-image|twitter-image|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)"],
}
