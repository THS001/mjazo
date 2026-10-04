import Link from "next/link"
import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { PageHero } from "@/components/site/page-hero"
import { Container, Icon, Reveal, StatusChip } from "@/components/site/primitives"
import { WorldRing } from "@/components/services/world-ring"
import { WorldJump } from "@/components/services/world-jump"
import { getCatalog, getPage } from "@/lib/cms/read"
import { renderTokens } from "@/lib/cms/fields"
import type { ServicesContent } from "@/lib/cms/types/pages/catalogue"

export async function generateMetadata(): Promise<Metadata> {
  const { serviceCount } = await getCatalog()
  return {
  alternates: { canonical: "/services" },
  title: "All home services in Karachi: salon, cleaning, AC, repairs & more",
  description: `Book ${serviceCount}+ home services in Karachi: salon at home, spa, makeup, deep cleaning, pest control, AC service, appliance repair, electricians, plumbers, painting, health visits and care.`,
  }
}

export default async function ServicesPage() {
  const [{ categoriesOf, worlds, worldStatus }, c] = await Promise.all([getCatalog(), getPage<ServicesContent>("services")])
  return (
    <div className="bg-cream">
      <PageHero
        image={c.heroImage}
        crumbs={[{ label: "Services" }]}
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        sub={c.hero.sub}
        center
      >
        <div className="mt-12 -mx-4">
          <WorldRing />
        </div>
      </PageHero>

      <WorldJump />

      <Container className="pb-24">
        {worlds.map((w, wi) => {
          const cats = categoriesOf(w.slug)
          const live = worldStatus(w.slug) === "live"
          return (
            <section key={w.slug} id={w.slug} className="scroll-mt-40 pt-20 first:pt-12">
              <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-zinc-300 pb-6">
                <div className="flex items-center gap-5">
                  <span className="font-serif text-6xl md:text-7xl text-black/15 leading-none">0{wi + 1}</span>
                  <div>
                    <h2 className="font-serif text-4xl md:text-5xl">{w.name}</h2>
                    <p className="text-zinc-600 mt-1">{w.short}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip status={live ? "live" : "waitlist"} />
                  <Link href={`/services/w/${w.slug}`} className="inline-block py-2 text-sm underline underline-offset-4">{renderTokens(c.explore, { world: w.name })}</Link>
                </div>
              </Reveal>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cats.map((cat, ci) => (
                  <Reveal key={cat.slug} delay={ci * 0.05}>
                    <Link href={`/services/${cat.slug}`} className="group flex flex-col h-full rounded-3xl bg-white border border-zinc-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(0,0,0,0.3)]">
                      <div className="flex items-start justify-between mb-5">
                        <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: w.tint }}>
                          <Icon name={cat.icon} className="w-6 h-6" />
                        </span>
                        <ArrowUpRight className="w-5 h-5 text-zinc-400 transition-all group-hover:text-black group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                      <p className="text-xl font-medium">{cat.name}</p>
                      <p className="text-sm text-zinc-500 mt-1">{cat.tagline}</p>
                      <ul className="mt-5 space-y-1.5 flex-1">
                        {cat.services.slice(0, 4).map((s) => (
                          <li key={s.slug} className="flex justify-between gap-3 text-sm">
                            <span className="text-zinc-700 truncate">{s.name}</span>
                            <span className="text-zinc-400 whitespace-nowrap">{s.price > 0 ? formatPKR(s.price) : c.quote}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">{cat.services.length} {c.services}</span>
                        <StatusChip status={cat.status} liveLabel="Live" />
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </section>
          )
        })}
      </Container>
    </div>
  )
}
