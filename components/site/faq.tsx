import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { SectionTitle } from "./primitives"
import { T } from "@/components/cms/provider"

export function FAQ({ items, title, id = "faq", withSchema = true }: { items: [string, string][]; title?: string; id?: string; withSchema?: boolean }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  }
  return (
    <section id={id} className="py-16 sm:py-24 px-4 sm:px-6">
      {withSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />}
      <div className="max-w-3xl mx-auto">
        <SectionTitle title={title || <T k="common.faqTitle" />} center />
        <Accordion type="single" collapsible className="w-full">
          {items.map(([q, a], i) => (
            <AccordionItem key={i} value={`q${i}`} className="border-zinc-200">
              <AccordionTrigger className="text-start text-base py-5 hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
