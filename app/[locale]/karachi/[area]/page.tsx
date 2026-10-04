import Link from "@/components/site/locale-link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowUpRight, MapPin } from "lucide-react"
import { PageHero } from "@/components/site/page-hero"
import { Container, Icon, Pill, Reveal, SectionTitle } from "@/components/site/primitives"
import { FAQ } from "@/components/site/faq"
import { getCatalog, getPage } from "@/lib/cms/read"
import { renderTokens, tokensDeep } from "@/lib/cms/fields"
import { pairs } from "@/lib/cms/types/pages/blocks"
import type { AreaContent } from "@/lib/cms/types/pages/catalogue"
import { pageLocale } from "@/lib/cms/locale"

export async function generateStaticParams() {
  const { areas } = await getCatalog()
  return areas.map((a) => ({ area: a.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; area: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const { getArea } = await getCatalog()
  const a = getArea((await params).area)
  if (!a) return {}
  return {
    title: `Home services in ${a.name}, Karachi: salon at home, cleaning, AC & repairs`,
    description: `Verified pros at your door across ${a.name}: ${a.subAreas.join(", ")}. Salon and spa at home, cleaning, AC service, repairs and more. All-in prices, pay after.`,
    alternates: { canonical: `/karachi/${a.slug}` },
  }
}

export default async function AreaPage({ params }: { params: Promise<{ locale: string; area: string }> }) {
  await pageLocale(params)
  const [{ areas, categoriesOf, getArea, worlds }, page] = await Promise.all([getCatalog(), getPage<AreaContent>("area")])
  const area = getArea((await params).area)
  if (!area) notFound()
  const others = areas.filter((a) => a.slug !== area.slug)
  const c = tokensDeep(page, { area: area.name, blurb: area.blurb, subAreas: area.subAreas.join(", ") })

  return (
    <>
      <PageHero
        crumbs={[{ label: "Areas", href: "/karachi" }, { label: area.name }]}
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        sub={c.hero.sub}
        actions={<><Pill href={c.hero.primary.href} size="lg">{c.hero.primary.label}</Pill><Pill href="#services" variant="outline" size="lg">{c.hero.secondary}</Pill></>}
        style={{ background: "linear-gradient(180deg, oklch(0.95 0.06 80), oklch(0.985 0.01 85))" }}
        bgWord={area.name.toUpperCase()}
      />

      <section className="py-20">
        <Container>
          <SectionTitle eyebrow={c.subAreas.eyebrow} title={c.subAreas.title} />
          <div className="flex flex-wrap gap-2">
            {area.subAreas.map((s, i) => (
              <Reveal key={s} delay={i * 0.03}><span className="flex items-center gap-2 rounded-full border border-zinc-200 px-5 h-12 text-base"><MapPin className="w-4 h-4 text-brand-ink" />{s}</span></Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section id="services" className="py-20 bg-zinc-50 scroll-mt-28">
        <Container>
          <SectionTitle eyebrow={c.services.eyebrow} title={c.services.title} />
          <div className="space-y-12">
            {worlds.map((w) => (
              <div key={w.slug}>
                <p className="flex items-center gap-2 text-sm font-medium mb-4"><span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: w.tint }}><Icon name={w.icon} className="w-4 h-4" /></span>{w.name}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categoriesOf(w.slug).map((cat) => (
                    <Link key={cat.slug} href={`/karachi/${area.slug}/${cat.slug}`} className="group flex items-center gap-4 rounded-3xl bg-white border border-zinc-200 p-5 hover:-translate-y-0.5 transition-transform">
                      <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: w.tint }}><Icon name={cat.icon} className="w-5 h-5" /></span>
                      <span className="flex-1 min-w-0"><span className="block font-medium truncate">{renderTokens(c.services.card, { category: cat.name })}</span><span className="block text-xs text-zinc-500 truncate">{cat.tagline}</span></span>
                      <ArrowUpRight className="w-5 h-5 text-zinc-400 group-hover:text-black shrink-0 rtl:-scale-x-100" />
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
          <p className="text-sm text-zinc-500 mb-4">{c.also}</p>
          <div className="flex flex-wrap gap-2">
            {others.map((a) => <Link key={a.slug} href={`/karachi/${a.slug}`} className="rounded-full border border-zinc-200 px-4 h-10 text-sm flex items-center hover:border-zinc-400">{a.name}</Link>)}
          </div>
        </Container>
      </section>

      <FAQ title={c.faqTitle} items={pairs(c.faq)} />
    </>
  )
}
