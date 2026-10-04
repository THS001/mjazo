import type { Metadata } from "next"
import type { HelpTopic } from "@/lib/content"
import { HelpSearch } from "@/components/site/help-search"
import { Breadcrumbs } from "@/components/site/page-hero"
import { Container } from "@/components/site/primitives"
import { getContent, getPage, getSettings } from "@/lib/cms/read"
import type { HelpContent } from "@/lib/cms/types/pages/editorial"
import { waLink } from "@/lib/site"

export const metadata: Metadata = {
  alternates: { canonical: "/help" },
  title: "Help centre: bookings, payments, safety & more",
  description: "Answers about booking, prices and payment, safety, products and hygiene, changes and cancellations, and joining as a pro.",
}

export default async function HelpPage() {
  const [{ site }, c, topics] = await Promise.all([getSettings(), getPage<HelpContent>("help"), getContent<HelpTopic>("help-topic")])
  return (
    <div className="bg-zinc-50 min-h-screen">
      <section className="pt-32 sm:pt-36 pb-16 bg-white border-b border-zinc-200">
        <Container>
          <Breadcrumbs items={[{ label: "Help" }]} />
          <h1 className="font-serif text-5xl sm:text-6xl">{c.title}</h1>
          <p className="text-zinc-600 mt-4">
            {c.introBefore}{" "}
            <a className="underline underline-offset-4" href={waLink(site.whatsapp, c.whatsappMessage)} target="_blank" rel="noopener noreferrer">
              {c.whatsapp}
            </a>{" "}
            ({site.hours.toLowerCase()}).
          </p>
        </Container>
      </section>
      <HelpSearch topics={topics} labels={{ search: c.search, answer: c.answer, answers: c.answers, noAnswers: c.noAnswers }} />
    </div>
  )
}
