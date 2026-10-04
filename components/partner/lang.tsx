"use client"

import { useEffect, useState } from "react"
import type { Lang } from "@/lib/content"
import { cn } from "@/lib/utils"

const KEY = "mjazo-partner-lang"

/** Language for the partner pages: ?lang= wins, then the last choice, then English. */
export function usePartnerLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>("en")
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("lang") as Lang | null
    let saved: Lang | null = null
    try {
      saved = localStorage.getItem(KEY) as Lang | null
    } catch {}
    const l = q && ["en", "ur", "ro"].includes(q) ? q : saved && ["en", "ur", "ro"].includes(saved) ? saved : "en"
    setLang(l)
  }, [])
  const set = (l: Lang) => {
    setLang(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {}
  }
  return [lang, set]
}

export function LangSwitch({ lang, onChange, className }: { lang: Lang; onChange: (l: Lang) => void; className?: string }) {
  const opts: { id: Lang; label: string }[] = [
    { id: "en", label: "English" },
    { id: "ur", label: "اردو" },
    { id: "ro", label: "Roman Urdu" },
  ]
  return (
    <div role="group" aria-label="Language" className={cn("inline-flex rounded-full bg-black/10 p-1", className)}>
      {opts.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={lang === o.id} className={cn("h-9 px-4 rounded-full text-sm transition-colors", o.id === "ur" && "font-urdu", lang === o.id ? "bg-black text-white" : "text-black/70 hover:text-black")}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const urduCls = (lang: Lang) => (lang === "ur" ? "font-urdu leading-[2.1]" : "")
