import type { Metadata } from "next"
import { Suspense } from "react"
import { SearchView } from "@/components/services/search-view"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/search", title: "Search services", noindex: "follow" })
}

export default async function SearchPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return (
    <div className="pt-28 sm:pt-32 pb-24 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Suspense fallback={null}>
          <SearchView />
        </Suspense>
      </div>
    </div>
  )
}
