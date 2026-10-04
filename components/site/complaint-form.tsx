"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, Check, Loader2, Mic, Square, X } from "lucide-react"
import { shrink, useRecorder } from "@/lib/client/media"
import { track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { Field, inputCls } from "./forms"
import { useSite } from "@/components/cms/provider"

export function ComplaintForm() {
  const { whatsappLink } = useSite()
  const [v, setV] = useState({ bookingId: "", phone: "", text: "" })
  const [photo, setPhoto] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const voice = useRecorder(60)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id")
    if (id) setV((x) => ({ ...x, bookingId: id }))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (v.text.trim().length < 10 && !voice.dataUrl) return setError("Please tell us a little more about what went wrong, or record a voice note.")
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/complaint", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...v, bookingId: v.bookingId.trim(), phone: v.phone.replace(/[\s-]/g, ""), photo, audio: voice.dataUrl }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please WhatsApp us.")
      track("complaint_submitted", { photo: Boolean(photo), voice: Boolean(voice.dataUrl) })
      setDone(data.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {done ? (
        <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[32px] bg-white border border-zinc-200 p-8 sm:p-10 text-center">
          <span className="w-16 h-16 rounded-full bg-black text-[var(--brand)] inline-flex items-center justify-center">
            <Check className="w-8 h-8" />
          </span>
          <p className="font-serif text-3xl sm:text-4xl mt-6">We&apos;re on it.</p>
          <p className="text-zinc-600 mt-3 max-w-md mx-auto">
            Your reference is <b className="font-mono">{done}</b>. A person on our team reviews every report and will reply on WhatsApp with what we&apos;ll do to make it right.
          </p>
          <a href={whatsappLink(`Hi Mjazo, about my report ${done} for booking ${v.bookingId}.`)} target="_blank" rel="noreferrer" className="inline-flex mt-8 h-12 px-6 rounded-full bg-[#25D366] text-foreground items-center font-medium">
            Message us on WhatsApp
          </a>
        </motion.div>
      ) : (
        <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[32px] bg-white border border-zinc-200 p-6 sm:p-10 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Booking ID" hint="It starts with MJ- and is in your confirmation.">
              <input className={inputCls} value={v.bookingId} onChange={(e) => setV({ ...v, bookingId: e.target.value })} placeholder="MJ-…" autoCapitalize="characters" required />
            </Field>
            <Field label="Phone used for the booking">
              <input className={inputCls} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} inputMode="tel" placeholder="03xx xxxxxxx" required />
            </Field>
          </div>
          <Field label="What went wrong?" hint="English, Urdu or Roman Urdu: whatever's easiest.">
            <textarea dir="auto" className={cn(inputCls, "h-auto min-h-36 py-3 resize-y")} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })}  placeholder="Tell us what happened, and what would make it right for you." />
          </Field>
          {voice.supported && (
            <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4">
              <p className="text-sm font-medium">Easier to say it? Record a voice note</p>
              <p className="text-xs text-zinc-500 mt-0.5">Up to a minute, in any language.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {voice.state === "recording" ? (
                  <button type="button" onClick={voice.stop} className="h-11 px-4 rounded-full bg-red-600 text-white text-sm inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <Square className="w-3.5 h-3.5 fill-current" /> Stop · 0:{String(voice.seconds).padStart(2, "0")}
                  </button>
                ) : voice.dataUrl ? (
                  <>
                    <audio src={voice.dataUrl} controls className="h-10 max-w-full" />
                    <button type="button" onClick={voice.clear} className="inline-flex items-center gap-1.5 text-sm text-zinc-600 underline">
                      <X className="w-4 h-4" /> Remove
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => voice.start().catch(() => setError("We couldn't use the microphone. You can type instead."))} className="h-11 px-4 rounded-full border border-zinc-300 text-sm inline-flex items-center gap-2 hover:border-black">
                    <Mic className="w-4 h-4" /> Record
                  </button>
                )}
              </div>
            </div>
          )}
          <div>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => e.target.files?.[0] && setPhoto(await shrink(e.target.files[0], 1024, 0.8))} />
            {photo ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Attached photo" className="w-20 h-20 rounded-2xl object-cover" />
                <button type="button" onClick={() => setPhoto(undefined)} className="inline-flex items-center gap-1.5 text-sm text-zinc-600 underline">
                  <X className="w-4 h-4" /> Remove photo
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => file.current?.click()} className="inline-flex items-center gap-2 h-11 px-4 rounded-full border border-zinc-300 text-sm hover:border-black">
                <Camera className="w-4 h-4" /> Add a photo (optional)
              </button>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button disabled={busy} className="w-full sm:w-auto h-12 px-8 rounded-full bg-black text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send report
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  )
}
