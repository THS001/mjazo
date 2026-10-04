"use client"

import { createBrowserClient } from "@supabase/ssr"

// Supabase Auth in the browser (sign-in, magic links, password changes). Null when not configured.
export const browserSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key ? createBrowserClient(url, key) : null
}
