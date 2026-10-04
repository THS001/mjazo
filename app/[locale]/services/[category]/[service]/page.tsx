import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BadgeCheck, CalendarClock, Clock, PackageCheck, Sparkles, Star, UserCheck } from "lucide-react"
import { formatDuration, formatPKR } from "@/lib/catalog"
import { Breadcrumbs } from "@/components/site/page-hero"
import { Container, Icon, Reveal, SplitText, StatusChip } from "@/components/site/primitives"
import { HeroReveal } from "@/components/site/reveal-client"
import { CheckList } from "@/components/site/forms"
import { ServiceCard } from "@/components/site/service-card"
import { FAQ } from "@/components/site/faq"
import { ServicePurchase } from "@/components/services/service-purchase"
import { getCatalog, getPage, getSettings, getUi, getSeoSettings } from "@/lib/cms/read"
import type { ServiceContent } from "@/lib/cms/types/pages/catalogue"
import { CmsImage, isImage } from "@/components/cms/image"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateStaticParams() {
  const { allServices } = await getCatalog()
  return allServices.map(({ category, service }) => ({ category: category.slug, service: service.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; category: string; service: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const [{ getService }, s] = await Promise.all([getCatalog(), getSeoSettings()])
  const p = await params
  const found = getService(p.category, p.service)
  if (!found) return {}
  const { category, service } = found
  const priced = service.price > 0
  return pageMetadata({
    path: `/services/${category.slug}/${service.slug}`,
    seo: service.seo,
    title: priced ? s.patterns.serviceTitle : s.patterns.serviceTitleNoPrice,
    description: category.status !== "live" ? s.patterns.serviceDescriptionSoon : priced ? s.patterns.serviceDescription : s.patterns.serviceDescriptionNoPrice,
    vars: { service: service.name, short: service.short, price: formatPKR(service.price), category: category.name },
    image: service.image,
  })
}

const STEP_ICONS = [Sparkles, CalendarClock, UserCheck, Star]

export default async function ServicePage({ params }: { params: Promise<{ locale: string; category: string; service: string }> }) {
  await pageLocale(params)
  const [{ areas, getService, getWorld }, { site }, c, ui] = await Promise.all([getCatalog(), getSettings(), getPage<ServiceContent>("service"), getUi()])
  const p = await params
  const found = getService(p.category, p.service)
  if (!found) notFound()
  const { category, service } = found
  const world = getWorld(category.world)!
  const live = category.status === "live"
  const related = category.services.filter((s) => s.slug !== service.slug).sort((a, b) => Number(!!b.popular) - Number(!!a.popular)).slice(0, 4)
  const steps = (category.proType === "women" ? c.stepsWomen : c.stepsOther).map((st, i) => ({ ...st, icon: STEP_ICONS[i] ?? Sparkles }))
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.short,
    serviceType: category.name,
    areaServed: areas.map((a) => `${a.name}, Karachi`),
    provider: { "@type": "LocalBusiness", name: site.name, url: site.url },
    ...(service.price > 0 ? { offers: { "@type": "Offer", price: service.price, priceCurrency: "PKR", availability: live ? "https://schema.org/InStock" : "https://schema.org/PreOrder" } } : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="pt-28 sm:pt-32 pb-28 lg:pb-24">
        <Container>
          <Breadcrumbs items={[{ label: "Services", href: "/services" }, { label: category.name, href: `/services/${category.slug}` }, { label: service.name }]} />
          <div className="grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-14">
            <div className="min-w-0">
              {/* Visual */}
              <HeroReveal>
                <div className="relative aspect-[4/3] sm:aspect-[16/10] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden flex items-center justify-center" style={{ background: world.tint }}>
                  {isImage(service.image) ? (
                    <CmsImage img={service.image} priority sizes="(min-width: 1024px) 60vw, 100vw" />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.7),transparent_55%)]" />
                      <div className="absolute w-[46%] aspect-square rounded-full bg-white/40" />
                      <Icon name={category.icon} className="relative w-28 h-28 sm:w-36 sm:h-36 text-black/75" strokeWidth={0.8} />
                    </>
                  )}
                  <div className="absolute top-5 start-5 flex flex-wrap gap-2">
                    <StatusChip status={category.status} liveLabel={c.chips.available} className="bg-white/85" />
                    {service.popular && <span className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium">{c.chips.popular}</span>}
                  </div>
                  <div className="absolute bottom-5 start-5 end-5 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-black/80 text-white px-3 py-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{formatDuration(service.duration, ui.duration)}</span>
                    <span className="rounded-full bg-black/80 text-white px-3 py-1.5 flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5" />{ui.pro[category.proType]}</span>
                    {category.proType === "women" && <span className="rounded-full bg-black/80 text-white px-3 py-1.5 flex items-center gap-1.5"><PackageCheck className="w-3.5 h-3.5" />{c.chips.sealedKit}</span>}
                  </div>
                </div>
              </HeroReveal>

              <p className="text-sm text-zinc-500 mt-10">{category.name}</p>
              <h1 className="font-serif text-[clamp(2.35rem,10vw,3.75rem)] leading-[1] tracking-tight mt-2 text-balance">
                <SplitText text={service.name} delay={0.1} />
              </h1>
              <HeroReveal delay={0.4}>
                <p className="text-lg text-zinc-600 mt-4 max-w-2xl">{service.short}</p>
              </HeroReveal>

              <Reveal className="mt-14 grid sm:grid-cols-2 gap-6">
                <div className="rounded-3xl bg-zinc-50 p-6">
                  <p className="font-medium mb-4">{c.included}</p>
                  <CheckList items={[...(service.includes ?? []), ...category.includes]} />
                </div>
                <div className="rounded-3xl bg-zinc-50 p-6">
                  <p className="font-medium mb-4">{c.prepTitle}</p>
                  <ul className="space-y-3 text-sm text-zinc-700 list-disc ps-5 marker:text-brand-ink">
                    {(c.prep[category.proType] ?? []).map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              </Reveal>

              <div className="mt-14">
                <p className="font-serif text-3xl mb-6">{c.howTitle}</p>
                <ol className="grid sm:grid-cols-2 gap-4">
                  {steps.map((s, i) => (
                    <Reveal as="li" key={s.title} delay={i * 0.06} className="flex gap-4 rounded-3xl border border-zinc-200 p-5">
                      <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: world.tint }}><s.icon className="w-5 h-5" strokeWidth={1.5} /></span>
                      <span>
                        <span className="block text-xs text-zinc-400">{c.step} {i + 1}</span>
                        <span className="block font-medium">{s.title}</span>
                        <span className="block text-sm text-zinc-500 mt-0.5">{s.body}</span>
                      </span>
                    </Reveal>
                  ))}
                </ol>
              </div>

              <div className="mt-14 rounded-3xl border border-zinc-200 p-6 text-sm text-zinc-600 grid sm:grid-cols-3 gap-4">
                {c.policies.map((x) => (
                  <p key={x.title}><b className="text-black block">{x.title}</b>{x.body}</p>
                ))}
              </div>
            </div>

            <div className="lg:sticky lg:top-28 self-start">
              <ServicePurchase category={category} service={service} />
            </div>
          </div>
        </Container>
      </section>

      {related.length > 0 && (
        <section className="py-20 bg-zinc-50">
          <Container>
            <p className="font-serif text-4xl mb-8">{c.related}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((s, i) => (
                <Reveal key={s.slug} delay={i * 0.05}>
                  <ServiceCard category={category} service={s} className="h-full" />
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      )}

      <FAQ items={category.faqs} title={c.faqTitle} />
    </>
  )
}
