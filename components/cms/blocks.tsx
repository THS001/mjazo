import type { ReactNode } from "react"
import Link from "@/components/site/locale-link"
import { ImageIcon, Film } from "lucide-react"
import { PageHero } from "@/components/site/page-hero"
import { Container, Icon, Pill, Reveal, SectionTitle } from "@/components/site/primitives"
import { FAQ } from "@/components/site/faq"
import { RichText } from "@/components/cms/rich-text"
import { CmsImage, isImage } from "@/components/cms/image"
import { Accent, plainText } from "@/components/cms/accent"
import type { Img, RichDoc } from "@/lib/cms/fields"
import type { SiteBlock } from "@/lib/cms/types/block-page"
import { cn } from "@/lib/utils"
import { PageForm, PromiseRows, ServiceGrid } from "./blocks-client"

// Renders a block page's blocks with the site's own components. Every block carries
// data-cms="blocks.<n>" (and its main texts their own field path), which the editor's live preview
// uses for click-to-edit. In preview, empty images and lists show a placeholder instead of nothing.

type Tone = "light" | "dark" | "saffron" | "blush"
const TONE: Record<Tone, string> = {
  light: "bg-background text-foreground",
  // Muted greys don't read on ink: lift them.
  dark: "bg-foreground text-background [&_.text-muted-foreground]:text-white/70 [&_.text-zinc-500]:text-white/60 [&_.text-zinc-600]:text-white/75 [&_.text-zinc-700]:text-white/80",
  saffron: "bg-brand text-foreground [&_.text-muted-foreground]:text-foreground/70",
  blush: "bg-brand-soft text-foreground",
}
const toneOf = (b: SiteBlock): Tone => (typeof b.tone === "string" && b.tone in TONE ? (b.tone as Tone) : "light")
const str = (v: unknown) => (typeof v === "string" ? v : "")
type Button = { label: string; href: string }
const buttons = (v: unknown): Button[] => (Array.isArray(v) ? (v as Button[]).filter((b) => b?.label && b?.href) : [])
const GRID: Record<string, string> = { "2": "sm:grid-cols-2", "3": "sm:grid-cols-2 lg:grid-cols-3", "4": "sm:grid-cols-2 lg:grid-cols-4" }
const DARK_RICH = { p: "text-lg leading-relaxed text-white/80 mt-5", ul: "mt-5 list-disc space-y-1.5 ps-6 text-lg leading-relaxed text-white/80", ol: "mt-5 list-decimal space-y-1.5 ps-6 text-lg leading-relaxed text-white/80", quote: "mt-6 border-s-2 border-brand ps-5 font-serif text-xl italic text-white" }

export function Blocks({ blocks, path, preview }: { blocks: SiteBlock[]; path: string; preview?: boolean }) {
  return (
    <>
      {blocks.map((b, i) => (
        <Block key={b._key || i} b={b} at={`blocks.${i}`} path={path} preview={Boolean(preview)} />
      ))}
    </>
  )
}

function Frame({ at, b, children, plain }: { at: string; b: SiteBlock; children: ReactNode; plain?: boolean }) {
  return (
    <div data-cms={at} data-cms-block={b._type} id={str(b.anchor) || undefined} className={cn("scroll-mt-24", !plain && TONE[toneOf(b)])}>
      {children}
    </div>
  )
}

function Buttons({ items, dark, center }: { items: Button[]; dark?: boolean; center?: boolean }) {
  if (!items.length) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-3", center && "justify-center")}>
      {items.slice(0, 2).map((x, i) => (
        <Pill key={i} href={x.href} variant={i === 0 ? (dark ? "brand" : "solid") : dark ? "light" : "outline"} size="lg">
          {x.label}
        </Pill>
      ))}
    </div>
  )
}

function Placeholder({ icon, text, className }: { icon: ReactNode; text: string; className?: string }) {
  return (
    <div className={cn("grid place-items-center rounded-[2rem] border-2 border-dashed border-current/20 text-sm opacity-60", className)}>
      <span className="flex flex-col items-center gap-2 p-6 text-center">
        {icon}
        {text}
      </span>
    </div>
  )
}

