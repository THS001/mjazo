import type { Metadata } from "next"
import { Breadcrumbs } from "@/components/site/page-hero"
import { Container, SplitText } from "@/components/site/primitives"
import { HeroReveal } from "@/components/site/reveal-client"
import { HomePulse } from "@/components/ai/home-pulse"
import { PulseLine } from "@/components/ai/pulse-line"
import { FAQ } from "@/components/site/faq"
import { plainText } from "@/components/cms/accent"
import { getPage } from "@/lib/cms/read"
import { pairs } from "@/lib/cms/types/pages/blocks"
import type { ToolPageContent } from "@/lib/cms/types/pages/tools"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/home-pulse", seo: (await getPage("home-pulse")).seo })
}

export default async function HomePulsePage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const c = await getPage<ToolPageContent>("home-pulse")
  return (
    <div className="bg-[#f6faf8]">
      <section className="relative overflow-hidden pt-28 sm:pt-36 pb-10">
        <PulseLine />
        <Container className="relative">
          <Breadcrumbs items={[{ label: "Home Pulse" }]} />
          <HeroReveal><p className="text-xs uppercase tracking-[0.2em] text-[#2f6f5e] mb-4">{c.hero.eyebrow}</p></HeroReveal>
          <h1 className="font-serif text-[clamp(2.35rem,10vw,4.5rem)] leading-[1] max-w-4xl text-balance"><SplitText text={plainText(c.hero.title)} delay={0.1} /></h1>
          <HeroReveal delay={0.6}>
            <p className="text-lg text-zinc-600 mt-5 max-w-2xl">{c.hero.sub}</p>
          </HeroReveal>
        </Container>
      </section>
      <section className="pb-16 sm:pb-24">
        <Container>
          <HomePulse />
        </Container>
      </section>
      <FAQ title={c.faqTitle} items={pairs(c.faq)} />
    </div>
  )
}
