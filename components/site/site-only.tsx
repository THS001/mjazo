"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

/** Staff apps, the CMS and the applicant interview run full-screen, without the marketing site's chrome. */
export const isAppPath = (p: string) => p === "/admin" || p.startsWith("/admin/") || p === "/ops" || p.startsWith("/ops/") || p === "/pro" || p.startsWith("/pro/") || p.startsWith("/partner/interview/")

export function SiteOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return isAppPath(pathname) ? null : children
}
