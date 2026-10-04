"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Icon } from "@/components/site/primitives"
import { useCatalog } from "@/components/cms/provider"

/** Sticky chip bar that jumps between world sections and highlights the one in view. */
export function WorldJump() {
  const { worlds } = useCatalog()
  const [active, setActive] = useState(worlds[0].slug)
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const v = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (v) setActive(v.target.id)
      },
      { rootMargin: "-30% 0px -60% 0px" },
    )
    worlds.forEach((w) => {
      const el = document.getElementById(w.slug)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  const go = (slug: string) => {
    const el = document.getElementById(slug)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 150
    const lenis = (window as unknown as { lenis?: { scrollTo: (y: number) => void } }).lenis
    if (lenis) lenis.scrollTo(y)
    else window.scrollTo({ top: y, behavior: "smooth" })
  }

  return (
    <div className="sticky top-[76px] sm:top-[84px] z-30 py-3 bg-cream/85 backdrop-blur-xl border-y border-zinc-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 overflow-x-auto no-scrollbar">
        {worlds.map((w) => (
          <button
            key={w.slug}
            onClick={() => go(w.slug)}
            className={cn("shrink-0 flex items-center gap-2 rounded-full px-4 h-10 text-sm border transition-colors", active === w.slug ? "bg-foreground text-background border-foreground" : "bg-white border-zinc-200 hover:border-zinc-400")}
          >
            <Icon name={w.icon} className="w-4 h-4" />
            {w.name}
          </button>
        ))}
      </div>
    </div>
  )
}
