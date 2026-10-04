"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "@/components/site/locale-link"
import { ArrowUpRight, Search } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { track } from "@/lib/site"
import { cn } from "@/lib/utils"
import { StatusChip } from "./primitives"
import { fill, useCatalog, useT } from "@/components/cms/provider"

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { searchServices } = useCatalog()
  const t = useT()
  const router = useRouter()
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const results = useMemo(() => searchServices(q).slice(0, 8), [q])
  const timer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    if (!q) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => track("search", { query: q, results: results.length }), 800)
  }, [q, results.length])

  const go = (href: string) => {
    onOpenChange(false)
    setQ("")
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 sm:max-w-xl overflow-hidden rounded-3xl top-[20%] translate-y-0" showCloseButton={false}>
        <DialogTitle className="sr-only">{t.search.title}</DialogTitle>
        <div className="flex items-center gap-3 px-5 border-b border-zinc-200">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1))
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0))
              if (e.key === "Enter") {
                if (results[active]) go(results[active].href)
                else if (q) go(`/search?q=${encodeURIComponent(q)}`)
              }
            }}
            placeholder={t.search.placeholder}
            className="flex-1 h-14 bg-transparent outline-none text-base"
          />
          <kbd className="hidden sm:block text-[10px] text-zinc-400 border border-zinc-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50svh] overflow-y-auto overscroll-contain p-2" data-lenis-prevent>
          {!q && (
            <div className="p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-400 mb-3">{t.search.popular}</p>
              <div className="flex flex-wrap gap-2">
                {t.search.popularTerms.map((p) => (
                  <button key={p} onClick={() => setQ(p)} className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm hover:border-zinc-400 transition-colors">{p}</button>
                ))}
              </div>
            </div>
          )}
          {q && results.length === 0 && (
            <div className="p-6 text-center text-sm text-zinc-500">
              {fill(t.search.noMatch, { q })}{" "}
              <button
                className="underline"
                onClick={() => {
                  onOpenChange(false)
                  window.dispatchEvent(new CustomEvent("mjazo:concierge", { detail: { prompt: q } }))
                }}
              >
                {t.search.askAi}
              </button>{" "}
              {t.search.or} <button className="underline" onClick={() => go("/services")}>{t.search.browseAll}</button>
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.href}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r.href)}
              className={cn("w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-start transition-colors", i === active && "bg-zinc-100")}
            >
              <span>
                <span className="block text-sm font-medium">{r.title}</span>
                <span className="block text-xs text-zinc-500">{r.subtitle}</span>
              </span>
              <span className="flex items-center gap-2">
                <StatusChip status={r.status} liveLabel={t.common.live} />
                <ArrowUpRight className="w-4 h-4 text-zinc-400 rtl:-scale-x-100" />
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
