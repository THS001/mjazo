import type { Metadata } from "next"
import { PhoneCall } from "lucide-react"
import type { HelpTopic } from "@/lib/content"
import { PageHero } from "@/components/site/page-hero"
import { Container, Icon, Pill, Reveal, SectionTitle } from "@/components/site/primitives"
import { Journey } from "@/components/site/journey"
import { FAQ } from "@/components/site/faq"
import { ObjectCanvas } from "@/components/three"
import { getContent, getPage, getSettings } from "@/lib/cms/read"
import type { SafetyContent } from "@/lib/cms/types/pages/company"
import { waLink } from "@/lib/site"
import { pageLocale } from "@/lib/cms/locale"

export const metadata: Metadata = {
  alternates: { canonical: "/safety" },
  title: "Safety & trust: vetted, women-only beauty pros",
  description: "Women-only beauty pros, five-step vetting with CNIC and background checks, sealed single-use kits, live check-in and check-out, and a women-led support line.",
}

const FOREST = "#14201b"

export default async function SafetyPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const [{ site }, c, topics] = await Promise.all([getSettings(), getPage<SafetyContent>("safety"), getContent<HelpTopic>("help-topic")])
  const safetyFaq = topics.find((t) => t.slug === "safety")?.articles ?? []
  return (
    <>
      <div style={{ background: FOREST }} className="text-white">
        <PageHero
          image={c.heroImage}
          dark
          crumbs={[{ label: c.hero.eyebrow || "Safety & trust" }]}
          eyebrow={c.hero.eyebrow}
          title={c.hero.title}
          sub={c.hero.sub}
          actions={
            <Pill href="#journey" variant="brand" size="lg">
              {c.hero.cta}
            </Pill>
          }
          visual={<ObjectCanvas kind="shield" tint="#cfe0d4" icon="ShieldCheck" className="h-[320px] sm:h-[440px]" scale={2.2} />}
          bgWord="TRUST"
          style={{ background: `radial-gradient(60% 60% at 75% 40%, rgba(244,164,55,0.18), transparent 70%), ${FOREST}` }}
        />
        <section id="journey" className="pb-24 md:pb-0 scroll-mt-20">
          <Journey steps={c.steps} dark label={c.journeyLabel} />
        </section>
      </div>

      <section className="py-16 sm:py-24">
        <Container>
          <SectionTitle eyebrow={c.pillarsHead.eyebrow} title={c.pillarsHead.title} sub={c.pillarsHead.sub || undefined} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.pillars.map((p, i) => (
              <Reveal key={i} delay={(i % 3) * 0.08}>
                <div className="h-full rounded-3xl border border-zinc-200 p-7 hover:bg-[#f2f6f3] transition-colors">
                  <span className="w-12 h-12 rounded-2xl bg-[#e4ede7] flex items-center justify-center mb-6">
                    <Icon name={p.icon} className="w-6 h-6" />
                  </span>
                  <p className="text-xl font-medium">{p.title}</p>
                  <p className="text-zinc-600 text-sm mt-2">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-24">
        <Container>
          <div className="rounded-[2.5rem] p-8 sm:p-14 grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center" style={{ background: FOREST }}>
            <div className="text-white">
              <p className="font-serif text-4xl sm:text-5xl text-balance">{c.help.title}</p>
              <p className="text-white/65 mt-4">{c.help.body}</p>
            </div>
            <div className="flex flex-col gap-3">
              <a href={waLink(site.whatsapp, c.help.whatsappMessage)} target="_blank" rel="noopener noreferrer" className="h-14 rounded-full bg-brand text-black font-medium flex items-center justify-center gap-2">
                {c.help.whatsapp}
              </a>
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="h-14 rounded-full border border-white/30 text-white flex items-center justify-center gap-2">
                <PhoneCall className="w-4 h-4" />
                {c.help.call} {site.phone}
              </a>
            </div>
          </div>
        </Container>
      </section>

      <FAQ items={safetyFaq} title={c.faqTitle} />
    </>
  )
}
