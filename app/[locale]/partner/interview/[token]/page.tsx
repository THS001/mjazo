import type { Metadata } from "next"
import { Interview } from "@/components/partner/interview"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string; token: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: `/partner/interview/${(await params).token}`, title: "Your Mjazo interview", noindex: true })
}

export default async function InterviewPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  await pageLocale(params)
  const { token } = await params
  return <Interview token={token} />
}