function Block({ b, at, path, preview }: { b: SiteBlock; at: string; path: string; preview: boolean }) {
  const dark = toneOf(b) === "dark"
  switch (b._type) {
    case "hero": {
      const tone = toneOf(b)
      return (
        <Frame at={at} b={b} plain>
          <PageHero
            eyebrow={str(b.eyebrow) || undefined}
            title={plainText(str(b.title))}
            sub={str(b.sub) || undefined}
            image={isImage(b.image as Img) ? (b.image as Img) : undefined}
            actions={buttons(b.buttons).length ? <Buttons items={buttons(b.buttons)} dark={dark} /> : undefined}
            dark={dark}
            center={Boolean(b.center)}
            className={TONE[tone]}
          />
        </Frame>
      )
    }

    case "text":
      return (
        <Frame at={at} b={b}>
          <section className="py-12 sm:py-16">
            <Container className={b.width === "wide" ? "max-w-5xl" : "max-w-3xl"}>
              {str(b.title) && (
                <h2 data-cms={`${at}.title`} className="font-serif text-3xl leading-tight sm:text-4xl">
                  <Accent text={str(b.title)} />
                </h2>
              )}
              <div data-cms={`${at}.body`}>
                <RichText doc={b.body as RichDoc} classes={dark ? DARK_RICH : undefined} />
              </div>
            </Container>
          </section>
        </Frame>
      )

    case "imageText": {
      const img = b.image as Img
      const right = b.imageSide === "right"
      const href = str(b.buttonHref)
      // No image yet: visitors get the text on its own; the preview shows where the image goes.
      const showImage = isImage(img) || preview
      return (
        <Frame at={at} b={b}>
          <section className="py-14 sm:py-20">
            <Container className={cn("grid items-center gap-8 lg:gap-14", showImage ? "lg:grid-cols-2" : "max-w-3xl")}>
              {showImage && (
                <Reveal className={cn("relative aspect-[4/3] overflow-hidden rounded-[2rem]", right && "lg:order-2")}>
                  {isImage(img) ? <CmsImage img={img} sizes="(min-width: 1024px) 45vw, 100vw" /> : <Placeholder icon={<ImageIcon className="h-6 w-6" />} text="Choose an image" className="absolute inset-0" />}
                </Reveal>
              )}
              <div>
                {str(b.eyebrow) && <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{str(b.eyebrow)}</p>}
                {str(b.title) && (
                  <h2 data-cms={`${at}.title`} className="font-serif text-[clamp(2rem,6vw,3rem)] leading-[1.05] text-balance">
                    <Accent text={str(b.title)} />
                  </h2>
                )}
                {str(b.body) && (
                  <p data-cms={`${at}.body`} className="mt-5 whitespace-pre-line text-lg leading-relaxed text-muted-foreground">
                    {str(b.body)}
                  </p>
                )}
                {str(b.buttonLabel) && href && (
                  <div className="mt-8">
                    <Buttons items={[{ label: str(b.buttonLabel), href }]} dark={dark} />
                  </div>
                )}
              </div>
            </Container>
          </section>
        </Frame>
      )
    }

    case "cards": {
      const items = (Array.isArray(b.items) ? b.items : []) as { icon?: string; title: string; body?: string; href?: string }[]
      return (
        <Frame at={at} b={b}>
          <section className="py-14 sm:py-20">
            <Container>
              {(str(b.title) || str(b.eyebrow)) && <SectionTitle eyebrow={str(b.eyebrow) || undefined} title={<Accent text={str(b.title)} />} sub={str(b.sub) || undefined} center />}
              <div className={cn("grid gap-4", GRID[str(b.columns)] ?? GRID["3"])}>
                {items.map((c, i) => {
                  const card = (
                    <div data-cms={`${at}.items.${i}`} className={cn("h-full rounded-3xl border p-6 sm:p-7 transition-colors", dark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white", c.href && (dark ? "hover:border-white/40" : "hover:border-foreground"))}>
                      {c.icon && (
                        <span className={cn("mb-5 grid h-11 w-11 place-items-center rounded-2xl", dark ? "bg-white/10 text-brand" : "bg-brand-soft text-brand-ink")}>
                          <Icon name={c.icon} className="h-5 w-5" />
                        </span>
                      )}
                      <h3 className="text-lg font-medium">{c.title}</h3>
                      {c.body && <p className="mt-2 leading-relaxed text-muted-foreground">{c.body}</p>}
                    </div>
                  )
                  return (
                    <Reveal key={i} delay={i * 0.06}>
                      {c.href ? (
                        <Link href={c.href} className="block h-full">
                          {card}
                        </Link>
                      ) : (
                        card
                      )}
                    </Reveal>
                  )
                })}
              </div>
            </Container>
          </section>
        </Frame>
      )
    }

    case "services":
      return (
        <Frame at={at} b={b}>
          <section className="py-14 sm:py-20">
            <Container>
              {(str(b.title) || str(b.eyebrow)) && <SectionTitle eyebrow={str(b.eyebrow) || undefined} title={<Accent text={str(b.title)} />} sub={str(b.sub) || undefined} center />}
              <ServiceGrid source={str(b.source) || "popular"} limit={Number(b.limit) || 4} category={str(b.category)} services={Array.isArray(b.services) ? (b.services as string[]) : []} emptyNote={preview ? "No services match. Pick some, or choose a category." : undefined} />
            </Container>
          </section>
        </Frame>
      )

    case "faq": {
      const items = (Array.isArray(b.items) ? b.items : []) as { q: string; a: string }[]
      return (
        <Frame at={at} b={b} plain>
          <FAQ items={items.map((x) => [x.q, x.a] as [string, string])} title={str(b.title) || undefined} id={str(b.anchor) || `faq-${b._key}`} />
        </Frame>
      )
    }

    case "cta":
      return (
        <Frame at={at} b={b}>
          <section className="relative overflow-hidden py-20 sm:py-28">
            <Container className="relative text-center">
              <Reveal>
                <h2 data-cms={`${at}.title`} className="mx-auto max-w-4xl font-serif text-5xl leading-[1.02] text-balance md:text-6xl">
                  <Accent text={str(b.title)} />
                </h2>
                {str(b.sub) && (
                  <p data-cms={`${at}.sub`} className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
                    {str(b.sub)}
                  </p>
                )}
                <div className="mt-10">
                  <Buttons items={buttons(b.buttons)} dark={dark} center />
                </div>
              </Reveal>
            </Container>
          </section>
        </Frame>
      )

    case "promises": {
      const items = (Array.isArray(b.items) ? b.items : []).filter((x): x is string => typeof x === "string" && Boolean(x))
      return (
        <Frame at={at} b={b}>
          <section className="overflow-hidden py-14 sm:py-20">
            {(str(b.title) || str(b.eyebrow)) && (
              <Container>
                <SectionTitle eyebrow={str(b.eyebrow) || undefined} title={<Accent text={str(b.title)} />} sub={str(b.sub) || undefined} center />
              </Container>
            )}
            {items.length > 0 && <PromiseRows items={items} dark={dark} />}
          </section>
        </Frame>
      )
    }

    case "stats": {
      const items = (Array.isArray(b.items) ? b.items : []) as { value: string; label: string }[]
      return (
        <Frame at={at} b={b}>
          <section className="py-14 sm:py-20">
            <Container className="max-w-5xl">
              {str(b.title) && (
                <h2 data-cms={`${at}.title`} className="mb-12 text-center font-serif text-[clamp(2rem,6vw,3rem)] leading-[1.05]">
                  <Accent text={str(b.title)} />
                </h2>
              )}
              <div className={cn("grid grid-cols-2 gap-x-6 gap-y-10", items.length >= 4 ? "md:grid-cols-4" : items.length === 3 ? "md:grid-cols-3" : "")}>
                {items.map((s, i) => (
                  <Reveal key={i} delay={i * 0.08} className="text-center">
                    <p data-cms={`${at}.items.${i}.value`} className="mb-2 text-5xl font-light leading-none sm:text-6xl">
                      {s.value}
                    </p>
                    <p data-cms={`${at}.items.${i}.label`} className="text-xs uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </p>
                  </Reveal>
                ))}
              </div>
            </Container>
          </section>
        </Frame>
      )
    }

    case "video": {
      const v = b.video as Img
      const poster = isImage(b.poster as Img) ? (b.poster as NonNullable<Img>).url : undefined
      const ok = Boolean(v?.url) && (!v?.mime || v.mime.startsWith("video/"))
      if (!ok && !preview) return null
      return (
        <Frame at={at} b={b}>
          <section className="py-12 sm:py-16">
            <Container className="max-w-5xl">
              <div className="relative aspect-video overflow-hidden rounded-[2rem] bg-black/5">
                {ok ? (
                  b.autoplay ? (
                    <video src={v!.url} poster={poster} autoPlay muted loop playsInline className="h-full w-full object-cover" />
                  ) : (
                    <video src={v!.url} poster={poster} controls playsInline preload="metadata" className="h-full w-full object-cover" />
                  )
                ) : (
                  <Placeholder icon={<Film className="h-6 w-6" />} text="Choose a video" className="absolute inset-0" />
                )}
              </div>
              {str(b.caption) && <p className="mt-4 text-center text-sm text-muted-foreground">{str(b.caption)}</p>}
            </Container>
          </section>
        </Frame>
      )
    }

    case "gallery": {
      const images = (Array.isArray(b.images) ? b.images : []).filter((x) => isImage(x as Img)) as NonNullable<Img>[]
      if (!images.length && !preview) return null
      return (
        <Frame at={at} b={b}>
          <section className="py-12 sm:py-16">
            <Container>
              {str(b.title) && (
                <h2 data-cms={`${at}.title`} className="mb-10 text-center font-serif text-[clamp(2rem,6vw,3rem)] leading-[1.05]">
                  <Accent text={str(b.title)} />
                </h2>
              )}
              {images.length ? (
                <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", str(b.columns) === "4" ? "lg:grid-cols-4" : str(b.columns) === "2" ? "" : "lg:grid-cols-3")}>
                  {images.map((img, i) => (
                    <Reveal key={`${img.id}-${i}`} delay={i * 0.04} className="relative aspect-square overflow-hidden rounded-2xl sm:rounded-3xl">
                      <CmsImage img={img} sizes="(min-width: 1024px) 33vw, 50vw" />
                    </Reveal>
                  ))}
                </div>
              ) : (
                <Placeholder icon={<ImageIcon className="h-6 w-6" />} text="Add photos to the gallery" className="aspect-[3/1]" />
              )}
            </Container>
          </section>
        </Frame>
      )
    }

    case "form":
      return (
        <Frame at={at} b={b}>
          <section className="py-14 sm:py-20">
            <Container className="max-w-3xl">
              {(str(b.title) || str(b.eyebrow)) && <SectionTitle eyebrow={str(b.eyebrow) || undefined} title={<Accent text={str(b.title)} />} sub={str(b.sub) || undefined} center />}
              <PageForm path={path} title={plainText(str(b.title))} askDate={Boolean(b.askDate)} askArea={Boolean(b.askArea)} whatsapp={Boolean(b.whatsapp)} submitLabel={str(b.submitLabel)} success={str(b.success)} dark={dark} />
            </Container>
          </section>
        </Frame>
      )

    case "spacer":
      return (
        <Frame at={at} b={b} plain>
          <div className={cn("flex items-center", b.size === "sm" ? "h-8" : b.size === "lg" ? "h-32" : "h-16")}>
            {Boolean(b.line) && (
              <Container className="w-full">
                <hr className="border-zinc-200" />
              </Container>
            )}
          </div>
        </Frame>
      )

    default:
      return null
  }
}
