import Link from "@/components/site/locale-link"
import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { PageHero } from "@/components/site/page-hero"
import { Container, Pill, Reveal, SectionTitle } from "@/components/site/primitives"
import { Petals } from "@/components/site/petals"
import { EnquiryForm } from "@/components/site/forms"
import { areaOptions } from "@/lib/catalog"
import { getCatalog, getPage } from "@/lib/cms/read"
import { renderTokens } from "@/lib/cms/fields"
import type { WeddingsContent } from "@/lib/cms/types/pages/tools"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/weddings", seo: (await getPage("weddings")).seo })
}

const BLUSH = "linear-gradient(180deg, #f9e3df 0%, #fbeee6 55%, #fdf7f1 100%)"
const TINTS = ["#f6d9cf", "#f7e3b5", "#f3dbe2", "#e7d9ee", "#e2ddd5", "#d6e9e4"]

export default async function WeddingsPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const [{ areas, bundles, getService }, c] = await Promise.all([getCatalog(), getPage<WeddingsContent>("weddings")])
  const [squadCategory, squadSlug] = c.packages.service.split("/")
  const squad = getService(squadCategory ?? "", squadSlug ?? "")
  const shaadi = bundles.find((b) => b.slug === c.packages.bundle)
  const packages = [
    squad && { name: squad.service.name, note: squad.service.short, price: renderTokens(c.packages.perGuest, { price: formatPKR(squad.service.price) }), href: `/services/${squad.category.slug}/${squad.service.slug}` },
    shaadi && { name: shaadi.name, note: shaadi.note, price: formatPKR(shaadi.price), href: `/offers#${shaadi.slug}` },
  ].filter((p) => !!p)
  return (
    <>
      <div className="relative overflow-hidden" style={{ background: BLUSH }}>
        <Petals />
        <PageHero
          image={c.heroImage}
          crumbs={[{ label: "Weddings & events" }]}
          eyebrow={c.hero.eyebrow}
          title={c.hero.title}
          sub={c.hero.sub}
          actions={<><Pill href={c.hero.primary.href} size="lg">{c.hero.primary.label}</Pill><Pill href={c.hero.secondary.href} variant="outline" size="lg">{c.hero.secondary.label}</Pill></>}
          bgWord="SHAADI"
          center
        />
      </div>

      <section className="py-16 sm:py-24">
        <Container>
          <SectionTitle eyebrow={c.who.eyebrow} title={c.who.title} sub={c.who.sub || undefined} center />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.who.items.map((w, i) => (
              <Reveal key={w.title} delay={(i % 3) * 0.08}>
                <div className="h-full rounded-[2rem] p-8 min-h-56 flex flex-col justify-end" style={{ background: TINTS[i % TINTS.length] }}>
                  <p className="font-serif text-3xl">{w.title}</p>
                  <p className="text-black/60 mt-2">{w.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {packages.length > 0 && (
        <section className="py-16 sm:py-24" style={{ background: "#2a1416" }}>
          <Container className="text-white grid lg:grid-cols-2 gap-6">
            {packages.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <Link href={p.href} className="group block h-full rounded-[2rem] border border-white/15 p-10 hover:bg-white/[0.04] transition-colors">
                  <p className="text-[#f4a437] text-sm">{c.packages.label}</p>
                  <p className="font-serif text-5xl mt-3">{p.name}</p>
                  <p className="text-white/60 mt-3 max-w-md">{p.note}</p>
                  <div className="flex items-center justify-between mt-10">
                    <p className="text-xl">{p.price}</p>
                    <ArrowUpRight className="w-6 h-6 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 rtl:-scale-x-100" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </Container>
        </section>
      )}

      <section className="py-16 sm:py-24">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
          <div className="lg:sticky lg:top-28">
            <SectionTitle eyebrow={c.plan.eyebrow} title={c.plan.title} sub={c.plan.sub || undefined} className="mb-6 md:mb-6" />
            <ol className="space-y-5 text-sm">
              {c.plan.steps.map((s) => (
                <li key={s.when} className="flex gap-4"><span className="w-28 shrink-0 text-zinc-400">{s.when}</span><span>{s.what}</span></li>
              ))}
            </ol>
            {c.plan.more.label && <Link href={c.plan.more.href} className="inline-block mt-4 py-2 text-sm underline underline-offset-4">{c.plan.more.label}</Link>}
          </div>
          <div id="enquire" className="scroll-mt-28">
            <p className="font-serif text-4xl mb-6">{c.form.title}</p>
            <EnquiryForm
              kind="wedding"
              submitLabel={c.form.submit}
              whatsappText={c.form.whatsapp}
              extras={[
                { name: "event", label: c.form.event, type: "select", options: c.form.events, required: true },
                { name: "date", label: c.form.date, type: "date", required: true },
                { name: "guests", label: c.form.guests, type: "number", required: true, placeholder: c.form.guestsHint },
                { name: "area", label: c.form.area, type: "select", options: areaOptions(areas), required: true },
                { name: "services", label: c.form.services, type: "chips", multi: true, options: c.form.serviceOptions, required: true },
              ]}
            />
          </div>
        </Container>
      </section>
    </>
  )
}
