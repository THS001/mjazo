"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, Camera, Check, Loader2, MessageCircle, Mic, RotateCcw, Sparkles, Volume2, X } from "lucide-react"
import { formatDuration, formatPKR } from "@/lib/catalog"
import { getAttribution, track } from "@/lib/site"
import { cartCount, useCart, useLocation, type CartItem } from "@/lib/store"
import { saveBooking } from "@/lib/bookings"
import { cn } from "@/lib/utils"
import { isServiceDetail } from "@/components/site/chrome"
import { useCatalog, useSite } from "@/components/cms/provider"

type Card = { category: string; service: string; name: string; categoryName: string; price: number; duration: number; short: string; hasOptions: boolean; url: string }
type Msg = {
  id: string
  role: "user" | "assistant"
  text: string
  images?: string[] // data URLs
  cards?: Card[]
  added?: string[]
  booking?: { id: string; total: number; date: string; window: string }
  handoff?: boolean
  offline?: string // WhatsApp link when the assistant can't answer
}

const KEY = "mjazo-concierge"
const WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  text: "Assalam o Alaikum! I'm Mjazo's AI assistant. Tell me what you need: type or speak in English, Urdu or Roman Urdu, or send a photo of the problem. A person from our team is always one tap away.",
}
const CHIPS = ["Waxing at home this week", "How much is an AC service?", "Kal shaam threading karwani hai", "Show you a photo"]
const uid = () => Math.random().toString(36).slice(2)
const hasUrdu = (s: string) => /[؀-ۿ]/.test(s)

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height))
    const c = document.createElement("canvas")
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL("image/jpeg", 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Minimal formatting for replies: **bold**, line breaks and "- " bullets. */
function Rich({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5" dir="auto">
      {lines.map((line, i) => {
        const bullet = /^\s*[-•*]\s+/.test(line)
        const content = line.replace(/^\s*[-•*]\s+/, "")
        const parts = content.split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith("**") && p.endsWith("**") ? <b key={j}>{p.slice(2, -2)}</b> : <span key={j}>{p}</span>))
        if (!line.trim()) return null
        return bullet ? (
          <p key={i} className="flex gap-2"><span className="text-brand-ink">•</span><span>{parts}</span></p>
        ) : (
          <p key={i}>{parts}</p>
        )
      })}
    </div>
  )
}

