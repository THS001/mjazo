"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, Loader2, Mic, Send, Sparkles, Volume2, X } from "lucide-react"
import type { Lang } from "@/lib/content"
import { hasUrdu, shrink, speak, useVoice } from "@/lib/client/media"
import { cn } from "@/lib/utils"
import { api } from "../kit"

type Msg = { role: "user" | "assistant"; text: string; image?: string }

const KEY = "mjazo-pro-copilot"
const HELLO: Record<Lang, string> = {
  en: "Hi! I'm your Mjazo Copilot (AI). Ask me about your day, a customer, a technique or a safety question. You can talk or send a photo.",
  ur: "السلام علیکم! میں آپ کا مجازو کو پائلٹ (اے آئی) ہوں۔ اپنے دن، کسٹمر، کام کے طریقے یا حفاظت کے بارے میں پوچھیں۔ بول کر یا تصویر بھیج کر بھی پوچھ سکتی ہیں۔",
  ro: "Salaam! Main aapka Mjazo Copilot (AI) hoon. Apne din, customer, kaam ke tareeqe ya safety ke baare mein poochein. Bol kar ya photo bhej kar bhi pooch sakti hain.",
}
const CHIPS: Record<Lang, string[]> = {
  en: ["Brief me on my next visit", "Client has sensitive skin. Can I wax?", "What does this AC error code mean?", "Save a note for this customer"],
  ur: ["اگلے وزٹ کا بتائیں", "حساس جلد پر ویکس کیسے کروں؟", "یہ ایرر کوڈ کیا ہے؟", "کسٹمر کا نوٹ محفوظ کریں"],
  ro: ["Agle visit ka batao", "Sensitive skin pe wax kar sakti hoon?", "Ye error code kya hai?", "Customer ka note save karo"],
}
const VOICE_LANG: Record<Lang, string> = { en: "en-PK", ur: "ur-PK", ro: "ur-PK" }

export function ProCopilot({ open, onClose, lang }: { open: boolean; onClose: () => void; lang: Lang }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [image, setImage] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const voice = useVoice()
  const end = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY)
      if (saved) setMsgs(JSON.parse(saved))
    } catch {}
  }, [])
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(msgs.map(({ image, ...m }) => m).slice(-20)))
    } catch {}
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [msgs, busy])

  const send = async (text: string) => {
    const t = text.trim()
    if ((!t && !image) || busy) return
    const next = [...msgs, { role: "user" as const, text: t || "(photo)", image }]
    setMsgs(next)
    setInput("")
    setImage(undefined)
    setBusy(true)
    setError("")
    try {
      const { reply } = await api<{ reply: string }>("/api/pro/copilot", { messages: next })
      setMsgs((m) => [...m, { role: "assistant", text: reply }])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const ur = lang === "ur"
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[70] bg-[#0b0b0b] text-white flex flex-col"
          role="dialog"
          aria-label="Pro Copilot"
          data-lenis-prevent
        >
          <div className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/10">
            <span className="w-10 h-10 rounded-2xl bg-[var(--brand)] text-black flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold leading-tight">Pro Copilot</p>
              <p className="text-xs text-white/50">AI assistant · answers from the Mjazo manual</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 overscroll-contain">
            <Bubble role="assistant" text={HELLO[lang]} />
            {msgs.map((m, i) => (
              <Bubble key={i} {...m} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
              </div>
            )}
            {error && <p className="text-sm text-red-300">{error}</p>}
            {!msgs.length && (
              <div className="flex flex-wrap gap-2 pt-2">
                {CHIPS[lang].map((c) => (
                  <button key={c} onClick={() => send(c)} className={cn("min-h-10 px-4 py-2 rounded-full border border-white/15 text-sm text-white/85 active:bg-white/10 text-left", ur && "font-urdu leading-[2]")}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>

          {image && (
            <div className="px-4 pb-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Attached" className="w-14 h-14 rounded-xl object-cover" />
              <button onClick={() => setImage(undefined)} className="text-sm text-white/60 underline">
                Remove
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-end gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10"
          >
            <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => e.target.files?.[0] && setImage(await shrink(e.target.files[0]))} />
            <button type="button" onClick={() => file.current?.click()} aria-label="Add photo" className="w-12 h-12 shrink-0 rounded-full bg-white/10 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </button>
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
              placeholder={lang === "en" ? "Ask anything…" : lang === "ur" ? "کچھ بھی پوچھیں…" : "Kuch bhi poochein…"}
              className={cn("flex-1 min-h-12 max-h-32 resize-none rounded-3xl bg-white/10 px-4 py-3 text-[16px] outline-none placeholder:text-white/40", ur && "font-urdu")}
            />
            {voice.supported && !input.trim() && !image ? (
              <button
                type="button"
                onClick={() => voice.start(VOICE_LANG[lang], setInput, send)}
                aria-label={voice.listening ? "Stop listening" : "Speak"}
                className={cn("w-12 h-12 shrink-0 rounded-full flex items-center justify-center", voice.listening ? "bg-red-500 animate-pulse" : "bg-[var(--brand)] text-black")}
              >
                <Mic className="w-5 h-5" />
              </button>
            ) : (
              <button type="submit" disabled={busy} aria-label="Send" className="w-12 h-12 shrink-0 rounded-full bg-[var(--brand)] text-black flex items-center justify-center disabled:opacity-50">
                <Send className="w-5 h-5" />
              </button>
            )}
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Bubble({ role, text, image }: Msg) {
  const me = role === "user"
  return (
    <div className={cn("flex", me ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed", me ? "bg-[var(--brand)] text-black rounded-br-lg" : "bg-white/[0.07] rounded-bl-lg")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image && <img src={image} alt="" className="w-40 rounded-2xl mb-2" />}
        <p dir="auto" className={cn("whitespace-pre-wrap", hasUrdu(text) && "font-urdu leading-[2.1]")}>
          {text}
        </p>
        {!me && (
          <button onClick={() => speak(text)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/50">
            <Volume2 className="w-3.5 h-3.5" /> Listen
          </button>
        )}
      </div>
    </div>
  )
}
