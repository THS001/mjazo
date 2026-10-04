"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Browser helpers shared by the staff apps and the complaint form: photo shrinking, voice input
// (Web Speech) and read-aloud.

export async function shrink(file: File, max = 1024, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement("canvas")
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL("image/jpeg", quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

type SpeechRec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

/** Speech-to-text: `start(lang, onInterim, onFinal)`; `supported` is false where the browser has no Web Speech. */
export function useVoice() {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const rec = useRef<SpeechRec | null>(null)
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])
  const start = useCallback((lang: string, onInterim: (t: string) => void, onFinal: (t: string) => void) => {
    if (rec.current) return rec.current.stop()
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = lang
    r.interimResults = true
    r.continuous = false
    let finalText = ""
    r.onresult = (ev) => {
      let interim = ""
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const x = ev.results[i]
        if (x.isFinal) finalText += x[0].transcript
        else interim += x[0].transcript
      }
      onInterim(finalText + interim)
    }
    r.onend = () => {
      setListening(false)
      rec.current = null
      if (finalText.trim()) onFinal(finalText.trim())
    }
    r.onerror = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
  }, [])
  return { supported, listening, start }
}

export const hasUrdu = (s: string) => /[؀-ۿ]/.test(s)

export function speak(text: string, lang?: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang ?? (hasUrdu(text) ? "ur-PK" : "en-PK")
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase()))
  if (voice) u.voice = voice
  u.rate = 0.98
  window.speechSynthesis.speak(u)
  return true
}

/** Best-effort location for check-ins and SOS; resolves empty if denied or slow. */
export function locate(timeout = 6000): Promise<{ lat?: number; lng?: number }> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res({})
    const t = setTimeout(() => res({}), timeout + 500)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(t)
        res({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) })
      },
      () => {
        clearTimeout(t)
        res({})
      },
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    )
  })
}

/** Voice notes up to `maxSec` (MediaRecorder). Gives a data URL ready to upload. */
export function useRecorder(maxSec = 60) {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<"idle" | "recording" | "done">("idle")
  const [seconds, setSeconds] = useState(0)
  const [dataUrl, setDataUrl] = useState<string>()
  const rec = useRef<MediaRecorder | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia)
    return () => {
      if (timer.current) clearInterval(timer.current)
      rec.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    if (rec.current?.state === "recording") rec.current.stop()
  }, [])
  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t))
    const r = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 })
    const chunks: Blob[] = []
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: (r.mimeType || "audio/webm").split(";")[0] })
      const fr = new FileReader()
      fr.onload = () => {
        setDataUrl(String(fr.result))
        setState("done")
      }
      fr.readAsDataURL(blob)
    }
    rec.current = r
    setSeconds(0)
    setDataUrl(undefined)
    setState("recording")
    r.start()
    const t0 = Date.now()
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000)
      setSeconds(s)
      if (s >= maxSec) stop()
    }, 250)
  }, [maxSec, stop])
  const clear = useCallback(() => {
    setDataUrl(undefined)
    setSeconds(0)
    setState("idle")
  }, [])
  return { supported, state, seconds, dataUrl, start, stop, clear }
}
