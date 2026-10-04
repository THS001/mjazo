import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/site/page-hero"
import { Container, Pill, Reveal } from "@/components/site/primitives"
import { ReadingProgress } from "@/components/site/reading-progress"
import { RichText } from "@/components/cms/rich-text"
import { getContent, getPage, getSettings } from "@/lib/cms/read"
import type { PostSite } from "@/lib/cms/types/content"
import type { BlogContent } from "@/lib/cms/types/pages/editorial"

export async function generateStaticParams() {
  return (await getContent<PostSite>("post")).map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = (await getContent<PostSite>("post")).find((x) => x.slug === slug)
  return p ? { title: p.title, description: p.excerpt, alternates: { canonical: `/blog/${p.slug}` }, openGraph: { type: "article", title: p.title, description: p.excerpt } } : {}
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [{ site }, posts, c] = await Promise.all([getSettings(), getContent<PostSite>("post"), getPage<BlogContent>("blog")])
  const post = posts.find((x) => x.slug === slug)
  if (!post) notFound()
  const others = posts.filter((p) => p.slug !== post.slug).slice(0, 4)
  const schema = { "@context": "https://schema.org", "@type": "Article", headline: post.title, datePublished: post.date, publisher: { "@type": "Organization", name: site.name } }
  return (
    <article>
      <ReadingProgress />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <header className="pt-32 sm:pt-36 pb-16" style={{ background: post.tint }}>
        <Container className="max-w-4xl">
          <Breadcrumbs items={[{ label: "Journal", href: "/blog" }, { label: post.tag }]} />
          <h1 className="font-serif text-5xl sm:text-7xl leading-[1] text-balance">{post.title}</h1>
          <p className="text-black/60 mt-6">
            {post.minutes} {c.minRead} · {new Date(`${post.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
          </p>
        </Container>
      </header>
      <Container className="max-w-3xl py-16">
        <p className="text-2xl leading-relaxed text-zinc-700 font-serif">{post.excerpt}</p>
        <Reveal className="mt-12">
          <RichText
            doc={post.body}
            classes={{
              h2: "font-serif text-3xl mt-8 mb-3 first:mt-0",
              p: "text-lg leading-relaxed text-zinc-700 mt-8 first:mt-0 [h2+&]:mt-0 [h3+&]:mt-2",
            }}
          />
        </Reveal>
        <div className="mt-16 flex flex-wrap gap-3">
          <Pill href={c.cta.href}>{c.cta.label}</Pill>
        </div>
      </Container>
      {others.length > 0 && (
        <section className="py-20 bg-zinc-50">
          <Container className="max-w-5xl">
            <p className="font-serif text-3xl mb-6">{c.keepReading}</p>
            <div className="grid md:grid-cols-2 gap-4">
              {others.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="rounded-3xl p-8 hover:-translate-y-1 transition-transform" style={{ background: p.tint }}>
                  <p className="text-sm text-black/50">{p.tag}</p>
                  <p className="font-serif text-3xl mt-2">{p.title}</p>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}
    </article>
  )
}
