"use client"

import Link from "@/components/site/locale-link"
import { ArrowUpRight, CalendarHeart, Camera, Heart, MessageCircle, Sparkles } from "lucide-react"
import { BgWord, Container, Reveal, SectionTitle } from "@/components/site/primitives"
import { track } from "@/lib/site"
import type { HomeContent } from "@/lib/cms/types/pages/home"

const TOOL_ICONS = [MessageCircle, Camera, CalendarHeart, Sparkles, Heart]

export function AiSection({ content: c }: { content: HomeContent["ai"] }) {
  const FEATURES = c.tools.map((t, i) => ({ ...t, icon: TOOL_ICONS[i] ?? Sparkles, open: t.href === "#concierge" }))
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <BgWord word="SMART" className="top-6" />
      <Container className="relative z-10">
        <SectionTitle eyebrow={c.eyebrow} title={c.title} sub={c.sub} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {FEATURES.map((f, i) => {
            const inner = (
              <>
                <div className="flex items-start justify-between">
                  <span className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center"><f.icon className="w-6 h-6 text-black" strokeWidth={1.6} /></span>
                  <ArrowUpRight className="w-5 h-5 text-white/40 transition-all group-hover:text-white group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100" />
                </div>
                <div className="mt-10">
                  <p className="font-serif text-3xl">{f.name}</p>
                  <p className="text-white/70 mt-2">{f.line}</p>
                  <p className="text-white/45 text-sm mt-4 italic" dir="auto">{f.example}</p>
                  <p className="mt-6 text-sm font-medium text-brand">{f.action}</p>
                </div>
              </>
            )
            const cls = "group block h-full rounded-[2rem] bg-[#141210] text-white p-7 text-start transition-transform duration-500 hover:-translate-y-1"
            return (
              <Reveal key={i} delay={(i % 3) * 0.08} className={i < 3 ? "h-full lg:col-span-2" : "h-full lg:col-span-3"}>
                {f.open ? (
                  <button type="button" className={cls} onClick={() => { window.dispatchEvent(new CustomEvent("mjazo:concierge")); track("concierge_open", { source: "home_ai_section" }) }}>{inner}</button>
                ) : (
                  <Link href={f.href!} className={cls}>{inner}</Link>
                )}
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
