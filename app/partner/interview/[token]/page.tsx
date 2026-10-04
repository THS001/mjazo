import type { Metadata } from "next"
import { Interview } from "@/components/partner/interview"

export const metadata: Metadata = { title: "Your Mjazo interview", robots: { index: false, follow: false } }

export default async function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <Interview token={token} />
}
