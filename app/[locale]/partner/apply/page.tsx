import type { Metadata } from "next"
import { ApplyForm } from "@/components/partner/apply-form"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/partner/apply", title: "Apply to join Mjazo as a beautician", description: "Apply in 2 minutes, in English or Urdu. We never ask for your CNIC online." })
}

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return (
    <div className="min-h-screen bg-brand pt-28 sm:pt-32 pb-24 px-4 sm:px-6">
      <ApplyForm />
    </div>
  )
}
