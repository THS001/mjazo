import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowUpRight, MapPin } from "lucide-react"
import { PageHero } from "@/components/site/page-hero"
import { Container, Icon, Pill, Reveal, SectionTitle } from "@/components/site/primitives"
import { FAQ } from "@/components/site/faq"
import { getCatalog } from "@/lib/cms/read"

export async function generateStaticParams() {
  const { areas } = await getCatalog()
  return areas.map((a) => ({ area: a.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }): Promise<Metadata> {
  const { getArea } = await getCatalog()
  const a = getArea((await params).area)
  if (!a) return {}
  return {
    title: `Home services in ${a.name}, Karachi: salon at home, cleaning, AC & repairs`,
    description: `Verified pros at your door across ${a.name}: ${a.subAreas.join(", ")}. Salon and spa at home, cleaning, AC service, repairs and more. All-in prices, pay after.`,
    alternates: { canonical: `/karachi/${a.slug}` },
  }
}

export default async function AreaPage({ params }: { params: Promise<{ area: string }> }) {
  const { areas, categoriesOf, getArea, worlds } = await getCatalog()
  const area = getArea((await params).area)
  if (!area) notFound()
  const others = areas.filter((a) => a.slug !== area.slug)

  return (
    <>
      <PageHero
        crumbs={[{ label: "Areas", href: "/karachi" }, { label: area.name }]}
        eyebrow={`● Available in ${area.name}`}
        title={`Mjazo in ${area.name}.`}
        sub={`${area.blurb} Salon, spa, cleaning, AC, repairs and more, at your door with all-in prices you pay after.`}
        actions={<><Pill href="/services/w/beauty-wellness" size="lg">Book your glow</Pill><Pill href="#services" variant="outline" size="lg">All services in {area.name}</Pill></>}
        style={{ background: "linear-gradient(180deg, oklch(0.95 0.06 80), oklch(0.985 0.01 85))" }}
        bgWord={area.name.toUpperCase()}
      />

      <section className="py-20">
        <Container>
          <SectionTitle eyebrow="Sub-areas covered" title={`Every corner of ${area.name}`} />
          <div className="flex flex-wrap gap-2">
            {area.subAreas.map((s, i) => (
              <Reveal key={s} delay={i * 0.03}><span className="flex items-center gap-2 rounded-full border border-zinc-200 px-5 h-12 text-base"><MapPin className="w-4 h-4 text-brand-ink" />{s}</span></Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section id="services" className="py-20 bg-zinc-50 scroll-mt-28">
        <Container>
          <SectionTitle eyebrow="Book in your area" title={`Everything ${area.name} homes need`} />
          <div className="space-y-12">
            {worlds.map((w) => (
              <div key={w.slug}>
                <p className="flex items-center gap-2 text-sm font-medium mb-4"><span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: w.tint }}><Icon name={w.icon} className="w-4 h-4" /></span>{w.name}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categoriesOf(w.slug).map((c) => (
                    <Link key={c.slug} href={`/karachi/${area.slug}/${c.slug}`} className="group flex items-center gap-4 rounded-3xl bg-white border border-zinc-200 p-5 hover:-translate-y-0.5 transition-transform">
                      <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: w.tint }}><Icon name={c.icon} className="w-5 h-5" /></span>
                      <span className="flex-1 min-w-0"><span className="block font-medium truncate">{c.name} in {area.name}</span><span className="block text-xs text-zinc-500 truncate">{c.tagline}</span></span>
                      <ArrowUpRight className="w-5 h-5 text-zinc-400 group-hover:text-black shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16">
        <Container>
          <p className="text-sm text-zinc-500 mb-4">We also come to</p>
          <div className="flex flex-wrap gap-2">
            {others.map((a) => <Link key={a.slug} href={`/karachi/${a.slug}`} className="rounded-full border border-zinc-200 px-4 h-10 text-sm flex items-center hover:border-zinc-400">{a.name}</Link>)}
          </div>
        </Container>
      </section>

      <FAQ
        title={`Mjazo in ${area.name}: questions`}
        items={[
          [`Do you cover all of ${area.name}?`, `Yes: ${area.subAreas.join(", ")}. Just outside? WhatsApp us your location.`],
          ["Is there a travel or visit fee?", "No. Prices are all-in."],
          ["How early can someone come?", "The earliest slot is about 2 hours from when you book, depending on availability. You can book up to 7 days ahead."],
        ]}
      />
    </>
  )
}
