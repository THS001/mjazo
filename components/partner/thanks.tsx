"use client"

import { useEffect, useState } from "react"
import Link from "@/components/site/locale-link"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { EASE } from "@/components/site/primitives"
import { urduCls, usePartnerLang } from "./lang"

const COPY = {
  title: { en: "Shukriya! We've got it.", ur: "شکریہ! آپ کی درخواست مل گئی۔", ro: "Shukriya! Aapki application mil gayi." },
  body: {
    en: "Our team will call or WhatsApp you soon to set up your interview.",
    ur: "ہماری ٹیم جلد آپ کو کال یا واٹس ایپ کرے گی اور انٹرویو کا وقت طے کرے گی۔",
    ro: "Humari team jald aapko call ya WhatsApp karegi aur interview ka waqt tay karegi.",
  },
  now: {
    en: "Want to go faster? Take your first interview right now, on your phone. It takes about 10 minutes, in English, Urdu or Roman Urdu. A person at Mjazo reviews every interview.",
    ur: "جلدی آگے بڑھنا چاہتی ہیں؟ ابھی اپنے فون پر پہلا انٹرویو دیں۔ تقریباً ۱۰ منٹ، اردو، انگریزی یا رومن اردو میں۔ مجازو کی ٹیم ہر انٹرویو خود دیکھتی ہے۔",
    ro: "Jaldi aage barhna chahti hain? Abhi apne phone par pehla interview dein. Taqreeban 10 minute, Urdu, English ya Roman Urdu mein. Mjazo ki team har interview khud dekhti hai.",
  },
  start: { en: "Start my interview", ur: "انٹرویو شروع کریں", ro: "Interview shuru karein" },
  back: { en: "Back to Mjazo", ur: "واپس جائیں", ro: "Wapas jayein" },
}

export function PartnerThanks() {
  const [lang] = usePartnerLang()
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("i"))
  }, [])
  const rtl = lang === "ur"
  return (
    <div dir={rtl ? "rtl" : "ltr"} className="max-w-2xl mx-auto text-center">
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 0.6, ease: EASE }} className="w-24 h-24 mx-auto rounded-full bg-black flex items-center justify-center">
        <motion.svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.4, duration: 0.5 }} />
        </motion.svg>
      </motion.div>
      <h1 className={cn("text-5xl sm:text-6xl mt-10", rtl ? "font-urdu leading-[1.9]" : "font-serif")}>{COPY.title[lang]}</h1>
      <p className={cn("text-lg text-black/70 mt-6", urduCls(lang))}>{COPY.body[lang]}</p>
      {token && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5, ease: EASE }} className="mt-10 rounded-[32px] bg-black text-white p-6 sm:p-8 text-start">
          <p className={cn("text-white/80 leading-relaxed", urduCls(lang))}>{COPY.now[lang]}</p>
          <Link href={`/partner/interview/${token}?lang=${lang}`} className={cn("inline-flex mt-6 h-12 px-6 rounded-full bg-[var(--brand)] text-black font-medium items-center", urduCls(lang))}>
            {COPY.start[lang]}
          </Link>
        </motion.div>
      )}
      <Link href="/" className={cn("inline-flex mt-10 h-12 px-6 rounded-full bg-black text-white items-center", urduCls(lang))}>{COPY.back[lang]}</Link>
    </div>
  )
}
