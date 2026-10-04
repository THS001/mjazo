import Link from "next/link"
import { ArrowUpRight, MessageCircle, ShieldCheck, X } from "lucide-react"
import { formatDuration, formatPKR, proLabel, type Area, type Category } from "@/lib/catalog"
import { Breadcrumbs, type Crumb } from "@/components/site/page-hero"
import { BgWord, Container, Icon, Pill, Reveal, SplitText, StatusChip } from "@/components/site/primitives"
import { HeroReveal } from "@/components/site/reveal-client"
import { CheckList } from "@/components/site/forms"
import { NotifyForm } from "@/components/site/notify-form"
import { FAQ } from "@/components/site/faq"
import { CategoryServices } from "./category-services"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { waLink } from "@/lib/site"

/** Category page body, shared by /services/[category] and /karachi/[area]/[category]. */
export async function CategoryView({ category, area, crumbs }: { category: Category; area?: Area; crumbs: Crumb[] }) {
  const [{ categoriesOf, getWorld }, { site }] = await Promise.all([getCatalog(), getSettings()])
  const whatsappLink = (message: string) => waLink(site.whatsapp, message)
  const world = getWorld(category.world)!
  const live = category.status === "live" && (!area || area.status === "live")
  const prices = category.services.filter((s) => s.price > 0).map((s) => s.price)
  const durations = category.services.filter((s) => s.duration > 0).map((s) => s.duration)
  const related = categoriesOf(category.world).filter((c) => c.slug !== category.slug)
  const where = area ? area.name : "8 Karachi neighbourhoods"

  return (
    <>
      <section className="pt-28 sm:pt-32 pb-10">
        <Container>
          <div className="relative rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden px-5 sm:px-12 pt-8 sm:pt-10 pb-8 sm:pb-16" style={{ background: world.tint }}>
            <BgWord word={world.bgWord} className="bottom-0 [&>span]:text-white/40 [&>span]:translate-y-[20%]" />
            <div className="relative grid lg:grid-cols-[1.3fr_0.7fr] gap-10 items-end">
              <div>
                <Breadcrumbs items={crumbs} />
                <HeroReveal>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <StatusChip status={live ? "live" : "waitlist"} liveLabel={area ? `Available in ${area.name}` : "Available across Karachi"} className="bg-white/80" />
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-[11px]"><ShieldCheck className="w-3 h-3" />{proLabel[category.proType]}</span>
                  </div>
                </HeroReveal>
                <p className="text-sm uppercase tracking-[0.2em] text-black/50 mb-3">{category.name}{area ? ` in ${area.name}` : ""}</p>
                <h1 className="font-serif text-[clamp(2.35rem,10vw,3.75rem)] lg:text-7xl leading-[1] tracking-tight text-balance">
                  <SplitText text={category.heroLine} delay={0.1} />
                </h1>
                <HeroReveal delay={0.5}>
                  <p className="text-lg text-black/65 mt-5 max-w-xl">{category.tagline}. {live ? `At your door in ${where}, with all-in prices you pay after.` : "Coming soon: join the waitlist below."}</p>
                </HeroReveal>
              </div>
              <HeroReveal delay={0.4}>
                <div className="rounded-3xl bg-white/80 backdrop-blur p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: world.tint }}><Icon name={category.icon} className="w-6 h-6" /></span>
                    <div>
                      <p className="font-medium">{category.services.length} services</p>
                      <p className="text-xs text-zinc-500">{world.name}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-zinc-500 text-xs">From</dt><dd className="font-medium">{prices.length ? formatPKR(Math.min(...prices)) : "Quote"}</dd></div>
                    <div><dt className="text-zinc-500 text-xs">Takes</dt><dd className="font-medium">{durations.length ? `${formatDuration(Math.min(...durations))}+` : "Varies"}</dd></div>
                  </dl>
                  {live ? (
                    <Pill href="#menu" className="mt-6 w-full justify-between">See the menu</Pill>
                  ) : (
                    <Pill href="#notify" className="mt-6 w-full justify-between">Join the waitlist</Pill>
                  )}
                </div>
              </HeroReveal>
            </div>
          </div>
        </Container>
      </section>

      <section id="menu" className="py-12 scroll-mt-28">
        <Container className="grid lg:grid-cols-[1fr_340px] gap-12">
          <div>
            {!live && (
              <div id="notify" className="scroll-mt-28 rounded-3xl bg-foreground text-background p-6 sm:p-8 mb-10">
                <p className="font-serif text-3xl">Want {category.name.toLowerCase()} {area ? `in ${area.name}` : "near you"}?</p>
                <p className="text-white/70 mt-2 mb-5 text-sm">Join the waitlist. We open each service where it's loudest, and WhatsApp you the day it's live.</p>
                <div className="rounded-2xl bg-white p-4 text-foreground">
                  <NotifyForm category={category.slug} area={area?.slug} source={`category-${category.slug}`} />
                </div>
              </div>
            )}
            <h2 className="font-serif text-4xl mb-6">The menu</h2>
            <CategoryServices category={category} />
          </div>

          <aside className="lg:sticky lg:top-28 self-start space-y-4">
            <div className="rounded-3xl border border-zinc-200 p-6">
              <p className="font-medium mb-4">Every visit includes</p>
              <CheckList items={category.includes} />
            </div>
            {category.excludes.length > 0 && (
              <div className="rounded-3xl border border-zinc-200 p-6">
                <p className="font-medium mb-4">Not included</p>
                <ul className="space-y-3">
                  {category.excludes.map((x) => (
                    <li key={x} className="flex gap-3 text-sm text-zinc-600"><X className="w-4 h-4 mt-0.5 shrink-0 text-zinc-400" />{x}</li>
                  ))}
                </ul>
              </div>
            )}
            <a href={whatsappLink(`Hi Mjazo! I have a question about ${category.name}.`)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-3xl bg-[#25D366]/10 p-5 text-sm hover:bg-[#25D366]/20 transition-colors">
              <MessageCircle className="w-5 h-5 text-[#128C7E]" />
              <span><b>Prefer to chat?</b> Ask us anything on WhatsApp.</span>
            </a>
          </aside>
        </Container>
      </section>

      {related.length > 0 && (
        <section className="py-16">
          <Container>
            <p className="font-serif text-3xl mb-6">More in {world.name}</p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {related.map((c, i) => (
                <Reveal key={c.slug} delay={i * 0.05}>
                  <Link href={`/services/${c.slug}`} className="group shrink-0 w-64 flex items-center gap-4 rounded-3xl border border-zinc-200 p-4 hover:border-zinc-400 transition-colors">
                    <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: world.tint }}><Icon name={c.icon} className="w-5 h-5" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{c.name}</span>
                      <span className="block text-xs text-zinc-500">{c.status === "live" ? "Live" : "Coming soon"}</span>
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-black" />
                  </Link>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      )}

      <FAQ items={category.faqs} title={`${category.name}: questions`} />
    </>
  )
}
