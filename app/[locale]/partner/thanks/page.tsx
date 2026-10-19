import type { Metadata } from "next"
import { PartnerThanks } from "@/components/partner/thanks"
import { pageLocale } from "@/lib/cms/locale"
import { getPage } from "@/lib/cms/read"
import type { PartnerContent } from "@/lib/cms/types/pages/company"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = await pageLocale(params)
  return pageMetadata({ path: "/partner/thanks", title: (await getPage<PartnerContent>("partner")).titles.thanks[l], noindex: "follow" })
}

export default async function ThanksPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return (
    <div className="min-h-screen bg-brand pt-32 pb-24 px-4 sm:px-6">
      <PartnerThanks text={await getPage<PartnerContent>("partner")} />
    </div>
  )
}
