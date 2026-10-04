import type { Metadata } from "next"
import { PartnerThanks } from "@/components/partner/thanks"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/partner/thanks", title: "Application received", noindex: "follow" })
}

export default async function ThanksPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return (
    <div className="min-h-screen bg-brand pt-32 pb-24 px-4 sm:px-6">
      <PartnerThanks />
    </div>
  )
}
