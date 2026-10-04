import type { Metadata } from "next"
import { Hero } from "@/components/home/hero"
import { AreasTeaser, BundlesBento, FinalCTA, HowItWorks, MostBooked, Promises, Stats, TrustTracker, WorldsGrid } from "@/components/home/sections"
import { FAQ } from "@/components/site/faq"
import { AiSection } from "@/components/home/ai-section"
import { getPage } from "@/lib/cms/read"
import { pairs } from "@/lib/cms/types/pages/blocks"
import type { HomeContent } from "@/lib/cms/types/pages/home"

export const metadata: Metadata = { alternates: { canonical: "/" } }

export default async function Home() {
  const c = await getPage<HomeContent>("home")
  return (
    <>
      <Hero content={c.hero} />
      <Stats labels={c.stats} />
      <WorldsGrid content={c.worlds} />
      <MostBooked content={c.mostBooked} />
      <HowItWorks content={c.how} />
      <TrustTracker content={c.trust} />
      <AiSection content={c.ai} />
      <BundlesBento content={c.bundles} />
      <AreasTeaser content={c.areas} />
      <Promises content={c.promises} />
      <FAQ items={pairs(c.faq.items)} title={c.faq.title} />
      <FinalCTA content={c.final} />
    </>
  )
}
