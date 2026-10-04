import Link from "next/link"
import type { Metadata } from "next"
import { ArrowUpRight, MapPin, MessageCircle } from "lucide-react"
import { PageHero } from "@/components/site/page-hero"
import { Container, Reveal, SectionTitle } from "@/components/site/primitives"
import { MapCanvas } from "@/components/three"
import { FAQ } from "@/components/site/faq"
import { getCatalog, getSettings } from "@/lib/cms/read"
import { waLink } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const { areas } = await getCatalog()
  return {
    title: "Home services across Karachi: DHA, Clifton, PECHS, Gulshan & more",
    description: `Mjazo comes to ${areas.length} Karachi neighbourhoods: ${areas.map((a) => a.name).join(", ")}. Salon at home, cleaning, AC, repairs and more, with verified pros.`,
    alternates: { canonical: "/karachi" },
  }
}

const SEA = "linear-gradient(180deg, oklch(0.93 0.035 220) 0%, oklch(0.96 0.025 200) 55%, oklch(0.975 0.015 85) 100%)"

export default async function KarachiPage() {
  const { areas } = await getCatalog()
  const { site } = await getSettings()
  const whatsappLink = (message: string) => waLink(site.whatsapp, message)
  const subTotal = areas.reduce((s, a) => s + a.subAreas.length, 0)
  return (
    <>
      <PageHero
        crumbs={[{ label: "Areas" }]}
        eyebrow={`${areas.length} neighbourhoods · ${subTotal} sub-areas`}
        title="From Clifton's sea breeze to Bahria's precincts."
        sub="One standard everywhere we go: vetted pros, sealed kits, on-time arrival windows and all-in prices you pay after."
        actions={areas.slice(0, 4).map((a) => (
          <Link key={a.slug} href={`/karachi/${a.slug}`} className="flex items-center gap-2 h-12 rounded-full bg-foreground text-background px-6 text-sm hover:bg-brand hover:text-foreground transition-colors"><MapPin className="w-4 h-4" />{a.name}</Link>
        ))}
        style={{ background: SEA }}
        bgWord="KARACHI"
      >
        <div className="mt-12 rounded-[2.5rem] overflow-hidden border border-white/70 bg-white/40 backdrop-blur">
          <MapCanvas className="h-[380px] sm:h-[520px]" fallback={<div className="h-full flex items-center justify-center text-zinc-400"><MapPin className="w-14 h-14" strokeWidth={1} /></div>} />
        </div>
        <p className="text-xs text-zinc-500 mt-3 text-center">Stylised map, not to scale. Hover a zone, click to open it.</p>
      </PageHero>

      <section className="py-16 sm:py-24">
        <Container>
          <SectionTitle eyebrow="Where we come" title="Pick your neighbourhood" sub="Every service on Mjazo is bookable in every neighbourhood below." />
          <div className="grid md:grid-cols-2 gap-4 [&>*]:min-w-0">
            {areas.map((a, i) => (
              <Reveal key={a.slug} delay={(i % 2) * 0.08}>
                <Link href={`/karachi/${a.slug}`} className="group block h-full rounded-[2rem] p-6 sm:p-8 border border-zinc-200 hover:border-zinc-400 hover:bg-[#f3f8fa] transition-colors">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-zinc-400">0{i + 1}</span>
                    <ArrowUpRight className="w-6 h-6 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                  </div>
                  <p className="font-serif text-[clamp(2rem,9vw,3rem)] leading-[1.05] mt-6 [overflow-wrap:anywhere]">{a.name}</p>
                  <p className="text-zinc-500 mt-2">{a.blurb}</p>
                  <div className="flex flex-wrap gap-1.5 mt-6">
                    {a.subAreas.map((s) => <span key={s} className="rounded-full bg-zinc-100 px-3 py-1 text-xs">{s}</span>)}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <a href={whatsappLink("Hi Mjazo! Do you cover my area?")} target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center justify-center gap-2 rounded-3xl bg-zinc-50 p-6 text-sm hover:bg-zinc-100 transition-colors">
            <MessageCircle className="w-5 h-5" /> Just outside these areas? WhatsApp us your location and we'll do our best to come.
          </a>
        </Container>
      </section>

      <FAQ
        title="Coverage, answered"
        items={[
          ["Is there a travel fee for farther areas?", "No. Prices are all-in wherever you are in our coverage."],
          ["How early can someone come?", "The earliest slot is about 2 hours from when you book, depending on availability. You can book up to 7 days ahead."],
          ["Do the same standards apply everywhere?", "Yes. Same vetting, same sealed kits, same live check-in and check-out, in every neighbourhood."],
        ]}
      />
    </>
  )
}
