import Link from "next/link"
import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { PageHero } from "@/components/site/page-hero"
import { Container, Pill, Reveal, SectionTitle } from "@/components/site/primitives"
import { Petals } from "@/components/site/petals"
import { EnquiryForm } from "@/components/site/forms"
import { areaOptions } from "@/lib/catalog"
import { getCatalog } from "@/lib/cms/read"

export const metadata: Metadata = {
  alternates: { canonical: "/weddings" },
  title: "Bridal party & wedding glam at home in Karachi",
  description: "Party makeup, hair, mehndi and pre-event glow for the bride's family and guests, at home across Karachi. Squad bookings for 3+ guests.",
}

const BLUSH = "linear-gradient(180deg, #f9e3df 0%, #fbeee6 55%, #fdf7f1 100%)"

const WHO = [
  { t: "The family glam", d: "Mothers, sisters, khalas: party makeup and hair for everyone, at home, on schedule.", tint: "#f6d9cf" },
  { t: "Mehndi crew", d: "Henna artists for the bride's hands and feet, and quick designs for every guest.", tint: "#f7e3b5" },
  { t: "Guest glam", d: "Soft glam or full glam for guests, so nobody sits in salon traffic in their outfit.", tint: "#f3dbe2" },
  { t: "Pre-wedding glow", d: "A two-week plan of facials, waxing, mani-pedi and brows, timed to the big days.", tint: "#e7d9ee" },
  { t: "Bridal, by request", d: "Tell us your dates. We'll match you with a senior artist and send a fixed quote.", tint: "#e2ddd5" },
  { t: "Office & event days", d: "Wellness days and glam stations for corporate events and celebrations.", tint: "#d6e9e4" },
]

export default async function WeddingsPage() {
  const { areas, bundles, getService } = await getCatalog()
  const squad = getService("makeup-mehndi", "squad-glam")!
  const shaadi = bundles.find((b) => b.slug === "shaadi-ready")!
  return (
    <>
      <div className="relative overflow-hidden" style={{ background: BLUSH }}>
        <Petals />
        <PageHero
          crumbs={[{ label: "Weddings & events" }]}
          eyebrow="Shaadi season"
          title="From dholki to walima, we've got your glam."
          sub="Glam for the whole family, at home. One booking, two or more pros, every outfit on time."
          actions={<><Pill href="/weddings/planner" size="lg">Plan it with Shaadi Orchestrator</Pill><Pill href="#enquire" variant="outline" size="lg">Just send us your dates</Pill></>}
          bgWord="SHAADI"
          center
        />
      </div>

      <section className="py-16 sm:py-24">
        <Container>
          <SectionTitle eyebrow="Who we glam" title="Everyone in the family photo." center />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WHO.map((w, i) => (
              <Reveal key={w.t} delay={(i % 3) * 0.08}>
                <div className="h-full rounded-[2rem] p-8 min-h-56 flex flex-col justify-end" style={{ background: w.tint }}>
                  <p className="font-serif text-3xl">{w.t}</p>
                  <p className="text-black/60 mt-2">{w.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-24" style={{ background: "#2a1416" }}>
        <Container className="text-white grid lg:grid-cols-2 gap-6">
          {[
            { name: squad.service.name, note: squad.service.short, price: `from ${formatPKR(squad.service.price)} per guest`, href: "/services/makeup-mehndi/squad-glam" },
            { name: shaadi.name, note: shaadi.note, price: formatPKR(shaadi.price), href: "/offers#shaadi-ready" },
          ].map((p, i) => (
            <Reveal key={p.name} delay={i * 0.08}>
              <Link href={p.href} className="group block h-full rounded-[2rem] border border-white/15 p-10 hover:bg-white/[0.04] transition-colors">
                <p className="text-[#f4a437] text-sm">Package</p>
                <p className="font-serif text-5xl mt-3">{p.name}</p>
                <p className="text-white/60 mt-3 max-w-md">{p.note}</p>
                <div className="flex items-center justify-between mt-10">
                  <p className="text-xl">{p.price}</p>
                  <ArrowUpRight className="w-6 h-6 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                </div>
              </Link>
            </Reveal>
          ))}
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
          <div className="lg:sticky lg:top-28">
            <SectionTitle eyebrow="The two-week plan" title="Glowing, not freshly waxed." className="mb-6 md:mb-6" />
            <ol className="space-y-5 text-sm">
              {[["14 days before", "Facial: time to settle"], ["7–10 days", "Full body wax"], ["3–4 days", "Brows, upper lip, clean-up"], ["1–2 days", "Gel mani-pedi, hair spa"], ["On the day", "Makeup & hair at home"]].map(([d, t]) => (
                <li key={d} className="flex gap-4"><span className="w-28 shrink-0 text-zinc-400">{d}</span><span>{t}</span></li>
              ))}
            </ol>
            <Link href="/blog/two-week-shaadi-glow-plan" className="inline-block mt-4 py-2 text-sm underline underline-offset-4">Read the full plan</Link>
          </div>
          <div id="enquire" className="scroll-mt-28">
            <p className="font-serif text-4xl mb-6">Tell us about your event</p>
            <EnquiryForm
              kind="wedding"
              submitLabel="Plan my shaadi glam"
              whatsappText="Hi Mjazo! I'd like to plan glam for a wedding event."
              extras={[
                { name: "event", label: "Event", type: "select", options: ["Dholki", "Mayun", "Mehndi", "Baraat", "Nikkah", "Walima", "Other"], required: true },
                { name: "date", label: "Event date", type: "date", required: true },
                { name: "guests", label: "How many people need glam?", type: "number", required: true, placeholder: "e.g. 6" },
                { name: "area", label: "Area", type: "select", options: areaOptions(areas), required: true },
                { name: "services", label: "What do you need?", type: "chips", multi: true, options: ["Party makeup", "Hairstyling", "Mehndi", "Pre-event facial", "Waxing", "Mani-pedi", "Bridal"], required: true },
              ]}
            />
          </div>
        </Container>
      </section>
    </>
  )
}
