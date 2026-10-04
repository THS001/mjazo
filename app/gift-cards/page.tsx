import type { Metadata } from "next"
import { PageHero } from "@/components/site/page-hero"
import { Container, Reveal, SectionTitle } from "@/components/site/primitives"
import { EnquiryForm } from "@/components/site/forms"
import { ObjectCanvas } from "@/components/three"
import { getPage } from "@/lib/cms/read"
import type { GiftContent } from "@/lib/cms/types/pages/commerce"

export const metadata: Metadata = {
  title: "Mjazo gift cards: give a glow-up in Karachi",
  description: "Send a Mjazo gift card for birthdays, Eid, the bride-to-be or a thank-you. Redeemable on every service, from salon at home to deep cleaning.",
  alternates: { canonical: "/gift-cards" },
}

const ROSE = "linear-gradient(160deg, #fbe9e4 0%, #f6d9cf 45%, #efc9a8 100%)"
// The card colours, in order; names and occasions come from the CMS.
const LOOKS = [
  { bg: "linear-gradient(135deg,#f6d9cf,#f4a437)" },
  { bg: "linear-gradient(135deg,#14201b,#3c5a49)", dark: true },
  { bg: "linear-gradient(135deg,#f3c7c7,#e86f6f)" },
  { bg: "linear-gradient(135deg,#111,#3a3a3a)", dark: true },
]

export default async function GiftCardsPage() {
  const c = await getPage<GiftContent>("gift-cards")
  const designs = c.designs.map((d, i) => ({ ...d, ...(LOOKS[i] ?? LOOKS[0]) }))
  const o = c.order
  return (
    <>
      <PageHero
        image={c.heroImage}
        crumbs={[{ label: "Gift cards" }]}
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        sub={c.hero.sub}
        visual={<ObjectCanvas kind="box" tint="#f3c7c7" icon="Gift" className="h-[320px] sm:h-[420px]" scale={2} />}
        style={{ background: ROSE }}
        bgWord="GIFT"
      />
      <section className="py-16 sm:py-24">
        <Container>
          <SectionTitle eyebrow={c.designsHead.eyebrow} title={c.designsHead.title} sub={c.designsHead.sub || undefined} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {designs.map((d, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div
                  className={`group aspect-[1.586] rounded-3xl p-6 flex flex-col justify-between shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)] transition-transform duration-500 hover:-rotate-2 hover:-translate-y-2 ${d.dark ? "text-white" : "text-black"}`}
                  style={{ background: d.bg }}
                >
                  <span className="text-xs tracking-[0.3em] opacity-70">MJAZO</span>
                  <div>
                    <p className="font-serif text-3xl">{d.name}</p>
                    <p className="text-sm opacity-70">{d.sub}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>
      <section className="py-16 sm:py-24 bg-[#fbf3ef]">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
          <SectionTitle eyebrow={o.eyebrow} title={o.title} sub={o.sub} />
          <EnquiryForm
            kind="gift"
            submitLabel={o.submit}
            success={o.success}
            whatsappText={o.whatsapp}
            extras={[
              { name: "design", label: o.design, type: "chips", options: designs.map((d) => d.name), required: true },
              { name: "amount", label: o.amount, type: "chips", options: o.amounts, required: true },
              { name: "recipient", label: o.recipient, type: "text", placeholder: o.recipientHint, required: true },
              { name: "recipientPhone", label: o.phone, type: "text", placeholder: o.phoneHint, required: true },
              { name: "note", label: o.note, type: "textarea", placeholder: o.noteHint },
            ]}
          />
        </Container>
      </section>
    </>
  )
}
