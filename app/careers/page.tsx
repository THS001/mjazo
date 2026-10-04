import type { Metadata } from "next"
import { PageHero } from "@/components/site/page-hero"
import { Container, Pill, Reveal } from "@/components/site/primitives"
import { getPage } from "@/lib/cms/read"
import type { CareersContent } from "@/lib/cms/types/pages/company"

export const metadata: Metadata = {
  alternates: { canonical: "/careers" },
  title: "Careers at Mjazo: jobs in Karachi",
  description: "Help build Karachi's most trusted home-services platform. Operations, customer care, training and technology.",
}

export default async function CareersPage() {
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
