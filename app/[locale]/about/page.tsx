import type { Metadata } from "next"
import { Container, Icon, Pill, Reveal, SplitText } from "@/components/site/primitives"
import { Breadcrumbs } from "@/components/site/page-hero"
import { HeroReveal } from "@/components/site/reveal-client"
import { getCatalog, getPage } from "@/lib/cms/read"
import type { AboutContent } from "@/lib/cms/types/pages/company"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/about", seo: (await getPage("about")).seo })
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const [{ worlds }, c] = await Promise.all([getCatalog(), getPage<AboutContent>("about")])
  return (
    <div className="bg-[#f6f1e8]">
      <section className="pt-32 sm:pt-40 pb-20">
        <Container>
          <Breadcrumbs items={[{ label: "About" }]} />
          <h1 className="font-serif font-normal text-[3.4rem] sm:text-8xl lg:text-[9rem] leading-[0.9] tracking-tight max-w-6xl">
            <SplitText text={c.title} delay={0.1} />
          </h1>
          <HeroReveal delay={0.9}>
            <div className="grid md:grid-cols-2 gap-10 mt-16 text-lg leading-relaxed text-zinc-700 max-w-5xl">
              {c.intro.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </HeroReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-24 bg-foreground text-background">
        <Container>
          <p className="text-white/50 text-xs uppercase tracking-[0.2em] mb-12">{c.valuesLabel}</p>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-14">
            {c.values.map((v, i) => (
              <Reveal key={i} delay={(i % 2) * 0.1} className="border-t border-white/15 pt-8">
                <p className="text-brand font-mono text-sm">0{i + 1}</p>
                <p className="font-serif text-4xl sm:text-5xl mt-3">{v.title}</p>
                <p className="text-white/60 mt-4 max-w-md">{v.body}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container>
          <p className="font-serif text-4xl sm:text-5xl max-w-3xl">{c.worldsTitle}</p>
          <p className="text-zinc-600 mt-4 max-w-2xl">{c.worldsSub}</p>
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
            {worlds.map((w, i) => (
              <Reveal key={w.slug} delay={i * 0.05}>
                <div className="rounded-3xl p-5 aspect-square flex flex-col justify-between" style={{ background: w.tint }}>
                  <Icon name={w.icon} className="w-8 h-8" strokeWidth={1.2} />
                  <div>
                    <p className="text-xs text-black/40">0{i + 1}</p>
                    <p className="font-medium">{w.name}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-14">
            {c.ctas.map((b, i) => (
              <Pill key={i} href={b.href} variant={i === 0 ? "solid" : "outline"}>
                {b.label}
              </Pill>
            ))}
          </div>
        </Container>
      </section>
    </div>
  )
}
