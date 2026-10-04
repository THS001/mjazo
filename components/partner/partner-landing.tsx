"use client"

import Link from "@/components/site/locale-link"
import { motion } from "framer-motion"
import { ArrowRight, Mic } from "lucide-react"
import { PARTNER } from "@/lib/content"
import { track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { EASE, Icon, Reveal } from "@/components/site/primitives"
import { ObjectCanvas } from "@/components/three"
import { LangSwitch, urduCls, usePartnerLang } from "./lang"
import { useSite } from "@/components/cms/provider"

export function PartnerLanding() {
  const { whatsappLink } = useSite()
  const [lang, setLang] = usePartnerLang()
  const rtl = lang === "ur"
  const t = (x: Record<string, string>) => x[lang]

  return (
    <div dir={rtl ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden pt-32 sm:pt-36 pb-20 bg-brand">
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none">
          <span className="font-bold text-[24vw] leading-[0.8] tracking-tighter text-black/[0.06] translate-y-[18%] whitespace-nowrap" dir="ltr">JOIN</span>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
          <div>
            <LangSwitch lang={lang} onChange={setLang} className="mb-8" />
            <motion.h1 key={`h-${lang}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className={cn("text-black text-5xl sm:text-6xl lg:text-7xl tracking-tight text-balance", rtl ? "font-urdu leading-[1.9]" : "font-serif leading-[0.98]")}>
              {t(PARTNER.h1)}
            </motion.h1>
            <motion.p key={`s-${lang}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }} className={cn("mt-6 text-lg text-black/70 max-w-xl", urduCls(lang))}>
              {t(PARTNER.sub)}
            </motion.p>
            <div className="mt-8 flex flex-wrap gap-3 items-center">
              <Link href={`/partner/apply?lang=${lang}`} className={cn("h-14 px-7 rounded-full bg-black text-white flex items-center gap-2 text-base hover:bg-white hover:text-black transition-colors", urduCls(lang))}>
                {t(PARTNER.cta)} <ArrowRight className={cn("w-4 h-4", rtl && "rotate-180")} />
              </Link>
              <a
                href={whatsappLink("Assalam o Alaikum! Main Mjazo ke saath kaam karna chahti hoon. (Voice note attached)")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("whatsapp_click", { placement: "partner_voice_note" })}
                className={cn("h-14 px-6 rounded-full border border-black/30 text-black flex items-center gap-2 hover:border-black", urduCls(lang))}
              >
                <Mic className="w-4 h-4" /> {t(PARTNER.voice)}
              </a>
            </div>
          </div>
          <ObjectCanvas kind="lipstick" tint="#ffffff" icon="Sparkles" className="h-[300px] sm:h-[420px]" scale={2} />
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PARTNER.benefits.map((b, i) => (
              <Reveal key={b.en} delay={(i % 3) * 0.08}>
                <div className="h-full rounded-3xl border border-zinc-200 p-7 hover:bg-brand-soft transition-colors">
                  <span className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center mb-6"><Icon name={b.icon} className="w-6 h-6" /></span>
                  <p className={cn("text-2xl", rtl ? "font-urdu leading-[2]" : "font-serif")}>{t(b)}</p>
                  {lang !== "en" && <p className="text-sm text-zinc-500 mt-1" dir="ltr">{b.en}</p>}
                </div>
              </Reveal>
            ))}
          </div>
          <p className={cn("text-sm text-zinc-500 mt-6", urduCls(lang))}>{t(PARTNER.note)}</p>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className={cn("text-white/50 text-sm mb-10", urduCls(lang))}>{lang === "ur" ? "پانچ قدم" : lang === "ro" ? "Paanch qadam" : "Five steps to your first booking"}</p>
          <ol className="grid md:grid-cols-5 gap-6">
            {PARTNER.steps.map((s, i) => (
              <Reveal as="li" key={s.en} delay={i * 0.08} className="relative">
                <span className="font-serif text-7xl text-brand leading-none" dir="ltr">0{i + 1}</span>
                <p className={cn("text-xl mt-4", urduCls(lang))}>{t(s)}</p>
                {i < PARTNER.steps.length - 1 && <span className={cn("hidden md:block absolute top-8 h-px bg-white/20 w-[40%]", rtl ? "start-0" : "end-0")} />}
              </Reveal>
            ))}
          </ol>
          <Link href={`/partner/apply?lang=${lang}`} className={cn("mt-16 inline-flex h-14 px-7 rounded-full bg-brand text-black items-center gap-2 font-medium", urduCls(lang))}>
            {t(PARTNER.cta)} <ArrowRight className={cn("w-4 h-4", rtl && "rotate-180")} />
          </Link>
        </div>
      </section>
    </div>
  )
}
