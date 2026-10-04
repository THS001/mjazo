import type { Metadata } from "next"
import { Building2, Sparkles, SprayCan, AirVent } from "lucide-react"
import { PageHero } from "@/components/site/page-hero"
import { Container, Reveal, SectionTitle, StatusChip } from "@/components/site/primitives"
import { areaOptions } from "@/lib/catalog"
import { getCatalog, getPage } from "@/lib/cms/read"
import type { BusinessContent } from "@/lib/cms/types/pages/company"
import { EnquiryForm } from "@/components/site/forms"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/business", seo: (await getPage("business")).seo })
}

const GRID = { backgroundImage: "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px" }
const OFFER_ICONS = [Sparkles, Building2, SprayCan, AirVent]

export default async function BusinessPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const [{ areas }, c] = await Promise.all([getCatalog(), getPage<BusinessContent>("business")])
  return (
    <>
      <div style={GRID} className="bg-white">
        <PageHero image={c.heroImage} crumbs={[{ label: c.hero.eyebrow || "Mjazo for Business" }]} eyebrow={c.hero.eyebrow} title={c.hero.title} sub={c.hero.sub} bgWord="TEAMS" />
      </div>
      <section className="py-16 sm:py-24 border-t border-zinc-200">
        <Container>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 border-s border-t border-zinc-200">
            {c.offer.map((o, i) => {
              const OfferIcon = OFFER_ICONS[i] ?? Sparkles
              return (
                <Reveal key={i} delay={i * 0.06} className="border-e border-b border-zinc-200">
                  <div className="p-8 h-full min-h-64 flex flex-col">
                    <div className="flex justify-between items-start mb-10">
                      <OfferIcon className="w-8 h-8" strokeWidth={1.2} />
                      <StatusChip status="live" liveLabel={c.available} />
                    </div>
                    <p className="text-xl font-medium">{o.title}</p>
                    <p className="text-sm text-zinc-500 mt-2">{o.body}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </Container>
      </section>
      <section className="py-16 sm:py-24 bg-zinc-950 text-white">
        <Container className="grid md:grid-cols-3 gap-10">
          {c.reasons.map((r, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <p className="text-white/30 font-mono text-sm">0{i + 1}</p>
              <p className="font-serif text-4xl mt-3">{r.title}</p>
              <p className="text-white/60 mt-3">{r.body}</p>
            </Reveal>
          ))}
        </Container>
      </section>
      <section className="py-16 sm:py-24">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
          <SectionTitle eyebrow={c.form.eyebrow} title={c.form.title} sub={c.form.sub} />
          <EnquiryForm
            kind="business"
            submitLabel={c.form.submit}
            whatsappText={c.form.whatsapp}
            extras={[
              { name: "company", label: c.form.company, type: "text", required: true },
              { name: "teamSize", label: c.form.teamSize, type: "select", options: c.form.teamSizes, required: true },
              { name: "area", label: c.form.area, type: "select", options: areaOptions(areas) },
              { name: "services", label: c.form.interests, type: "chips", multi: true, options: c.form.interestOptions, required: true },
            ]}
          />
        </Container>
      </section>
    </>
  )
}
