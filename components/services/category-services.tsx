"use client"

import Link from "@/components/site/locale-link"
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Clock, Plus } from "lucide-react"
import { formatDuration, formatPKR, type Category } from "@/lib/catalog"
import { useCart } from "@/lib/store"
import { cn } from "@/lib/utils"
import { addServiceToCart } from "@/components/site/service-card"
import { fillNodes, useT } from "@/components/cms/provider"

type Sort = "popular" | "price-asc" | "price-desc" | "duration"
const FILTERS = [
  { id: "under2k", label: "under2k", test: (p: number) => p > 0 && p < 2000 },
  { id: "under1h", label: "under1h", test: (_: number, d: number) => d > 0 && d < 60 },
  { id: "options", label: "hasOptions", test: (_: number, __: number, o: boolean) => o },
] as const

/** The service menu on a category page: sort, filter, quick-add with "added" feedback. */
export function CategoryServices({ category }: { category: Category }) {
  const add = useCart((s) => s.add)
  const t = useT()
  const [sort, setSort] = useState<Sort>("popular")
  const [filters, setFilters] = useState<string[]>([])
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const live = category.status === "live"

  const list = useMemo(() => {
    let l = category.services.filter((s) => filters.every((f) => FILTERS.find((x) => x.id === f)!.test(s.price, s.duration, !!(s.variants?.length || s.addOns?.length))))
    l = [...l].sort((a, b) => {
      if (sort === "price-asc") return (a.price || 1e9) - (b.price || 1e9)
      if (sort === "price-desc") return b.price - a.price
      if (sort === "duration") return (a.duration || 1e9) - (b.duration || 1e9)
      return Number(!!b.popular) - Number(!!a.popular)
    })
    return l
  }, [category.services, sort, filters])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {FILTERS.map((f) => {
          const on = filters.includes(f.id)
          return (
            <button key={f.id} onClick={() => setFilters((s) => (on ? s.filter((x) => x !== f.id) : [...s, f.id]))} aria-pressed={on} className={cn("rounded-full border h-10 px-4 text-sm transition-colors", on ? "bg-foreground text-background border-foreground" : "border-zinc-300 hover:border-zinc-500")}>
              {t.menu[f.label]}
            </button>
          )
        })}
        <label className="ms-auto flex items-center gap-2 text-sm text-zinc-500">
          {t.menu.sort}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-full border border-zinc-300 bg-white px-3 text-[16px] sm:text-sm text-black outline-none">
            <option value="popular">{t.menu.sortPopular}</option>
            <option value="price-asc">{t.menu.sortPriceAsc}</option>
            <option value="price-desc">{t.menu.sortPriceDesc}</option>
            <option value="duration">{t.menu.sortQuickest}</option>
          </select>
        </label>
      </div>

      <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
        <AnimatePresence initial={false}>
          {list.map((s) => {
            const quick = live && s.price > 0 && !s.variants?.length
            const href = `/services/${category.slug}/${s.slug}`
            return (
              <motion.li key={s.slug} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="group py-6 flex gap-5 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={href} className="text-lg font-medium hover:underline underline-offset-4">{s.name}</Link>
                    {s.popular && <span className="text-[11px] rounded-full bg-brand-soft text-brand-ink px-2 py-0.5">{t.common.mostBooked}</span>}
                  </div>
                  <p className="text-sm text-zinc-500 mt-1 max-w-xl">{s.short}</p>
                  <p className="text-sm mt-3 flex items-center gap-4">
                    <span className="font-medium">{s.price > 0 ? fillNodes(t.common.fromPrice, { price: formatPKR(s.price) }, (x) => <span className="text-zinc-400 font-normal">{x}</span>) : t.common.priceOnRequest}</span>
                    <span className="text-zinc-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(s.duration, t.duration)}</span>
                    {(s.variants?.length || s.addOns?.length) ? <span className="text-zinc-400 text-xs">{t.menu.optionsAvailable}</span> : null}
                  </p>
                </div>
                {quick ? (
                  <button
                    onClick={() => {
                      addServiceToCart(category, s, add)
                      setJustAdded(s.slug)
                      setTimeout(() => setJustAdded((x) => (x === s.slug ? null : x)), 1600)
                    }}
                    className={cn("shrink-0 h-10 rounded-full border px-4 text-sm flex items-center gap-1.5 transition-colors", justAdded === s.slug ? "bg-brand border-brand" : "border-zinc-300 hover:bg-foreground hover:text-background hover:border-foreground")}
                  >
                    {justAdded === s.slug ? <><Check className="w-4 h-4" /> {t.common.added}</> : <><Plus className="w-4 h-4" /> {t.common.add}</>}
                  </button>
                ) : (
                  <Link href={href} className="shrink-0 h-10 rounded-full border border-zinc-300 px-4 text-sm flex items-center hover:bg-foreground hover:text-background hover:border-foreground transition-colors">
                    {live ? t.common.chooseOptions : t.common.view}
                  </Link>
                )}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
      {list.length === 0 && (
        <p className="text-sm text-zinc-500 py-10 text-center">
          {t.menu.none} <button className="underline" onClick={() => setFilters([])}>{t.menu.clear}</button>
        </p>
      )}
    </div>
  )
}
