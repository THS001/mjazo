import { BUILTIN_REDIRECTS } from "./lib/builtin-redirects.mjs"

// Media-library images are optimised by next/image: from Supabase Storage on the live site, and
// from /api/cms/media/file/... (a same-site path) in local development.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null
  } catch {
    return null
  }
})()

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/media/**" }] : [],
    localPatterns: [{ pathname: "/api/cms/media/file/**" }, { pathname: "/**", search: "" }],
  },
  async redirects() {
    return BUILTIN_REDIRECTS.map((r) => ({ ...r }))
  },
}

export default nextConfig
