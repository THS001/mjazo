import type { Metadata } from "next"
import { PageHero } from "@/components/site/page-hero"
import { Container, Pill, Reveal } from "@/components/site/primitives"
import { HowTabs } from "@/components/site/how-tabs"
import { FAQ } from "@/components/site/faq"
import { getPage } from "@/lib/cms/read"
import { pairs } from "@/lib/cms/types/pages/blocks"
import type { HowContent } from "@/lib/cms/types/pages/company"

export const metadata: Metadata = {
  alternates: { canonical: "/how-it-works" },
  title: "How Mjazo works: book home services in 2 minutes",
  description: "Pick a service, choose a time window, a verified pro arrives and checks in, and you pay after. Here's how Mjazo works for customers and for pros.",
}

export default async function HowItWorksPage() {
  const c = await getPage<HowContent>("how-it-works")
  return (
    <>
      <PageHero image={c.heroImage} crumbs={[{ label: c.hero.eyebrow || "How it works" }]} eyebrow={c.hero.eyebrow} title={c.hero.title} sub={c.hero.sub} center bgWord="EASY" className="bg-cream" />
      <section className="py-20">
        <Container>
          <HowTabs tabs={{ customers: c.tabCustomers, pros: c.tabPros }} customers={c.customers} pros={c.pros} customersCta={c.customersCta} prosCta={c.prosCta} />
        </Container>
      </section>
      <section className="py-20 bg-foreground text-background">
        <Container className="grid md:grid-cols-3 gap-10">
          {c.promises.map((p, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <p className="font-serif text-4xl">{p.title}</p>
              <p className="text-white/60 mt-3">{p.body}</p>
            </Reveal>
          ))}
        </Container>
      </section>
      <FAQ items={pairs(c.faq)} />
      <div className="flex justify-center pb-24">
        <Pill href={c.cta.href} size="lg">
          {c.cta.label}
        </Pill>
      </div>
    </>
  )
}
