"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react"
import { APPLY_LABELS, DAYS, EXPERIENCE, SKILLS, TRANSPORT, type Lang } from "@/lib/content"
import { submit, track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { Chips, inputCls } from "@/components/site/forms"
import { PK_PHONE, normalisePhone } from "@/components/site/notify-form"
import { EASE } from "@/components/site/primitives"
import { LangSwitch, urduCls, usePartnerLang } from "./lang"
import { useCatalog } from "@/components/cms/provider"

const ERR = {
  name: { en: "Please enter your name", ur: "براہ کرم اپنا نام لکھیں", ro: "Apna naam likhein" },
  phone: { en: "Enter a mobile number like 0300 1234567", ur: "موبائل نمبر لکھیں، جیسے 03001234567", ro: "Mobile number likhein, jaise 0300 1234567" },
  area: { en: "Choose your area", ur: "اپنا علاقہ چنیں", ro: "Apna ilaqa chunein" },
  skills: { en: "Pick at least one skill", ur: "کم از کم ایک کام چنیں", ro: "Kam az kam ek skill chunein" },
  experience: { en: "Choose your experience", ur: "اپنا تجربہ چنیں", ro: "Apna tajurba chunein" },
  availability: { en: "Pick at least one day", ur: "کم از کم ایک دن چنیں", ro: "Kam az kam ek din chunein" },
  transport: { en: "Choose one", ur: "ایک چنیں", ro: "Ek chunein" },
}

export function ApplyForm() {
  const { areas } = useCatalog()
  const router = useRouter()
  const [lang, setLang] = usePartnerLang()
  const rtl = lang === "ur"
  const L = (x: Record<Lang, string>) => x[lang]
  const [step, setStep] = useState(0)
  const [v, setV] = useState({ name: "", phone: "", area: "", skills: [] as string[], experience: "", availability: [] as string[], transport: "", portfolio: "" })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof ERR, string>>>({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState("")
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }))

  const validate = (s: number) => {
    const e: typeof errors = {}
    if (s === 0) {
      if (v.name.trim().length < 2) e.name = L(ERR.name)
      if (!PK_PHONE.test(normalisePhone(v.phone))) e.phone = L(ERR.phone)
      if (!v.area) e.area = L(ERR.area)
    }
    if (s === 1) {
      if (!v.skills.length) e.skills = L(ERR.skills)
      if (!v.experience) e.experience = L(ERR.experience)
    }
    if (s === 2) {
      if (!v.availability.length) e.availability = L(ERR.availability)
      if (!v.transport) e.transport = L(ERR.transport)
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = async () => {
    if (!validate(step)) return
    if (step < 2) return setStep(step + 1)
    setBusy(true)
    setServerError("")
    try {
      const res = (await submit("apply", { ...v, phone: normalisePhone(v.phone), lang })) as { id: string; interview?: string }
      track("apply_pro", { area: v.area, skills: v.skills.join(","), lang })
      const token = res.interview?.split("/").pop()
      router.push(`/partner/thanks?lang=${lang}${token ? `&i=${encodeURIComponent(token)}` : ""}`)
    } catch (err) {
      setServerError((err as Error).message)
      setBusy(false)
    }
  }

  const title = [
    { en: "About you", ur: "آپ کے بارے میں", ro: "Aap ke baare mein" },
    { en: "Your skills", ur: "آپ کا ہنر", ro: "Aapka hunar" },
    { en: "Your time", ur: "آپ کا وقت", ro: "Aapka waqt" },
  ][step]

  const Label = ({ children }: { children: React.ReactNode }) => <span className={cn("block text-sm font-medium mb-2", urduCls(lang))}>{children}</span>
  const Err = ({ k }: { k: keyof typeof ERR }) => (errors[k] ? <span className={cn("block text-xs text-destructive mt-1.5", urduCls(lang))}>{errors[k]}</span> : null)

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <LangSwitch lang={lang} onChange={setLang} />
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => <span key={i} className={cn("h-1.5 w-10 rounded-full transition-colors", i <= step ? "bg-black" : "bg-black/15")} />)}
        </div>
      </div>

      <div className="rounded-[2rem] bg-white p-6 sm:p-10 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.35)]">
        <AnimatePresence mode="wait">
          <motion.div key={`${step}-${lang}`} initial={{ opacity: 0, x: rtl ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: rtl ? 20 : -20 }} transition={{ duration: 0.3, ease: EASE }} className="space-y-6">
            <h2 className={cn("text-4xl", rtl ? "font-urdu leading-[2]" : "font-serif")}>{L(title)}</h2>

            {step === 0 && (
              <>
                <label className="block"><Label>{L(APPLY_LABELS.name)}</Label><input className={inputCls} value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" aria-invalid={!!errors.name} /><Err k="name" /></label>
                <label className="block"><Label>{L(APPLY_LABELS.phone)}</Label><input className={inputCls} dir="ltr" value={v.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" aria-invalid={!!errors.phone} /><Err k="phone" /></label>
                <div>
                  <Label>{L(APPLY_LABELS.area)}</Label>
                  <Chips options={[...areas.map((a) => ({ id: a.slug, label: a.name })), { id: "other", label: lang === "ur" ? "کوئی اور" : lang === "ro" ? "Koi aur" : "Other" }]} value={v.area ? [v.area] : []} onChange={(x) => set("area", x[0] ?? "")} />
                  <Err k="area" />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <Label>{L(APPLY_LABELS.skills)}</Label>
                  <Chips multi options={SKILLS.map((s) => ({ id: s.id, label: s[lang] }))} value={v.skills} onChange={(x) => set("skills", x)} />
                  <Err k="skills" />
                </div>
                <div>
                  <Label>{L(APPLY_LABELS.experience)}</Label>
                  <Chips options={EXPERIENCE.map((s) => ({ id: s.id, label: s[lang] }))} value={v.experience ? [v.experience] : []} onChange={(x) => set("experience", x[0] ?? "")} />
                  <Err k="experience" />
                </div>
                <label className="block"><Label>{L(APPLY_LABELS.portfolio)}</Label><input className={inputCls} dir="ltr" value={v.portfolio} onChange={(e) => set("portfolio", e.target.value)} placeholder="instagram.com/…" /></label>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <Label>{L(APPLY_LABELS.availability)}</Label>
                  <Chips multi options={DAYS.map((s) => ({ id: s.id, label: s[lang] }))} value={v.availability} onChange={(x) => set("availability", x)} />
                  <Err k="availability" />
                </div>
                <div>
                  <Label>{L(APPLY_LABELS.transport)}</Label>
                  <Chips options={TRANSPORT.map((s) => ({ id: s.id, label: s[lang] }))} value={v.transport ? [v.transport] : []} onChange={(x) => set("transport", x[0] ?? "")} />
                  <Err k="transport" />
                </div>
                <p className={cn("flex items-start gap-2 text-sm text-zinc-500 rounded-2xl bg-zinc-50 p-4", urduCls(lang))}><Lock className="w-4 h-4 mt-1 shrink-0" />{L(APPLY_LABELS.privacy)}</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-10">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className={cn("h-12 px-5 rounded-full border border-zinc-300 flex items-center gap-2 text-sm", urduCls(lang))}>
              <ArrowLeft className={cn("w-4 h-4", rtl && "rotate-180")} /> {L(APPLY_LABELS.back)}
            </button>
          ) : <span />}
          <button onClick={next} disabled={busy} className={cn("h-12 px-7 rounded-full bg-black text-white flex items-center gap-2 text-sm hover:bg-brand hover:text-black transition-colors disabled:opacity-60", urduCls(lang))}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : step < 2 ? L(APPLY_LABELS.next) : L(APPLY_LABELS.submit)}
            {!busy && <ArrowRight className={cn("w-4 h-4", rtl && "rotate-180")} />}
          </button>
        </div>
        {serverError && <p className="text-sm text-destructive mt-4">{serverError}</p>}
      </div>
    </div>
  )
}
