import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

// Request proxy (Next 16's name for middleware).
// - Public site: English lives at plain paths (/services), served by app/[locale] with locale "en";
//   Urdu lives under /ur. /en/... redirects to the plain path so each page has one English address.
// - /admin and /api/cms: keeps the Supabase sign-in session fresh (Server Components can't write cookies).

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/cms")) return refreshSession(request)

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.slice(3) || "/"
    return NextResponse.redirect(url, 308)
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
