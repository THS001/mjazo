import { notFound } from "next/navigation"
import { pageLocale } from "@/lib/cms/locale"

// Any path no other page matches: the site's 404 (inside the locale's layout).
export default async function CatchAll({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  await pageLocale(params)
  notFound()
}
