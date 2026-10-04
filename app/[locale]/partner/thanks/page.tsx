import type { Metadata } from "next"
import { PartnerThanks } from "@/components/partner/thanks"
import { pageLocale } from "@/lib/cms/locale"

export const metadata: Metadata = {
  alternates: { canonical: "/partner/thanks" }, title: "Application received", robots: { index: false, follow: true } }

export default async function ThanksPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return (
    <div className="min-h-screen bg-brand pt-32 pb-24 px-4 sm:px-6">
      <PartnerThanks />
    </div>
  )
}
