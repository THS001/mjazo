import Link from "@/components/site/locale-link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { LegalDoc } from "@/lib/content"
import { getContent, getPage, getSeoSettings } from "@/lib/cms/read"
import { pageMetadata } from "@/lib/cms/seo/metadata"
import type { LegalLabels } from "@/lib/cms/types/pages/editorial"
import { Breadcrumbs } from "./page-hero"
import { Container } from "./primitives"

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-")
const fmt = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : d)

/** Everything a legal page needs from the CMS. */
export async function loadLegal(slug: string) {
  const [docs, labels] = await Promise.all([getContent<LegalDoc>("legal"), getPage<LegalLabels>("legal")])
  const doc = docs.find((d) => d.slug === slug)
  if (!doc) notFound()
  return { doc, docs, labels }
}

export async function legalMetadata(slug: string, path: string): Promise<Metadata> {
  const [docs, s] = await Promise.all([getContent<LegalDoc>("legal"), getSeoSettings()])
  const doc = docs.find((d) => d.slug === slug)
  return doc ? pageMetadata({ path, seo: doc.seo, title: doc.title, description: s.patterns.legalDescription, vars: { title: doc.title } }) : {}
}

export function LegalPage({ doc, docs, labels }: { doc: LegalDoc; docs: LegalDoc[]; labels: LegalLabels }) {
  return (
    <div className="pt-32 sm:pt-36 pb-24">
      <Container className="max-w-6xl">
        <Breadcrumbs items={[{ label: doc.title }]} />

        <div className="grid lg:grid-cols-[240px_1fr] gap-12">
          <aside className="lg:sticky lg:top-28 self-start">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">{labels.policies}</p>
            <ul className="space-y-2 text-sm mb-8">
              {docs.map((d) => (
                <li key={d.slug}>
                  <Link href={`/${d.slug}`} className={d.slug === doc.slug ? "font-medium" : "text-zinc-500 hover:text-black"}>
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">{labels.onThisPage}</p>
            <ul className="space-y-2 text-sm">
              {doc.sections.map((s, i) => (
                <li key={i}>
                  <a href={`#${slugify(s.h)}`} className="text-zinc-500 hover:text-black">
                    {s.h}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
          <article>
            <h1 className="font-serif text-5xl sm:text-6xl">{doc.title}</h1>
            <p className="text-sm text-zinc-500 mt-3">
              {labels.updated} {fmt(doc.updated)}
            </p>
            <div className="mt-12 space-y-10 max-w-2xl">
              {doc.sections.map((s, i) => (
                <section key={i} id={slugify(s.h)} className="scroll-mt-28">
                  <h2 className="text-xl font-medium">
                    <span className="text-zinc-300 me-3">{String(i + 1).padStart(2, "0")}</span>
                    {s.h}
                  </h2>
                  {s.p.split(/\n{2,}/).map((para, j) => (
                    <p key={j} className="text-zinc-700 leading-relaxed mt-3">
                      {para}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </article>
        </div>
      </Container>
    </div>
  )
}
