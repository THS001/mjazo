import type { Metadata } from "next"
import { CalendarCheck, Crown, Heart, RefreshCw } from "lucide-react"
import { PageHero } from "@/components/site/page-hero"
import { Container, Pill, Reveal } from "@/components/site/primitives"
import { EnquiryForm } from "@/components/site/forms"
import { PlusCard } from "@/components/site/offer-buttons"
import { PlusCalculator } from "@/components/site/plus-calculator"
import { FAQ } from "@/components/site/faq"
import { LiquidWater } from "@/components/site/liquid-water"
import { areaOptions, formatPKR } from "@/lib/catalog"
import { getCatalog, getPage, getSettings } from "@/lib/cms/read"
import { pairs } from "@/lib/cms/types/pages/blocks"
import type { PlusContent } from "@/lib/cms/types/pages/commerce"

export async function generateMetadata(): Promise<Metadata> {
  const { plus } = await getSettings()
  const pct = Math.round(plus.discount * 100)
  return {
  title: "Mjazo Plus membership: member prices on every home service",
  description: `Mjazo Plus: ${pct}% member prices on every booking, priority shaadi-season slots, free reschedules and first pick of your favourite pro. ${formatPKR(plus.price)} a ${plus.period}.`,
  alternates: { canonical: "/plus" },
  }
}

const PERK_ICONS = [Crown, CalendarCheck, Heart, RefreshCw]

export default async function PlusPage() {
  const [{ areas }, c] = await Promise.all([getCatalog(), getPage<PlusContent>("plus")])
  return (
    <div className="relative isolate bg-black text-white">
      {/* Moving water behind the whole page (fixed, so it keeps flowing as you scroll) */}
      <LiquidWater className="fixed inset-0 -z-10" />
      <PageHero
        image={c.heroImage}
        dark
        crumbs={[{ label: "Mjazo Plus" }]}
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        sub={c.hero.sub}
        actions={<><Pill href="#join" variant="brand" size="lg">{c.hero.join}</Pill><Pill href="#calculator" variant="light" size="lg">{c.hero.savings}</Pill></>}
        visual={<PlusCard />}
        style={{ background: "transparent" }}
      />

      <section className="py-16 sm:py-24">
        <Container>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {c.perks.map((p, i) => {
              const PerkIcon = PERK_ICONS[i] ?? Crown
              return (
              <Reveal key={i} delay={i * 0.08}>
                <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-7 hover:border-brand/50 transition-colors">
                  <PerkIcon className="w-8 h-8 text-brand mb-8" strokeWidth={1.3} />
                  <p className="text-xl font-medium">{p.title}</p>
                  <p className="text-white/55 text-sm mt-2">{p.body}</p>
                </div>
              </Reveal>
              )
            })}
          </div>
        </Container>
      </section>

      <section id="calculator" className="py-16 sm:py-24 border-t border-white/10 scroll-mt-24">
        <Container className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-4">{c.calc.eyebrow}</p>
            <h2 className="font-serif text-5xl text-balance">{c.calc.title}</h2>
            <p className="text-white/60 mt-4">{c.calc.sub}</p>
          </Reveal>
          <PlusCalculator />
        </Container>
      </section>

      <section id="join" className="py-16 sm:py-24 border-t border-white/10 scroll-mt-24">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
          <div>
            <p className="font-serif text-5xl">{c.join.title}</p>
            <p className="text-white/60 mt-4">{c.join.body}</p>
          </div>
          <EnquiryForm
            kind="plus"
            dark
            submitLabel={c.join.submit}
            whatsappText={c.join.whatsapp}
            success={c.join.success}
            extras={[{ name: "area", label: c.join.area, type: "select", options: areaOptions(areas), required: true }]}
          />
        </Container>
      </section>

      <div className="relative bg-background text-foreground">
        <FAQ title={c.faqTitle} items={pairs(c.faq)} />
      </div>
    </div>
  )
}
