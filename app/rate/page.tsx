import type { Metadata } from "next"
import { PageHero } from "@/components/site/page-hero"
import { Container } from "@/components/site/primitives"
import { RatePage } from "@/components/site/rate-page"

export const metadata: Metadata = {
  alternates: { canonical: "/rate" },
  title: "Rate your visit",
  description: "Tell us how your Mjazo visit went. Every rating is read and helps us coach our pros.",
  robots: { index: false, follow: true },
}

export default function Rate() {
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
