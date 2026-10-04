import Link from "next/link"
import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { formatDuration, formatPKR } from "@/lib/catalog"
import { PageHero } from "@/components/site/page-hero"
import { Container, Reveal } from "@/components/site/primitives"
import { AddBundleButton } from "@/components/site/offer-buttons"
import { getCatalog, getPage, getSettings } from "@/lib/cms/read"
import { renderTokens } from "@/lib/cms/fields"
import type { OffersContent } from "@/lib/cms/types/pages/commerce"
import { waLink } from "@/lib/site"

export const metadata: Metadata = {
  title: "Offers & bundles: beauty bundles and seasonal home packs",
  description: "Save with Mjazo bundles: The Quick Refresh, Weekend Reset, Full Glow and Shaadi Season Ready, plus the Pre-summer AC Pack and Pre-monsoon Home Pack. All-in prices, pay after.",
  alternates: { canonical: "/offers" },
}

export default async function OffersPage() {
  const [{ bundles, getService }, { site }, c] = await Promise.all([getCatalog(), getSettings(), getPage<OffersContent>("offers")])
  const whatsappLink = (message: string) => waLink(site.whatsapp, message)
  const SEASONAL = c.seasonal
  const live = bundles.filter((b) => !SEASONAL.includes(b.slug))
  const seasonal = bundles.filter((b) => SEASONAL.includes(b.slug))
  return (
    <div className="bg-[#0f0e0c] text-white">
      <PageHero
        image={c.heroImage}
        dark
        crumbs={[{ label: "Offers" }]}
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        sub={c.hero.sub}
        bgWord="BUNDLES"
        style={{ background: "radial-gradient(80% 60% at 80% 0%, rgba(244,164,55,0.22), transparent 60%), #0f0e0c" }}
      />

      <Container className="pb-24 space-y-6">
        {live.map((b, i) => {
          const parts = b.items.map((it) => getService(it.category, it.service)).filter(Boolean).map((x) => x!)
          const full = parts.reduce((s, p) => s + p.service.price, 0)
          const minutes = parts.reduce((s, p) => s + p.service.duration, 0)
          const hero = b.slug === "full-glow"
          return (
            <Reveal key={b.slug}>
              <article id={b.slug} className={`scroll-mt-28 grid lg:grid-cols-[0.9fr_1.1fr] gap-8 rounded-[2.5rem] p-8 sm:p-12 border ${hero ? "border-brand/60 bg-gradient-to-br from-[#2a2213] to-[#14120e]" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="flex flex-col justify-between gap-8">
                  <div>
                    <p className="text-white/40 text-sm">0{i + 1}{hero ? ` · ${c.heroBundle}` : ""}</p>
                    <h2 className="font-serif text-5xl sm:text-6xl mt-3">{b.name}</h2>
                    <p className="text-white/65 mt-4 text-lg max-w-md">{b.note}</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-6">
                    <div>
                      {full > b.price && <p className="text-white/40 line-through">{formatPKR(full)}</p>}
                      <p className="font-serif text-5xl text-brand">{formatPKR(b.price)}</p>
                      {full > b.price && <p className="text-xs text-white/50 mt-1">{c.save} {formatPKR(full - b.price)}</p>}
                    </div>
                    <AddBundleButton bundle={b} />
                  </div>
                </div>
                <ul className="rounded-3xl bg-white/[0.04] border border-white/10 divide-y divide-white/10">
                  {parts.map(({ category, service }) => (
                    <li key={service.slug}>
                      <Link href={`/services/${category.slug}/${service.slug}`} className="group flex items-center justify-between gap-4 p-5 hover:bg-white/[0.04] transition-colors">
                        <span>
                          <span className="block font-medium">{service.name}</span>
                          <span className="block text-sm text-white/50">{service.short}</span>
                        </span>
                        <span className="text-sm text-white/50 whitespace-nowrap flex items-center gap-2">{formatPKR(service.price)}<ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" /></span>
                      </Link>
                    </li>
                  ))}
                  <li className="p-5 text-sm text-white/50 flex justify-between"><span>{c.totalTime}</span><span>{formatDuration(minutes)}</span></li>
                </ul>
              </article>
            </Reveal>
          )
        })}

        <div className="pt-16">
          <p className="text-white/40 text-sm uppercase tracking-[0.2em] mb-6">{c.seasonalLabel}</p>
          <div className="grid md:grid-cols-2 gap-6">
            {seasonal.map((b) => (
              <Reveal key={b.slug}>
                <article id={b.slug} className="scroll-mt-28 rounded-[2rem] border border-white/10 p-8 h-full flex flex-col">
                  <h3 className="font-serif text-4xl">{b.name}</h3>
                  <p className="text-white/60 mt-3 flex-1">{b.note}</p>
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <p className="font-serif text-3xl text-brand">{b.price > 0 ? formatPKR(b.price) : c.freeQuote}</p>
                    {b.price > 0 ? (
                      <AddBundleButton bundle={b} />
                    ) : (
                      <a href={whatsappLink(renderTokens(c.bookMessage, { bundle: b.name }))} target="_blank" rel="noopener noreferrer" className="h-12 rounded-full px-6 text-sm font-medium flex items-center bg-brand text-black hover:bg-white transition-colors">{c.inspection}</a>
                    )}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal>
          <Link href={c.shaadi.href} className="group mt-16 block rounded-[2.5rem] p-10 sm:p-14 overflow-hidden relative" style={{ background: "linear-gradient(120deg, #f3c7c7, #f4a437)" }}>
            <p className="text-black/60 text-sm">{c.shaadi.eyebrow}</p>
            <p className="font-serif text-4xl sm:text-6xl text-black mt-2 max-w-2xl">{c.shaadi.title}</p>
            <span className="inline-flex items-center gap-2 mt-8 text-black font-medium">{c.shaadi.cta} <ArrowUpRight className="w-5 h-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" /></span>
          </Link>
        </Reveal>
      </Container>
    </div>
  )
}
