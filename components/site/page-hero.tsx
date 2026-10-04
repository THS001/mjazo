import Link from "@/components/site/locale-link"
import type { CSSProperties, ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { SplitText } from "./primitives"
import { HeroReveal } from "./reveal-client"
import { SITE_URL } from "@/lib/site"
import { CmsImage, isImage } from "@/components/cms/image"
import type { Img } from "@/lib/cms/fields"
import { CrumbLabel } from "@/components/cms/provider"

export type Crumb = { label: string; href?: string }

export function Breadcrumbs({ items, light }: { items: Crumb[]; light?: boolean }) {
  const all: Crumb[] = [{ label: "Home", href: "/" }, ...items]
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, ...(c.href ? { item: `${SITE_URL}${c.href}` } : {}) })),
  }
  return (
    <nav aria-label="Breadcrumb" className={cn("text-xs mb-6", light ? "text-white/70" : "text-zinc-500")}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <ol className="flex flex-wrap items-center gap-1">
        {all.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 opacity-60 rtl:-scale-x-100" />}
            {c.href && i < all.length - 1 ? (
              <Link href={c.href} className={cn("inline-block py-1.5 hover:underline underline-offset-4", light ? "hover:text-white" : "hover:text-black")}><CrumbLabel label={c.label} /></Link>
            ) : (
              <span className={light ? "text-white" : "text-black"} aria-current={i === all.length - 1 ? "page" : undefined}><CrumbLabel label={c.label} /></span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Inner-page hero. Each page passes its own background (style/className) so every page
 * gets its own look while sharing the same rhythm: crumbs → eyebrow → split-text H1 → sub → actions.
 */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  sub,
  actions,
  visual,
  dark,
  className,
  style,
  bgWord,
  center,
  children,
  image,
}: {
  crumbs?: Crumb[]
  eyebrow?: ReactNode
  title: string
  sub?: ReactNode
  actions?: ReactNode
  visual?: ReactNode
  dark?: boolean
  className?: string
  style?: CSSProperties
  bgWord?: string
  center?: boolean
  children?: ReactNode
  /** A photo from the CMS; replaces `visual` when set. */
  image?: Img
}) {
  if (isImage(image))
    visual = (
      <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] sm:rounded-[2.5rem]">
        <CmsImage img={image} priority sizes="(min-width: 1024px) 45vw, 100vw" />
      </div>
    )
  return (
    <section className={cn("relative overflow-hidden pt-28 sm:pt-36 pb-14 sm:pb-20", dark && "text-white", className)} style={style}>
      {bgWord && (
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none overflow-hidden">
          <span className={cn("font-bold leading-[0.8] tracking-tighter whitespace-nowrap select-none text-[22vw] lg:text-[18vw] translate-y-[18%]", dark ? "text-white/[0.06]" : "text-black/[0.04]")}>{bgWord}</span>
        </div>
      )}
      <div className={cn("relative max-w-7xl 2xl:max-w-[1400px] mx-auto px-4 sm:px-6 grid gap-8 sm:gap-10 items-center", visual ? "lg:grid-cols-[1.1fr_0.9fr]" : "")}>
        <div className={cn("min-w-0", center && !visual && "text-center mx-auto max-w-4xl")}>
          {crumbs && <Breadcrumbs items={crumbs} light={dark} />}
          {eyebrow && <HeroReveal delay={0.05}><div className={cn("text-xs uppercase tracking-[0.2em] font-medium mb-5", dark ? "text-white/60" : "text-zinc-500")}>{eyebrow}</div></HeroReveal>}
          <h1 className="font-serif font-normal text-[clamp(2.35rem,10vw,3.75rem)] lg:text-7xl 2xl:text-[5.25rem] leading-[1] tracking-tight text-balance">
            <SplitText text={title} delay={0.15} />
          </h1>
          {sub && (
            <HeroReveal delay={0.6}>
              <div className={cn("mt-5 sm:mt-6 text-base sm:text-lg leading-relaxed max-w-2xl", center && !visual && "mx-auto", dark ? "text-white/75" : "text-zinc-600")}>{sub}</div>
            </HeroReveal>
          )}
          {actions && (
            <HeroReveal delay={0.75}>
              <div className={cn("mt-8 flex flex-wrap gap-3 items-center", center && !visual && "justify-center")}>{actions}</div>
            </HeroReveal>
          )}
          {children}
        </div>
        {visual && <div className="relative">{visual}</div>}
      </div>
    </section>
  )
}
