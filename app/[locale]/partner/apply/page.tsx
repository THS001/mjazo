import type { Metadata } from "next"
import { ApplyForm } from "@/components/partner/apply-form"
import { pageLocale } from "@/lib/cms/locale"
import { getPage } from "@/lib/cms/read"
import type { PartnerContent } from "@/lib/cms/types/pages/company"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = await pageLocale(params)
  const { titles } = await getPage<PartnerContent>("partner")
  return pageMetadata({ path: "/partner/apply", title: titles.apply[l], description: titles.applyDescription[l] })
}

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return (
    <div className="min-h-screen bg-brand pt-28 sm:pt-32 pb-24 px-4 sm:px-6">
      <ApplyForm text={await getPage<PartnerContent>("partner")} />
    </div>
  )
}