export function ConciergeWidget() {
  const { getArea } = useCatalog()
  const { whatsappLink } = useSite()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME])
  const [input, setInput] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [lang, setLang] = useState<"en-PK" | "ur-PK">("en-PK")
  const [voiceOk, setVoiceOk] = useState(false)
  const [mounted, setMounted] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recRef = useRef<{ stop: () => void } | null>(null)
  const { items, add, clear } = useCart()
  const loc = useLocation()

  // Restore this tab's conversation; detect speech recognition support.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null")
      if (Array.isArray(saved) && saved.length) setMsgs(saved)
    } catch {}
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setVoiceOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
    setMounted(true)
  }, [])
  useEffect(() => {
    try {
      // Images are not kept across reloads (size); text and cards are.
      sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30).map((m) => ({ ...m, images: undefined }))))
    } catch {}
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [msgs, busy])

  const send = useCallback(
    async (text: string, imgs: string[] = []) => {
      const t = text.trim()
      if ((!t && !imgs.length) || busy) return
      const userMsg: Msg = { id: uid(), role: "user", text: t || "What can you tell me from this photo?", images: imgs.length ? imgs : undefined }
      const next = [...msgs, userMsg]
      setMsgs(next)
      setInput("")
      setImages([])
      setBusy(true)
      track("concierge_message", { images: imgs.length, page: pathname })

      const apiMessages = next
        .filter((m) => m.id !== "welcome" && !m.offline)
        .map((m) =>
          m.role === "assistant"
            ? { role: "assistant", content: m.text }
            : {
                role: "user",
                content: [
                  ...(m.images ?? []).map((d) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: d.split(",")[1] } })),
                  { type: "text", text: m.text },
                ],
              },
        )
      let contact: { name?: string; phone?: string; address?: string } = {}
      try {
        contact = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
      } catch {}
      const context = {
        name: contact.name,
        phone: contact.phone,
        address: contact.address,
        area: loc.area ? getArea(loc.area)?.name : undefined,
        subArea: loc.subArea ?? undefined,
        cart: items.map((i) => `${i.name}${i.options.length ? ` (${i.options.join(", ")})` : ""} x${i.qty}`),
        attribution: getAttribution(),
      }

      try {
        const res = await fetch("/api/concierge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: apiMessages, context }) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const offline = data.whatsapp ?? whatsappLink("Hi Mjazo! I'd like some help.")
          const textOut =
            data.error === "ai_unavailable"
              ? "Our AI assistant is taking a break right now. Our team can help you straight away on WhatsApp."
              : data.error ?? "Something went wrong. Please try again, or chat with the team on WhatsApp."
          setMsgs((m) => [...m, { id: uid(), role: "assistant", text: textOut, offline }])
          return
        }
        const reply: Msg = { id: uid(), role: "assistant", text: data.reply || "Done." }
        const added: string[] = []
        for (const a of data.ui ?? []) {
          if (a.type === "cards") reply.cards = [...(reply.cards ?? []), ...a.cards].filter((c, i, arr) => arr.findIndex((x) => x.service === c.service) === i).slice(0, 4)
          if (a.type === "cart_add") {
            for (let k = 0; k < (a.qty ?? 1); k++) add(a.item, { open: false })
            added.push(a.item.name)
          }
          if (a.type === "booking") {
            const b = a.booking
            const cartItems: CartItem[] = (b.cartItems ?? []).map((ci: Omit<CartItem, "key"> & { qty: number }) => ({ ...ci, key: [ci.category, ci.service, ...ci.options].join("|") }))
            saveBooking({ id: b.id, createdAt: new Date().toISOString(), name: b.name, phone: b.phone, area: b.area, areaName: b.areaName, subArea: b.subArea, address: b.address, landmark: b.landmark, date: b.date, window: b.window, payment: b.payment, notes: b.notes, items: cartItems, total: b.total })
            try {
              const c = JSON.parse(localStorage.getItem("mjazo-contact") ?? "{}")
              localStorage.setItem("mjazo-contact", JSON.stringify({ ...c, name: b.name, phone: b.phone, area: b.area, address: b.address, landmark: b.landmark }))
            } catch {}
            clear()
            reply.booking = { id: b.id, total: b.total, date: b.date, window: b.window }
            reply.cards = undefined
            track("submit_booking", { id: b.id, total: b.total, channel: "concierge-web" })
          }
          if (a.type === "handoff") reply.handoff = true
        }
        if (added.length) reply.added = added
        setMsgs((m) => [...m, reply])
      } catch {
        setMsgs((m) => [...m, { id: uid(), role: "assistant", text: "I couldn't reach the server. Check your connection and try again.", offline: whatsappLink("Hi Mjazo! I'd like some help.") }])
      } finally {
        setBusy(false)
      }
    },
    [busy, msgs, items, loc.area, loc.subArea, pathname, add, clear],
  )

  // Open from anywhere: window.dispatchEvent(new CustomEvent("mjazo:concierge", { detail: { prompt } }))
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true)
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt
      if (prompt) setInput(prompt)
    }
    window.addEventListener("mjazo:concierge", onOpen)
    return () => window.removeEventListener("mjazo:concierge", onOpen)
  }, [])

  const listen = () => {
    if (listening) return recRef.current?.stop()
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    let finalText = ""
    rec.onresult = (ev) => {
      let interim = ""
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      setInput(finalText + interim)
    }
    rec.onend = () => {
      setListening(false)
      recRef.current = null
      if (finalText.trim()) send(finalText)
    }
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
    track("concierge_voice", { lang })
  }

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ""))
    const want = hasUrdu(text) ? "ur" : "en"
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(want))
    if (voice) u.voice = voice
    u.lang = want === "ur" ? "ur-PK" : "en-GB"
    window.speechSynthesis.speak(u)
  }

  const reset = () => {
    setMsgs([WELCOME])
    setImages([])
    setInput("")
    try {
      sessionStorage.removeItem(KEY)
    } catch {}
  }

  if (pathname.startsWith("/checkout")) return null
  // On phones, sit above whichever bottom bar is showing (service purchase bar or "View cart" bar).
  const cartBar = mounted && cartCount(items) > 0 && !pathname.startsWith("/cart")
  const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.text ?? ""

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => {
              setOpen(true)
              track("concierge_open", { page: pathname })
            }}
            className={cn(
              "fixed z-40 right-4 lg:bottom-6 flex items-center gap-2 h-14 pl-3 pr-3 min-[400px]:pl-4 min-[400px]:pr-5 rounded-full bg-foreground text-background shadow-[0_12px_30px_-8px_rgba(0,0,0,0.45)] hover:bg-black transition-[bottom,background-color] duration-300",
              isServiceDetail(pathname) || cartBar ? "bottom-[calc(8.75rem+env(safe-area-inset-bottom))]" : "bottom-[calc(5rem+env(safe-area-inset-bottom))]",
            )}
            aria-label="Ask Mjazo, the AI assistant"
          >
            <span className="relative w-8 h-8 rounded-full bg-brand flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-black" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#25D366] ring-2 ring-foreground" />
            </span>
            <span className="text-sm font-medium hidden min-[400px]:inline">Ask Mjazo</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Mjazo Concierge"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed z-[60] inset-0 sm:inset-auto sm:right-5 sm:bottom-5 sm:w-[410px] sm:h-[min(660px,calc(100svh-2.5rem))] flex flex-col bg-background sm:rounded-[1.75rem] sm:border sm:border-zinc-200 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] overflow-hidden pt-[env(safe-area-inset-top)] sm:pt-0"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 h-16 border-b border-zinc-200 shrink-0">
              <span className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center"><Sparkles className="w-4 h-4 text-brand" /></span>
              <div className="flex-1 min-w-0">
                <p className="font-medium leading-tight">Mjazo Concierge</p>
                <p className="text-[11px] text-zinc-500">AI assistant · can make mistakes · a person is one tap away</p>
              </div>
              <a href={whatsappLink(`Hi Mjazo! ${lastUser}`.trim())} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { placement: "concierge_header" })} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100" aria-label="Chat with a person on WhatsApp" title="Chat with a person on WhatsApp">
                <MessageCircle className="w-5 h-5 text-[#128C7E]" />
              </a>
              <button onClick={reset} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100" aria-label="New conversation" title="New conversation"><RotateCcw className="w-4 h-4" /></button>
              <button onClick={() => setOpen(false)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            {/* Messages */}
            <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4" data-lenis-prevent aria-live="polite">
              {msgs.map((m) => (
                <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                  {m.images?.length ? (
                    <div className="flex gap-1.5">{m.images.map((src, i) => <img key={i} src={src} alt="" className="w-20 h-20 rounded-2xl object-cover border border-zinc-200" />)}</div>
                  ) : null}
                  <div className={cn("max-w-[88%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed", m.role === "user" ? "bg-foreground text-background rounded-br-lg" : "bg-zinc-100 text-foreground rounded-bl-lg")}>
                    {m.role === "assistant" ? <Rich text={m.text} /> : <p dir="auto" className="whitespace-pre-wrap">{m.text}</p>}
                  </div>
                  {m.role === "assistant" && m.id !== "welcome" && !m.offline && (
                    <button onClick={() => speak(m.text)} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-black px-2"><Volume2 className="w-3.5 h-3.5" />Listen</button>
                  )}
                  {m.cards?.length ? (
                    <div className="w-full flex gap-2 overflow-x-auto no-scrollbar pb-1" data-lenis-prevent>
                      {m.cards.map((c) => (
                        <div key={c.service} className="shrink-0 w-[200px] rounded-2xl border border-zinc-200 bg-white p-3 flex flex-col gap-1">
                          <p className="text-[11px] text-zinc-500">{c.categoryName}</p>
                          <Link href={c.url} className="text-sm font-medium leading-snug hover:underline" onClick={() => setOpen(false)}>{c.name}</Link>
                          <p className="text-xs text-zinc-500">{c.price > 0 ? formatPKR(c.price) : "On request"} · {formatDuration(c.duration)}</p>
                          <div className="mt-1.5">
                            {c.hasOptions || c.price <= 0 ? (
                              <Link href={c.url} onClick={() => setOpen(false)} className="inline-flex h-8 items-center rounded-full border border-zinc-300 px-3 text-xs hover:border-black">Choose options</Link>
                            ) : (
                              <button
                                onClick={() => {
                                  add({ category: c.category, categoryName: c.categoryName, service: c.service, name: c.name, options: [], addOns: [], unitPrice: c.price, duration: c.duration }, { open: false })
                                  setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, added: [...(x.added ?? []), c.name] } : x)))
                                }}
                                className="inline-flex h-8 items-center rounded-full bg-foreground text-background px-3 text-xs"
                              >
                                Add to cart
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {m.added?.length ? (
                    <p className="flex items-center gap-1.5 text-xs text-brand-ink px-2"><Check className="w-3.5 h-3.5" />Added to cart: {m.added.join(", ")} · <Link href="/cart" onClick={() => setOpen(false)} className="underline">View cart</Link></p>
                  ) : null}
                  {m.booking && (
                    <div className="w-full rounded-2xl bg-brand-soft border border-brand/40 p-4">
                      <p className="text-xs text-brand-ink">Booking request sent</p>
                      <p className="font-medium mt-0.5">{m.booking.id}</p>
                      <p className="text-sm text-zinc-600">{m.booking.date} · {m.booking.window} · {formatPKR(m.booking.total)} · pay after</p>
                      <Link href={`/booking/confirmed?id=${encodeURIComponent(m.booking.id)}`} onClick={() => setOpen(false)} className="inline-flex mt-3 h-9 items-center rounded-full bg-foreground text-background px-4 text-sm">View booking</Link>
                    </div>
                  )}
                  {(m.handoff || m.offline) && (
                    <a href={m.offline ?? whatsappLink(`Hi Mjazo! ${lastUser}`.trim())} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 h-10 rounded-full bg-[#25D366] text-foreground px-4 text-sm" onClick={() => track("whatsapp_click", { placement: "concierge_handoff" })}>
                      <MessageCircle className="w-4 h-4" />Chat with a person on WhatsApp
                    </a>
                  )}
                </div>
              ))}
              {msgs.length === 1 && (
                <div className="flex flex-wrap gap-2">
                  {CHIPS.map((c) => (
                    <button key={c} onClick={() => (c === "Show you a photo" ? fileRef.current?.click() : send(c))} className="rounded-full border border-zinc-300 bg-white px-3.5 h-9 text-sm hover:border-black transition-colors" dir="auto">{c}</button>
                  ))}
                </div>
              )}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="w-4 h-4 animate-spin" />Thinking…</div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-zinc-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
              {images.length > 0 && (
                <div className="flex gap-2 mb-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="w-14 h-14 rounded-xl object-cover border border-zinc-200" />
                      <button onClick={() => setImages((im) => im.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black text-white flex items-center justify-center" aria-label="Remove photo"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send(input, images)
                }}
                className="flex items-end gap-2"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, 3 - images.length)
                    const shrunk = await Promise.all(files.map(shrink))
                    setImages((im) => [...im, ...shrunk].slice(0, 3))
                    e.target.value = ""
                    track("concierge_photo", { count: files.length })
                  }}
                />
                <button type="button" onClick={() => fileRef.current?.click()} className="w-11 h-11 shrink-0 rounded-full border border-zinc-300 flex items-center justify-center hover:border-black" aria-label="Add a photo"><Camera className="w-5 h-5" /></button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send(input, images)
                    }
                  }}
                  rows={1}
                  dir="auto"
                  placeholder={listening ? "Listening…" : "Type, speak or send a photo"}
                  aria-label="Message"
                  className="flex-1 min-w-0 max-h-32 resize-none rounded-3xl border border-zinc-300 bg-white px-4 py-2.5 text-[16px] sm:text-[15px] outline-none focus:border-foreground"
                />
                {voiceOk && !input.trim() && !images.length ? (
                  <button type="button" onClick={listen} className={cn("w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors", listening ? "bg-red-500 text-white animate-pulse" : "bg-foreground text-background")} aria-label={listening ? "Stop listening" : "Speak"}>
                    <Mic className="w-5 h-5" />
                  </button>
                ) : (
                  <button type="submit" disabled={busy || (!input.trim() && !images.length)} className="w-11 h-11 shrink-0 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-40" aria-label="Send"><ArrowUp className="w-5 h-5" /></button>
                )}
              </form>
              {voiceOk && (
                <div className="flex items-center justify-center gap-1 mt-2 text-[11px] text-zinc-500">
                  Speak in
                  {(["en-PK", "ur-PK"] as const).map((l) => (
                    <button key={l} type="button" onClick={() => setLang(l)} className={cn("px-2 py-0.5 rounded-full", lang === l ? "bg-foreground text-background" : "hover:bg-zinc-100")}>{l === "en-PK" ? "English" : "اردو"}</button>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}

// Minimal typing for the browser speech API (not in TS's DOM lib everywhere).
type SpeechRec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: (ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void
  onend: () => void
  onerror: () => void
}
