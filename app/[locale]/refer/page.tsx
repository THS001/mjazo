import type { Metadata } from "next"
import { formatPKR } from "@/lib/catalog"
import { PageHero } from "@/components/site/page-hero"
import { Container, Reveal } from "@/components/site/primitives"
import { ReferCards } from "@/components/site/refer-cards"
import { ReferGenerator } from "@/components/site/refer-generator"
import { FAQ } from "@/components/site/faq"
import { getPage, getSettings } from "@/lib/cms/read"
import { pairs } from "@/lib/cms/types/pages/blocks"
import type { ReferContent } from "@/lib/cms/types/pages/commerce"
import { pageLocale } from "@/lib/cms/locale"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const { referral } = await getSettings()
  return {
    title: "Refer a friend: give and get on Mjazo",
    description: `Share your Mjazo link: friends get ${formatPKR(referral.friendOff)} off their first booking and you get ${formatPKR(referral.youGet)} credit when they book.`,
    alternates: { canonical: "/refer" },
  }
}

export default async function ReferPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const c = await getPage<ReferContent>("refer")
  return (
    <>
      <PageHero
        image={c.heroImage}
        crumbs={[{ label: "Refer & earn" }]}
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        sub={c.hero.sub}
        visual={<ReferCards />}
        style={{ background: "linear-gradient(180deg, #eef3ea 0%, #fafaf7 100%)" }}
        bgWord="SHARE"
      />
      <section className="py-16 sm:py-24">
        <Container className="grid md:grid-cols-3 gap-6">
          {c.steps.map((s, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <p className="font-serif text-7xl text-black/10">0{i + 1}</p>
              <p className="font-serif text-3xl mt-2">{s.title}</p>
              <p className="text-zinc-600 mt-2">{s.body}</p>
            </Reveal>
          ))}
        </Container>
      </section>
      <section className="pb-24">
        <Container>
          <div className="rounded-[2.5rem] bg-foreground text-background p-8 sm:p-14 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="font-serif text-4xl sm:text-5xl">{c.box.title}</p>
              <p className="text-white/60 mt-4">{c.box.body}</p>
            </div>
            <ReferGenerator />
          </div>
        </Container>
      </section>
      <FAQ title={c.faqTitle} items={pairs(c.faq)} />
    </>
  )
}
