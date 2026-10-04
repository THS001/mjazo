import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = { title: { absolute: "Mjazo CMS", template: "%s · Mjazo CMS" }, robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default function AdminRoot({ children }: { children: ReactNode }) {
  return children
}
