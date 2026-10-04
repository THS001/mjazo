"use client"

import { useEffect, useRef, useState } from "react"
import Link from "@/components/site/locale-link"
import { AnimatePresence, motion } from "framer-motion"
import { CalendarCheck, Loader2, Mic, Send } from "lucide-react"
import type { Lang } from "@/lib/content"
import { hasUrdu, useVoice } from "@/lib/client/media"
import { cn } from "@/lib/utils"

type State = { name: string; lang: string; status: string; turns: { role: "user" | "assistant"; text: string }[]; done: boolean; testSlot?: string; slots: string[]; ai: boolean }

const COPY = {
  title: { en: "Your Mjazo interview", ur: "آپ کا مجازو انٹرویو", ro: "Aapka Mjazo interview" },
  note: { en: "AI interviewer · about 10 minutes · a person reviews every answer", ur: "اے آئی انٹرویو · تقریباً ۱۰ منٹ · ہر جواب ہماری ٹیم خود دیکھتی ہے", ro: "AI interviewer · taqreeban 10 minute · har jawab humari team khud dekhti hai" },
  type: { en: "Type or tap the mic to speak…", ur: "لکھیں یا مائیک دبا کر بولیں…", ro: "Likhein ya mic daba kar bolein…" },
  pick: { en: "Pick a time for your practical test", ur: "پریکٹیکل ٹیسٹ کا وقت چنیں", ro: "Practical test ka waqt chunein" },
  pickSub: { en: "We'll WhatsApp you the address and what to bring.", ur: "ہم واٹس ایپ پر پتہ اور ساتھ لانے والی چیزیں بتا دیں گے۔", ro: "Hum WhatsApp par address aur saath lane wali cheezein bata denge." },
  booked: { en: "Practical test booked", ur: "پریکٹیکل ٹیسٹ بک ہو گیا", ro: "Practical test book ho gaya" },
  bookedSub: { en: "Our team will WhatsApp you to confirm. Shukriya!", ur: "ہماری ٹیم واٹس ایپ پر تصدیق کرے گی۔ شکریہ!", ro: "Humari team WhatsApp par confirm karegi. Shukriya!" },
  offline: { en: "The online interview isn't available right now. Our team will call you for your interview instead.", ur: "آن لائن انٹرویو ابھی دستیاب نہیں۔ ہماری ٹیم آپ کو کال کر کے انٹرویو کرے گی۔", ro: "Online interview abhi available nahi. Humari team aapko call karke interview karegi." },
  home: { en: "Back to Mjazo", ur: "واپس جائیں", ro: "Wapas jayein" },
}

