import type { Metadata } from "next"
import { PageHero } from "@/components/site/page-hero"
import { Container } from "@/components/site/primitives"
import { RatePage } from "@/components/site/rate-page"
import { pageLocale } from "@/lib/cms/locale"
import { getUi } from "@/lib/cms/read"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const ui = await getUi()
  return pageMetadata({ path: "/rate", title: ui.crumbs.rate, description: ui.feedback.rateDescription })
}

export default async function Rate({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return (
    <>
      <PageHero crumbs={[{ label: "Rate your visit" }]} eyebrow="Two taps" title="How did we do?" sub="Every rating is read by our team and helps us coach every pro." style={{ background: "linear-gradient(180deg, #fbf1dc 0%, #fafaf8 100%)" }} bgWord="THANKS" />
      <section className="pb-24 -mt-4">
        <Container className="max-w-3xl">
          <RatePage />
        </Container>
      </section>
    </>
  )
}
