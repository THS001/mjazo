import type { Metadata } from "next"
import { Breadcrumbs } from "@/components/site/page-hero"
import { Container, SplitText } from "@/components/site/primitives"
import { HeroReveal } from "@/components/site/reveal-client"
import { GharScan } from "@/components/ai/ghar-scan"
import { FAQ } from "@/components/site/faq"

export const metadata: Metadata = {
  alternates: { canonical: "/ghar-scan" },
  title: "Ghar Scan: snap a photo, get the fix and the price",
  description: "Photograph an AC leak, damp wall, termite trail or appliance error, or a beauty look you love. Mjazo's AI tells you the likely issue, the right service and the price range, and books it.",
}

export default function GharScanPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#0e0f11] text-white pt-28 sm:pt-36 pb-16 sm:pb-24">
        <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <Container className="relative">
          <Breadcrumbs items={[{ label: "Ghar Scan" }]} light />
          <div className="max-w-3xl mb-10">
            <HeroReveal><p className="text-xs uppercase tracking-[0.2em] text-brand mb-4">Mjazo AI · Ghar Scan</p></HeroReveal>
            <h1 className="font-serif text-[clamp(2.35rem,10vw,4.5rem)] leading-[1] text-balance"><SplitText text="Snap it. See the fix. See the price." delay={0.1} /></h1>
            <HeroReveal delay={0.6}><p className="text-white/65 text-lg mt-5">Show us the problem, or the look you want. Our AI reads the photo, names the likely issue and matches it to the right Mjazo service, priced from our menu.</p></HeroReveal>
          </div>
          <GharScan />
        </Container>
      </section>
      <FAQ
        title="Ghar Scan, explained"
        items={[
          ["Is the price final?", "It's a range from the Mjazo menu. Your pro confirms the exact price before starting any work, and parts are always priced separately with your approval."],
          ["What happens to my photos?", "They're used only to make this recommendation and aren't stored. If you book, nothing from the scan is kept except what you choose to save, like a Look Card."],
          ["What if the AI isn't sure?", "It tells you so. Tap ‘Show a technician on a video call’ and a person will look at it with you on WhatsApp."],
          ["Can it diagnose skin or health problems?", "No. Ghar Scan is for home problems and beauty looks only. For health concerns, please see a doctor."],
        ]}
      />
    </>
  )
}
