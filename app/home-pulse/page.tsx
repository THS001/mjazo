import type { Metadata } from "next"
import { Breadcrumbs } from "@/components/site/page-hero"
import { Container, SplitText } from "@/components/site/primitives"
import { HeroReveal } from "@/components/site/reveal-client"
import { HomePulse } from "@/components/ai/home-pulse"
import { PulseLine } from "@/components/ai/pulse-line"
import { FAQ } from "@/components/site/faq"

export const metadata: Metadata = {
  alternates: { canonical: "/home-pulse" },
  title: "Home Pulse: your home's care calendar for Karachi",
  description: "A 90-day plan for your home and routine: AC service before heatwaves, tank cleaning after the monsoon, dengue fumigation, waxing and facial rhythms, Eid and wedding glow plans. One tap to book.",
}

export default function HomePulsePage() {
  return (
    <div className="bg-[#f6faf8]">
      <section className="relative overflow-hidden pt-28 sm:pt-36 pb-10">
        <PulseLine />
        <Container className="relative">
          <Breadcrumbs items={[{ label: "Home Pulse" }]} />
          <HeroReveal><p className="text-xs uppercase tracking-[0.2em] text-[#2f6f5e] mb-4">Mjazo AI · Home Pulse</p></HeroReveal>
          <h1 className="font-serif text-[clamp(2.35rem,10vw,4.5rem)] leading-[1] max-w-4xl text-balance"><SplitText text="Your home's care calendar, kept for you." delay={0.1} /></h1>
          <HeroReveal delay={0.6}>
            <p className="text-lg text-zinc-600 mt-5 max-w-2xl">Tell us about your home and routine. Home Pulse plans the next 90 days around your bookings, Karachi's seasons, this week's weather, Eid and your family's events, and every reminder is one tap from booking.</p>
          </HeroReveal>
        </Container>
      </section>
      <section className="pb-16 sm:pb-24">
        <Container>
          <HomePulse />
        </Container>
      </section>
      <FAQ
        title="Home Pulse, explained"
        items={[
          ["Where does my information go?", "Your home profile stays on this device. If you ask for WhatsApp reminders, we keep your number and plan so our team can message you; reply STOP any time."],
          ["How does it know what's due?", "From your Mjazo bookings on this device, the rhythm you choose, Karachi's seasons (heat, monsoon, dengue, winter), the live weather forecast, Eid dates and the events you add."],
          ["Is the Eid date exact?", "It follows the Islamic calendar; in Pakistan the moon sighting can move it by a day, so those items are marked approximate."],
        ]}
      />
    </div>
  )
}
