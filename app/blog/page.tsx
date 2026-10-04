import Link from "next/link"
import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { PageHero } from "@/components/site/page-hero"
import { Container, Reveal } from "@/components/site/primitives"
import { getContent, getPage } from "@/lib/cms/read"
import type { PostSite } from "@/lib/cms/types/content"
import type { BlogContent } from "@/lib/cms/types/pages/editorial"
import { CmsImage, isImage } from "@/components/cms/image"

export const metadata: Metadata = {
  alternates: { canonical: "/blog" },
  title: "Mjazo Journal: beauty plans & home guides for Karachi",
  description: "Beauty plans, home checklists and how we work, written for Karachi.",
}

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

export default async function BlogPage() {
  const [posts, c] = await Promise.all([getContent<PostSite>("post"), getPage<BlogContent>("blog")])
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date))
  const [lead, ...rest] = sorted
  return (
    <>
      <PageHero image={c.heroImage} crumbs={[{ label: "Journal" }]} eyebrow={c.hero.eyebrow} title={c.hero.title} sub={c.hero.sub || undefined} bgWord="JOURNAL" className="bg-white" />
      <Container className="pb-24">
        {lead && (
          <Reveal>
            <Link href={`/blog/${lead.slug}`} className="group grid lg:grid-cols-2 rounded-[2.5rem] overflow-hidden border border-zinc-200">
              <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[420px] flex items-center justify-center p-12 overflow-hidden" style={{ background: lead.tint }}>
                {isImage(lead.cover) && (
                  <>
                    <CmsImage img={lead.cover} priority sizes="(min-width: 1024px) 50vw, 100vw" className="transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </>
                )}
                <p className={`relative font-serif text-5xl sm:text-6xl text-center text-balance ${isImage(lead.cover) ? "text-white" : ""}`}>{lead.title}</p>
              </div>
              <div className="p-8 sm:p-12 flex flex-col justify-between">
                <div>
                  <p className="text-sm text-zinc-500">
                    {lead.tag} · {lead.minutes} {c.minRead} · {fmt(lead.date)}
                  </p>
                  <p className="text-xl mt-4 text-zinc-700">{lead.excerpt}</p>
                </div>
                <span className="mt-10 inline-flex items-center gap-2 font-medium">
                  {c.read} <ArrowUpRight className="w-5 h-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>
        )}
        <div className="grid md:grid-cols-2 gap-5 mt-5">
          {rest.map((p, i) => (
            <Reveal key={p.slug} delay={i * 0.08}>
              <Link href={`/blog/${p.slug}`} className="group block rounded-[2rem] overflow-hidden border border-zinc-200 h-full">
                <div className="relative aspect-[16/9] flex items-end p-8 overflow-hidden" style={{ background: p.tint }}>
                  {isImage(p.cover) && (
                    <>
                      <CmsImage img={p.cover} sizes="(min-width: 768px) 50vw, 100vw" className="transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </>
                  )}
                  <p className={`relative font-serif text-4xl text-balance ${isImage(p.cover) ? "text-white" : ""}`}>{p.title}</p>
                </div>
                <div className="p-8">
                  <p className="text-sm text-zinc-500">
                    {p.tag} · {p.minutes} {c.minRead}
                  </p>
                  <p className="text-zinc-700 mt-3">{p.excerpt}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </>
  )
}