export function Interview({ token }: { token: string }) {
  const [s, setS] = useState<State | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState("")
  const voice = useVoice()
  const end = useRef<HTMLDivElement>(null)
  const lang = ((s?.lang ?? "en") as Lang) in COPY.title ? ((s?.lang ?? "en") as Lang) : "en"
  const ur = lang === "ur"

  const call = async (body?: unknown) => {
    const res = await fetch(`/api/interview/${token}`, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? "Something went wrong")
    return data as State
  }

  useEffect(() => {
    ;(async () => {
      try {
        const first = await call()
        setS(first)
        if (!first.turns.length && !first.done && first.ai) {
          setBusy(true)
          setS(await call({}))
        }
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [s?.turns.length, busy, s?.done])

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy || !s) return
    setInput("")
    setS({ ...s, turns: [...s.turns, { role: "user", text: t }] })
    setBusy(true)
    setError("")
    try {
      setS(await call({ text: t }))
    } catch (e) {
      setError((e as Error).message)
      setS(s)
      setInput(t)
    } finally {
      setBusy(false)
    }
  }
  const book = async (slot: string) => {
    setBusy(true)
    try {
      setS(await call({ slot }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const chatting = s && !s.done && s.ai
  return (
    <div dir={ur ? "rtl" : "ltr"} className="min-h-[100svh] bg-brand flex flex-col">
      <header className="sticky top-0 z-10 bg-brand/90 backdrop-blur border-b border-black/10">
        <div className="max-w-2xl mx-auto px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
          <Link href="/" className="w-11 h-11 rounded-2xl bg-black text-[var(--brand)] flex items-center justify-center font-serif text-2xl shrink-0" aria-label="Mjazo home">
            m
          </Link>
          <div className="min-w-0">
            <p className={cn("font-semibold leading-tight", ur ? "font-urdu" : "")}>{COPY.title[lang]}</p>
            <p className={cn("text-xs text-black/60 truncate", ur && "font-urdu leading-[2]")}>{COPY.note[lang]}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-2xl w-full mx-auto px-5 py-6 space-y-3">
        {!s && !error && (
          <div className="flex justify-center pt-20">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {s && !s.ai && !s.done && <p className={cn("rounded-3xl bg-white/70 p-5", ur && "font-urdu leading-[2]")}>{COPY.offline[lang]}</p>}
        <AnimatePresence initial={false}>
          {s?.turns.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
              <p dir="auto" className={cn("max-w-[85%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap", t.role === "user" ? "bg-black text-white rounded-ee-lg" : "bg-white rounded-es-lg", hasUrdu(t.text) && "font-urdu leading-[2.1]")}>
                {t.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex gap-1.5 px-4 py-4 bg-white rounded-3xl w-fit">
            {[0, 1, 2].map((d) => (
              <motion.span key={d} className="w-2 h-2 rounded-full bg-black/40" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }} />
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}

        {s?.status === "interviewed" && s.slots.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] bg-black text-white p-6 mt-6">
            <p className={cn("text-xl font-semibold", ur && "font-urdu leading-[2]")}>{COPY.pick[lang]}</p>
            <p className={cn("text-sm text-white/60 mt-1", ur && "font-urdu leading-[2]")}>{COPY.pickSub[lang]}</p>
            <div className="grid grid-cols-2 gap-2 mt-5" dir="ltr">
              {s.slots.map((slot) => (
                <button key={slot} disabled={busy} onClick={() => book(slot)} className="min-h-12 px-3 py-2 rounded-2xl border border-white/15 text-sm hover:bg-white hover:text-black transition-colors disabled:opacity-50">
                  {slot}
                </button>
              ))}
            </div>
          </motion.section>
        )}
        {s?.status === "test_booked" && (
          <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[28px] bg-black text-white p-6 mt-6 text-center">
            <CalendarCheck className="w-10 h-10 text-[var(--brand)] mx-auto" />
            <p className={cn("text-xl font-semibold mt-4", ur && "font-urdu leading-[2]")}>{COPY.booked[lang]}</p>
            <p className="text-[var(--brand)] mt-1" dir="ltr">
              {s.testSlot}
            </p>
            <p className={cn("text-sm text-white/60 mt-3", ur && "font-urdu leading-[2]")}>{COPY.bookedSub[lang]}</p>
            <Link href="/" className={cn("inline-flex mt-6 h-11 px-5 rounded-full bg-white text-black items-center text-sm", ur && "font-urdu")}>
              {COPY.home[lang]}
            </Link>
          </motion.section>
        )}
        <div ref={end} className="h-24" />
      </div>

      {chatting && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="sticky bottom-0 bg-brand/95 backdrop-blur border-t border-black/10"
        >
          <div className="max-w-2xl mx-auto flex items-end gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              rows={1}
              dir="auto"
              placeholder={COPY.type[lang]}
              className={cn("flex-1 min-h-12 max-h-36 resize-none rounded-3xl bg-white px-4 py-3 text-[16px] outline-none border border-black/10 focus:border-black", ur && "font-urdu")}
            />
            {voice.supported && !input.trim() ? (
              <button type="button" onClick={() => voice.start(lang === "en" ? "en-PK" : "ur-PK", setInput, send)} aria-label="Speak" className={cn("w-12 h-12 shrink-0 rounded-full flex items-center justify-center", voice.listening ? "bg-red-500 text-white animate-pulse" : "bg-black text-[var(--brand)]")}>
                <Mic className="w-5 h-5" />
              </button>
            ) : (
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="w-12 h-12 shrink-0 rounded-full bg-black text-[var(--brand)] flex items-center justify-center disabled:opacity-40">
                <Send className={cn("w-5 h-5", ur && "-scale-x-100")} />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
