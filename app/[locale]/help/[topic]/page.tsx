import Link from "@/components/site/locale-link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { HelpTopic } from "@/lib/content"
import { Breadcrumbs } from "@/components/site/page-hero"
import { Container, Icon } from "@/components/site/primitives"
import { FAQ } from "@/components/site/faq"
import { getContent, getPage, getSettings, getSeoSettings } from "@/lib/cms/read"
import { renderTokens } from "@/lib/cms/fields"
import type { HelpContent } from "@/lib/cms/types/pages/editorial"
import { waLink } from "@/lib/site"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateStaticParams() {
  return (await getContent<HelpTopic>("help-topic")).map((t) => ({ topic: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; topic: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const { topic } = await params
  const [topics, s] = await Promise.all([getContent<HelpTopic>("help-topic"), getSeoSettings()])
  const t = topics.find((x) => x.slug === topic)
  return t ? pageMetadata({ path: `/help/${t.slug}`, seo: t.seo, title: s.patterns.helpTitle, description: `${t.blurb}. ${t.articles.map(([q]) => q).join(" ")}`.slice(0, 300), vars: { topic: t.title } }) : {}
}

export default async function HelpTopicPage({ params }: { params: Promise<{ locale: string; topic: string }> }) {
  await pageLocale(params)
  const { topic: slug } = await params
  const [{ site }, c, topics] = await Promise.all([getSettings(), getPage<HelpContent>("help"), getContent<HelpTopic>("help-topic")])
  const topic = topics.find((x) => x.slug === slug)
  if (!topic) notFound()
  return (
    <div className="bg-zinc-50 min-h-screen">
      <section className="pt-32 sm:pt-36 pb-6">
        <Container>
          <Breadcrumbs items={[{ label: "Help", href: "/help" }, { label: topic.title }]} />
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center">
              <Icon name={topic.icon} className="w-7 h-7" />
            </span>
            <h1 className="font-serif text-5xl">{topic.title}</h1>
          </div>
          <nav className="flex gap-2 overflow-x-auto no-scrollbar mt-8">
            {topics.map((t) => (
              <Link key={t.slug} href={`/help/${t.slug}`} className={`shrink-0 rounded-full h-10 px-4 text-sm flex items-center border ${t.slug === topic.slug ? "bg-foreground text-background border-foreground" : "bg-white border-zinc-200"}`}>
                {t.title}
              </Link>
            ))}
          </nav>
        </Container>
      </section>
      <FAQ items={topic.articles} title={topic.blurb} />
      <div className="text-center pb-24 text-sm text-zinc-600">
        {c.stuck}{" "}
        <a href={waLink(site.whatsapp, renderTokens(c.topicMessage, { topic: topic.title.toLowerCase() }))} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {c.whatsapp}
        </a>
      </div>
    </div>
  )
}
