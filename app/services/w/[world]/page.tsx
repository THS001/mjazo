import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowUpRight, BadgeCheck, Clock, ShieldCheck, Wallet } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { PageHero } from "@/components/site/page-hero"
import { BgWord, Container, Icon, Pill, Reveal, SectionTitle, StatusChip } from "@/components/site/primitives"
import { ServiceCard } from "@/components/site/service-card"
import { NotifyForm } from "@/components/site/notify-form"
import { FAQ } from "@/components/site/faq"
import { ObjectCanvas } from "@/components/three"
import { getCatalog, getPage } from "@/lib/cms/read"
import { renderTokens, tokensDeep } from "@/lib/cms/fields"
import type { WorldContent } from "@/lib/cms/types/pages/catalogue"

const fromPrice = (svcs: { price: number }[], c: WorldContent) => {
  const p = svcs.filter((s) => s.price > 0).map((s) => s.price)
  return p.length ? renderTokens(c.categories.from, { price: formatPKR(Math.min(...p)) }) : c.categories.onRequest
}
const PROMISE_ICONS = { women: [ShieldCheck, BadgeCheck, Wallet], other: [ShieldCheck, Wallet, Clock] }

export async function generateStaticParams() {
  const { worlds } = await getCatalog()
  return worlds.map((w) => ({ world: w.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ world: string }> }): Promise<Metadata> {
  const { getWorld, categoriesOf } = await getCatalog()
  const w = getWorld((await params).world)
  if (!w) return {}
  return { title: `${w.name} at home in Karachi: book verified pros`, description: `Book ${w.name.toLowerCase()} at home across Karachi: ${categoriesOf(w.slug).map((c) => c.name).join(", ")}. All-in prices, pay after.`, alternates: { canonical: `/services/w/${w.slug}` } }
}

export default async function WorldPage({ params }: { params: Promise<{ world: string }> }) {
  const [{ bundles, categoriesOf, getWorld, worldStatus }, page] = await Promise.all([getCatalog(), getPage<WorldContent>("world")])
  const world = getWorld((await params).world)
  if (!world) notFound()
  const cats = categoriesOf(world.slug)
  const c = tokensDeep(page, { world: world.name, worldShort: world.short, count: cats.length })
  const live = worldStatus(world.slug) === "live"
  const popular = cats.flatMap((cat) => cat.services.filter((s) => s.popular).map((s) => ({ category: cat, service: s })))
  const worldBundles = bundles.filter((b) => b.items.some((i) => cats.some((cat) => cat.slug === i.category)))
  const women = cats[0]?.proType === "women"
  const promises = (women ? c.promisesWomen : c.promisesOther).map((p, i) => ({ ...p, icon: PROMISE_ICONS[women ? "women" : "other"][i] ?? ShieldCheck }))

  return (
    <>
      <PageHero
        crumbs={[{ label: "Services", href: "/services" }, { label: world.name }]}
        eyebrow={<StatusChip status={live ? "live" : "waitlist"} className="bg-white/80" />}
        title={world.name}
        sub={live ? c.hero.live : c.hero.soon}
        actions={
          live ? (
            <>
              <Pill href={`/services/${cats[0].slug}`} size="lg">{c.hero.book}</Pill>
              <Pill href="#categories" variant="outline" size="lg">{c.hero.categories}</Pill>
            </>
          ) : (
            <div className="w-full max-w-xl">
              <NotifyForm category={world.slug} source={`world-${world.slug}`} />
            </div>
          )
        }
        visual={<ObjectCanvas kind={world.object} tint={world.tint} icon={world.icon} modelUrl={world.model?.url} className="h-[320px] sm:h-[420px]" scale={1.8} />}
        bgWord={world.bgWord}
        style={{ background: `linear-gradient(180deg, ${world.tint} 0%, color-mix(in oklch, ${world.tint} 45%, white) 100%)` }}
      />

      <section id="categories" className="py-16 sm:py-24 scroll-mt-28">
        <Container>
          <SectionTitle eyebrow={c.categories.eyebrow} title={c.categories.title} />
          <div className="grid md:grid-cols-2 gap-4">
            {cats.map((cat, i) => (
              <Reveal key={cat.slug} delay={i * 0.06}>
                <Link href={`/services/${cat.slug}`} className="group relative flex gap-6 items-center rounded-[2rem] border border-zinc-200 bg-white p-6 sm:p-8 overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-35px_rgba(0,0,0,0.35)]">
                  <span className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full opacity-60 transition-transform duration-700 group-hover:scale-125" style={{ background: world.tint }} />
                  <span className="relative w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ background: world.tint }}>
                    <Icon name={cat.icon} className="w-8 h-8" strokeWidth={1.3} />
                  </span>
                  <div className="relative flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-2xl font-medium">{cat.name}</p>
                    </div>
                    <p className="text-zinc-500 text-sm">{cat.tagline}</p>
                    <p className="text-xs text-zinc-400 mt-3">{cat.services.length} {c.categories.services} · {fromPrice(cat.services, c)}</p>
                  </div>
                  <ArrowUpRight className="relative w-6 h-6 shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {popular.length > 0 && (
        <section className="relative py-16 sm:py-24 overflow-hidden bg-zinc-50">
          <BgWord word={world.bgWord} className="top-8" />
          <Container className="relative z-10">
            <SectionTitle eyebrow={c.popular.eyebrow} title={live ? c.popular.live : c.popular.soon} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {popular.slice(0, 8).map(({ category, service }, i) => (
                <Reveal key={service.slug} delay={(i % 4) * 0.06}>
                  <ServiceCard category={category} service={service} className="h-full" />
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      )}

      {worldBundles.length > 0 && (
        <section className="py-16 sm:py-24">
          <Container>
            <SectionTitle eyebrow={c.bundles.eyebrow} title={c.bundles.title} sub={c.bundles.sub} />
            <div className="grid md:grid-cols-3 gap-4">
              {worldBundles.slice(0, 3).map((b) => (
                <Link key={b.slug} href={`/offers#${b.slug}`} className="rounded-3xl p-7 bg-foreground text-background flex flex-col justify-between min-h-56 hover:-translate-y-1 transition-transform">
                  <div>
                    <p className="font-serif text-3xl">{b.name}</p>
                    <p className="text-white/65 text-sm mt-2">{b.note}</p>
                  </div>
                  <p className="text-lg mt-6">{formatPKR(b.price)}</p>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="py-20">
        <Container>
          <div className="grid md:grid-cols-3 gap-4">
            {promises.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08} className="h-full">
                <div className="rounded-3xl p-7 h-full" style={{ background: world.tint }}>
                  <p.icon className="w-8 h-8 mb-6" strokeWidth={1.3} />
                  <p className="text-xl font-medium">{p.title}</p>
                  <p className="text-sm text-black/60 mt-1">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {!live && (
        <section className="py-20">
          <Container>
            <div className="rounded-[2.5rem] bg-foreground text-background p-8 sm:p-14 grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <p className="font-serif text-4xl sm:text-5xl text-balance">{c.waitlist.title}</p>
                <p className="text-white/70 mt-4">{c.waitlist.body}</p>
              </div>
              <div className="rounded-3xl bg-white p-5 text-foreground">
                <NotifyForm category={world.slug} source={`world-${world.slug}-band`} />
              </div>
            </div>
          </Container>
        </section>
      )}

      <FAQ items={cats[0]?.faqs ?? []} title={c.faqTitle} />
    </>
  )
}
