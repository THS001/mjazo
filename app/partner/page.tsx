import type { Metadata } from "next"
import { PartnerLanding } from "@/components/partner/partner-landing"
import { FAQ } from "@/components/site/faq"
import type { HelpTopic } from "@/lib/content"
import { getContent } from "@/lib/cms/read"

export const metadata: Metadata = {
  alternates: { canonical: "/partner" },
  title: "Become a Mjazo pro: beautician jobs in Karachi",
  description: "Join Karachi's women-only beauty team. Weekly payouts, pick your days, safe transport support, free training and kits supplied. Apply in English or Urdu.",
}

export default async function PartnerPage() {
  const topics = await getContent<HelpTopic>("help-topic")
  const forPros = topics.find((t) => t.slug === "for-pros")
  return (
    <>
      <PartnerLanding />
      {forPros && <FAQ items={forPros.articles} title="Questions from pros" />}
    </>
  )
}
