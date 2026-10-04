import type { Metadata } from "next"
import { Suspense } from "react"
import { Confirmation } from "@/components/checkout/confirmation"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/booking/confirmed", title: "Booking confirmed", noindex: true })
}

export default async function ConfirmedPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return (
    <div className="min-h-screen pt-28 sm:pt-32 pb-24" style={{ background: "radial-gradient(120% 60% at 50% 0%, oklch(0.95 0.05 80) 0%, oklch(0.985 0 0) 60%)" }}>
      <Suspense fallback={null}>
        <Confirmation />
      </Suspense>
    </div>
  )
}
