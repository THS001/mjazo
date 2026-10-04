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
import { getCatalog } from "@/lib/cms/read"

const fromPrice = (svcs: { price: number }[]) => {
  const p = svcs.filter((s) => s.price > 0).map((s) => s.price)
  return p.length ? `from ${formatPKR(Math.min(...p))}` : "price on request"
}

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
  const { bundles, categoriesOf, getWorld, worlds, worldStatus } = await getCatalog()
  const world = getWorld((await params).world)
  if (!world) notFound()
  const cats = categoriesOf(world.slug)
  const live = worldStatus(world.slug) === "live"
  const popular = cats.flatMap((c) => c.services.filter((s) => s.popular).map((s) => ({ category: c, service: s })))
  const worldBundles = bundles.filter((b) => b.items.some((i) => cats.some((c) => c.slug === i.category)))
  const proType = cats[0]?.proType
  const promises =
    proType === "women"
      ? [
          { icon: ShieldCheck, t: "Women-only pros", d: "CNIC-verified, background-checked, trained by us." },
          { icon: BadgeCheck, t: "Sealed single-use kits", d: "Opened in front of you, never reused." },
          { icon: Wallet, t: "All-in prices", d: "No visit fee. Pay after the service." },
        ]
      : [
          { icon: ShieldCheck, t: "Verified professionals", d: "CNIC-checked, skill-tested, trained." },
          { icon: Wallet, t: "Upfront prices", d: "Quoted before any work. Parts only with your OK." },
          { icon: Clock, t: "On-time, with warranty", d: "Live check-in, and a service warranty on our work." },
        ]

  return (
    <>
      <PageHero
        crumbs={[{ label: "Services", href: "/services" }, { label: world.name }]}
        eyebrow={<StatusChip status={live ? "live" : "waitlist"} className="bg-white/80" />}
        title={world.name}
        sub={live ? `${world.short}. Book in two minutes and a verified pro comes to you, anywhere across our 8 Karachi neighbourhoods.` : `${world.short}. Opening area by area: join the waitlist and we'll WhatsApp you when it's live near you.`}
        actions={
          live ? (
            <>
              <Pill href={`/services/${cats[0].slug}`} size="lg">Book now</Pill>
              <Pill href="#categories" variant="outline" size="lg">See categories</Pill>
            </>
          ) : (
            <div className="w-full max-w-xl">
              <NotifyForm category={world.slug} source={`world-${world.slug}`} />
            </div>
          )
        }
        visual={<ObjectCanvas kind={world.object} tint={world.tint} icon={world.icon} className="h-[320px] sm:h-[420px]" scale={1.8} />}
        bgWord={world.bgWord}
        style={{ background: `linear-gradient(180deg, ${world.tint} 0%, color-mix(in oklch, ${world.tint} 45%, white) 100%)` }}
      />

      <section id="categories" className="py-16 sm:py-24 scroll-mt-28">
        <Container>
          <SectionTitle eyebrow={`${cats.length} categories`} title={`Inside ${world.name}`} />
          <div className="grid md:grid-cols-2 gap-4">
            {cats.map((c, i) => (
              <Reveal key={c.slug} delay={i * 0.06}>
                <Link href={`/services/${c.slug}`} className="group relative flex gap-6 items-center rounded-[2rem] border border-zinc-200 bg-white p-6 sm:p-8 overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-35px_rgba(0,0,0,0.35)]">
                  <span className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full opacity-60 transition-transform duration-700 group-hover:scale-125" style={{ background: world.tint }} />
                  <span className="relative w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ background: world.tint }}>
                    <Icon name={c.icon} className="w-8 h-8" strokeWidth={1.3} />
                  </span>
                  <div className="relative flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-2xl font-medium">{c.name}</p>
                    </div>
                    <p className="text-zinc-500 text-sm">{c.tagline}</p>
                    <p className="text-xs text-zinc-400 mt-3">{c.services.length} services · {fromPrice(c.services)}</p>
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
            <SectionTitle eyebrow="Most booked" title={live ? "Start with a favourite" : "What's coming"} />
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
            <SectionTitle eyebrow="Bundles" title="Better together" sub="Bundles are priced below their parts and clear the minimum order in one tap." />
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
              <Reveal key={p.t} delay={i * 0.08} className="h-full">
                <div className="rounded-3xl p-7 h-full" style={{ background: world.tint }}>
                  <p.icon className="w-8 h-8 mb-6" strokeWidth={1.3} />
                  <p className="text-xl font-medium">{p.t}</p>
                  <p className="text-sm text-black/60 mt-1">{p.d}</p>
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
                <p className="font-serif text-4xl sm:text-5xl text-balance">Bring {world.name} to your area.</p>
                <p className="text-white/70 mt-4">Every ‘Notify me’ is a vote. We open each service, area by area, where the waitlist is loudest.</p>
              </div>
              <div className="rounded-3xl bg-white p-5 text-foreground">
                <NotifyForm category={world.slug} source={`world-${world.slug}-band`} />
              </div>
            </div>
          </Container>
        </section>
      )}

      <FAQ items={cats[0].faqs} title={`${world.name}: questions`} />
    </>
  )
}
