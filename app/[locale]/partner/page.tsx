import type { Metadata } from "next"
import { PartnerLanding } from "@/components/partner/partner-landing"
import { FAQ } from "@/components/site/faq"
import type { HelpTopic } from "@/lib/content"
import { getContent, getPage } from "@/lib/cms/read"
import type { PartnerContent } from "@/lib/cms/types/pages/company"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/partner", seo: (await getPage("partner")).seo })
}

export default async function PartnerPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const [topics, text] = await Promise.all([getContent<HelpTopic>("help-topic"), getPage<PartnerContent>("partner")])
  const forPros = topics.find((t) => t.slug === "for-pros")
  return (
    <>
      <PartnerLanding text={text} />
      {forPros && <FAQ items={forPros.articles} title="Questions from pros" />}
    </>
  )
}
