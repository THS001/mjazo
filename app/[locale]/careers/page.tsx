import type { Metadata } from "next"
import { PageHero } from "@/components/site/page-hero"
import { Container, Pill, Reveal } from "@/components/site/primitives"
import { getPage } from "@/lib/cms/read"
import type { CareersContent } from "@/lib/cms/types/pages/company"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/careers", seo: (await getPage("careers")).seo })
}

export default async function CareersPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const c = await getPage<CareersContent>("careers")
  return (
    <>
      <PageHero
        image={c.heroImage}
        crumbs={[{ label: "Careers" }]}
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        sub={c.hero.sub}
        actions={
          <>
            <Pill href={c.primary.href}>{c.primary.label}</Pill>
            <Pill href={c.secondary.href} variant="outline">
              {c.secondary.label}
            </Pill>
          </>
        }
        bgWord="TEAM"
        className="bg-white"
      />
      <section className="py-16 sm:py-24 bg-zinc-50">
        <Container>
          <p className="text-sm text-zinc-500 mb-8">{c.teamsLabel}</p>
          <div className="divide-y divide-zinc-200 border-y border-zinc-200">
            {c.teams.map((x, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div className="grid md:grid-cols-[1fr_1.4fr] gap-4 py-8">
                  <p className="font-serif text-4xl">{x.title}</p>
                  <p className="text-zinc-600 md:pt-3">{x.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="text-sm text-zinc-500 mt-8">
            {c.noteBefore}{" "}
            <a className="underline" href={`mailto:${c.careersEmail}`}>
              {c.careersEmail}
            </a>{" "}
            {c.noteAfter}
          </p>
        </Container>
      </section>
    </>
  )
}
