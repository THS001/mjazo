import type { Metadata } from "next"
import { Breadcrumbs } from "@/components/site/page-hero"
import { Container, SplitText } from "@/components/site/primitives"
import { HeroReveal } from "@/components/site/reveal-client"
import { GharScan } from "@/components/ai/ghar-scan"
import { FAQ } from "@/components/site/faq"
import { plainText } from "@/components/cms/accent"
import { getPage } from "@/lib/cms/read"
import { pairs } from "@/lib/cms/types/pages/blocks"
import type { ToolPageContent } from "@/lib/cms/types/pages/tools"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/ghar-scan", seo: (await getPage("ghar-scan")).seo })
}

export default async function GharScanPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const c = await getPage<ToolPageContent>("ghar-scan")
  return (
    <>
      <section className="relative overflow-hidden bg-[#0e0f11] text-white pt-28 sm:pt-36 pb-16 sm:pb-24">
        <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <Container className="relative">
          <Breadcrumbs items={[{ label: "Ghar Scan" }]} light />
          <div className="max-w-3xl mb-10">
            <HeroReveal><p className="text-xs uppercase tracking-[0.2em] text-brand mb-4">{c.hero.eyebrow}</p></HeroReveal>
            <h1 className="font-serif text-[clamp(2.35rem,10vw,4.5rem)] leading-[1] text-balance"><SplitText text={plainText(c.hero.title)} delay={0.1} /></h1>
            <HeroReveal delay={0.6}><p className="text-white/65 text-lg mt-5">{c.hero.sub}</p></HeroReveal>
          </div>
          <GharScan />
        </Container>
      </section>
      <FAQ title={c.faqTitle} items={pairs(c.faq)} />
    </>
  )
}
