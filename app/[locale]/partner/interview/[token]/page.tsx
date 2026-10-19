import type { Metadata } from "next"
import { Interview } from "@/components/partner/interview"
import { pageLocale } from "@/lib/cms/locale"
import { getPage } from "@/lib/cms/read"
import type { PartnerContent } from "@/lib/cms/types/pages/company"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string; token: string }> }): Promise<Metadata> {
  const l = await pageLocale(params)
  return pageMetadata({ path: `/partner/interview/${(await params).token}`, title: (await getPage<PartnerContent>("partner")).titles.interview[l], noindex: true })
}

export default async function InterviewPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  await pageLocale(params)
  const { token } = await params
  return <Interview token={token} text={await getPage<PartnerContent>("partner")} />
}
