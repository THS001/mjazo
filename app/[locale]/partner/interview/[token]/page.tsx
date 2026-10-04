import type { Metadata } from "next"
import { Interview } from "@/components/partner/interview"
import { pageLocale } from "@/lib/cms/locale"

export const metadata: Metadata = { title: "Your Mjazo interview", robots: { index: false, follow: false } }

export default async function InterviewPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  await pageLocale(params)
  const { token } = await params
  return <Interview token={token} />
}
