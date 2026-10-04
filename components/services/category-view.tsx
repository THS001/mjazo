import Link from "@/components/site/locale-link"
import { ArrowUpRight, MessageCircle, ShieldCheck, X } from "lucide-react"
import { formatDuration, formatPKR, type Area, type Category } from "@/lib/catalog"
import { Breadcrumbs, type Crumb } from "@/components/site/page-hero"
import { BgWord, Container, Icon, Pill, Reveal, SplitText, StatusChip } from "@/components/site/primitives"
import { HeroReveal } from "@/components/site/reveal-client"
import { CheckList } from "@/components/site/forms"
import { NotifyForm } from "@/components/site/notify-form"
import { FAQ } from "@/components/site/faq"
import { CategoryServices } from "./category-services"
import { getCatalog, getPage, getSettings, getUi } from "@/lib/cms/read"
import { tokensDeep } from "@/lib/cms/fields"
import type { CategoryContent } from "@/lib/cms/types/pages/catalogue"
import { waLink } from "@/lib/site"
import { CmsImage, isImage } from "@/components/cms/image"

/** Category page body, shared by /services/[category] and /karachi/[area]/[category]. */
export async function CategoryView({ category, area, crumbs }: { category: Category; area?: Area; crumbs: Crumb[] }) {
  const [{ categoriesOf, getWorld }, { site }, page, ui] = await Promise.all([getCatalog(), getSettings(), getPage<CategoryContent>("category"), getUi()])
  const whatsappLink = (message: string) => waLink(site.whatsapp, message)
  const world = getWorld(category.world)!
  const live = category.status === "live" && (!area || area.status === "live")
  const prices = category.services.filter((s) => s.price > 0).map((s) => s.price)
  const durations = category.services.filter((s) => s.duration > 0).map((s) => s.duration)
  const related = categoriesOf(category.world).filter((c) => c.slug !== category.slug)
  const vars = { category: category.name, categoryLower: category.name.toLowerCase(), world: world.name, area: area?.name ?? "" }
  const c = tokensDeep(page, { ...vars, where: area ? area.name : tokensDeep(page.hero.everywhere, vars) })

  return (
    <>
      <section className="pt-28 sm:pt-32 pb-10">
        <Container>
          <div className="relative rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden px-5 sm:px-12 pt-8 sm:pt-10 pb-8 sm:pb-16" style={{ background: world.tint }}>
            {isImage(category.image) && (
              <div aria-hidden className="absolute inset-0 lg:start-[30%]">
                <CmsImage img={category.image} priority sizes="(min-width: 1024px) 65vw, 100vw" />
                <div className="absolute inset-0 lg:hidden" style={{ background: `color-mix(in oklab, ${world.tint} 82%, transparent)` }} />
                <div className="absolute inset-0 hidden lg:block" style={{ background: `linear-gradient(90deg, ${world.tint} 0%, color-mix(in oklab, ${world.tint} 75%, transparent) 35%, transparent 75%)` }} />
              </div>
            )}
            <BgWord word={world.bgWord} className="bottom-0 [&>span]:text-white/40 [&>span]:translate-y-[20%]" />
            <div className="relative grid lg:grid-cols-[1.3fr_0.7fr] gap-10 items-end">
              <div>
                <Breadcrumbs items={crumbs} />
                <HeroReveal>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <StatusChip status={live ? "live" : "waitlist"} liveLabel={area ? c.hero.availableIn : c.hero.availableAcross} className="bg-white/80" />
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-[11px]"><ShieldCheck className="w-3 h-3" />{ui.pro[category.proType]}</span>
                  </div>
                </HeroReveal>
                <p className="text-sm uppercase tracking-[0.2em] text-black/50 mb-3">{area ? c.hero.eyebrowArea : category.name}</p>
                <h1 className="font-serif text-[clamp(2.35rem,10vw,3.75rem)] lg:text-7xl leading-[1] tracking-tight text-balance">
                  <SplitText text={category.heroLine} delay={0.1} />
                </h1>
                <HeroReveal delay={0.5}>
                  <p className="text-lg text-black/65 mt-5 max-w-xl">{category.tagline}. {live ? c.hero.live : c.hero.soon}</p>
                </HeroReveal>
              </div>
              <HeroReveal delay={0.4}>
                <div className="rounded-3xl bg-white/80 backdrop-blur p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: world.tint }}><Icon name={category.icon} className="w-6 h-6" /></span>
                    <div>
                      <p className="font-medium">{category.services.length} {c.card.services}</p>
                      <p className="text-xs text-zinc-500">{world.name}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-zinc-500 text-xs">{c.card.from}</dt><dd className="font-medium">{prices.length ? formatPKR(Math.min(...prices)) : c.card.quote}</dd></div>
                    <div><dt className="text-zinc-500 text-xs">{c.card.takes}</dt><dd className="font-medium">{durations.length ? `${formatDuration(Math.min(...durations), ui.duration)}+` : c.card.varies}</dd></div>
                  </dl>
                  {live ? (
                    <Pill href="#menu" className="mt-6 w-full justify-between">{c.card.menu}</Pill>
                  ) : (
                    <Pill href="#notify" className="mt-6 w-full justify-between">{c.card.waitlist}</Pill>
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
                <p className="font-serif text-3xl">{area ? c.waitlist.titleArea : c.waitlist.titleAny}</p>
                <p className="text-white/70 mt-2 mb-5 text-sm">{c.waitlist.body}</p>
                <div className="rounded-2xl bg-white p-4 text-foreground">
                  <NotifyForm category={category.slug} area={area?.slug} source={`category-${category.slug}`} />
                </div>
              </div>
            )}
            <h2 className="font-serif text-4xl mb-6">{c.menuTitle}</h2>
            <CategoryServices category={category} />
          </div>

          <aside className="lg:sticky lg:top-28 self-start space-y-4">
            <div className="rounded-3xl border border-zinc-200 p-6">
              <p className="font-medium mb-4">{c.includes}</p>
              <CheckList items={category.includes} />
            </div>
            {category.excludes.length > 0 && (
              <div className="rounded-3xl border border-zinc-200 p-6">
                <p className="font-medium mb-4">{c.excludes}</p>
                <ul className="space-y-3">
                  {category.excludes.map((x) => (
                    <li key={x} className="flex gap-3 text-sm text-zinc-600"><X className="w-4 h-4 mt-0.5 shrink-0 text-zinc-400" />{x}</li>
                  ))}
                </ul>
              </div>
            )}
            <a href={whatsappLink(c.chat.message)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-3xl bg-[#25D366]/10 p-5 text-sm hover:bg-[#25D366]/20 transition-colors">
              <MessageCircle className="w-5 h-5 text-[#128C7E]" />
              <span><b>{c.chat.bold}</b> {c.chat.text}</span>
            </a>
          </aside>
        </Container>
      </section>

      {related.length > 0 && (
        <section className="py-16">
          <Container>
            <p className="font-serif text-3xl mb-6">{c.related.title}</p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {related.map((r, i) => (
                <Reveal key={r.slug} delay={i * 0.05}>
                  <Link href={`/services/${r.slug}`} className="group shrink-0 w-64 flex items-center gap-4 rounded-3xl border border-zinc-200 p-4 hover:border-zinc-400 transition-colors">
                    <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: world.tint }}><Icon name={r.icon} className="w-5 h-5" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{r.name}</span>
                      <span className="block text-xs text-zinc-500">{r.status === "live" ? c.related.live : c.related.soon}</span>
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-black rtl:-scale-x-100" />
                  </Link>
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
