import type { Metadata } from "next"
import { PageHero } from "@/components/site/page-hero"
import { Container } from "@/components/site/primitives"
import { ComplaintForm } from "@/components/site/complaint-form"
import { getPage, getSettings } from "@/lib/cms/read"
import type { ComplaintContent } from "@/lib/cms/types/pages/company"
import { waLink } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const { policy } = await getSettings()
  return {
    alternates: { canonical: "/complaint" },
    title: "Report a problem with a booking",
    description: `Something not right with your Mjazo visit? Tell us within ${policy.redoHours} hours for a free redo. A real person reviews every report.`,
  }
}

export default async function ComplaintPage() {
  const [{ site }, c] = await Promise.all([getSettings(), getPage<ComplaintContent>("complaint")])
  return (
    <>
      <PageHero
        crumbs={[{ label: "Help", href: "/help" }, { label: "Report a problem" }]}
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        sub={c.hero.sub}
        style={{ background: "linear-gradient(180deg, #f6efe4 0%, #fafaf8 100%)" }}
        bgWord="SORRY"
      />
      <section className="pb-24 -mt-4">
        <Container className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
          <ComplaintForm />
          <aside className="space-y-3">
            {c.promises.map((p, i) => (
              <div key={i} className="rounded-3xl bg-white border border-zinc-200 p-6">
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed">{p.body}</p>
              </div>
            ))}
            <a href={waLink(site.whatsapp, c.talk.message)} target="_blank" rel="noreferrer" className="block rounded-3xl bg-[#25D366] text-foreground p-6">
              <p className="font-medium">{c.talk.title}</p>
              <p className="text-sm text-foreground/75 mt-1">{c.talk.body}</p>
            </a>
          </aside>
        </Container>
      </section>
    </>
  )
}
