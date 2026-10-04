import type { Metadata } from "next"
import { Bell, CalendarCheck, MapPin, RefreshCw, Smartphone, Zap } from "lucide-react"
import { Container, Reveal } from "@/components/site/primitives"
import { Breadcrumbs } from "@/components/site/page-hero"
import { AppShowcase } from "@/components/site/app-showcase"
import { InstallApp } from "@/components/site/install-app"
import { getPage } from "@/lib/cms/read"
import type { AppContent } from "@/lib/cms/types/pages/commerce"

export const metadata: Metadata = {
  title: "Get the Mjazo app: install on iPhone & Android",
  description: "Install Mjazo on your home screen in seconds. Book home services, rebook favourite pros and manage bookings, on iPhone and Android, no app store needed.",
  alternates: { canonical: "/app" },
}

const FEATURE_ICONS = [Zap, CalendarCheck, RefreshCw, MapPin, Bell, Smartphone]

export default async function AppPage() {
  const c = await getPage<AppContent>("app")
  return (
    <>
      <section className="relative overflow-hidden pt-32 sm:pt-36 pb-24" style={{ background: "radial-gradient(90% 70% at 50% 100%, oklch(0.9 0.08 75), oklch(0.985 0.01 85) 70%)" }}>
        <Container className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Breadcrumbs items={[{ label: "Get the app" }]} />
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">{c.eyebrow}</p>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[0.98] text-balance">{c.title}</h1>
            <p className="text-lg text-zinc-600 mt-6 max-w-lg">{c.sub}</p>
            <div className="mt-8">
              <InstallApp />
            </div>
          </div>
          <AppShowcase />
        </Container>
      </section>
      <section className="py-16 sm:py-24">
        <Container className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {c.features.map((f, i) => {
            const FeatureIcon = FEATURE_ICONS[i] ?? Zap
            return (
              <Reveal key={i} delay={(i % 3) * 0.08}>
                <div className="h-full rounded-3xl border border-zinc-200 p-7">
                  <FeatureIcon className="w-7 h-7 mb-6" strokeWidth={1.3} />
                  <p className="text-xl font-medium">{f.title}</p>
                  <p className="text-sm text-zinc-500 mt-1">{f.body}</p>
                </div>
              </Reveal>
            )
          })}
        </Container>
      </section>
    </>
  )
}
