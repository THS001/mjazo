"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { track } from "@/lib/site"
import { ServiceCard } from "@/components/site/service-card"
import { useCatalog } from "@/components/cms/provider"

const POPULAR = ["Waxing", "Facial", "Party makeup", "Mehndi", "Keratin", "Massage", "AC service", "Deep cleaning"]

export function SearchView() {
  const { allServices, getCategory, searchServices } = useCatalog()
  const params = useSearchParams()
  const router = useRouter()
  const [q, setQ] = useState(params.get("q") ?? "")

  const results = useMemo(() => {
    return searchServices(q)
      .map((r) => {
        const [, , cat, svc] = r.href.split("/")
        const category = getCategory(cat)
        const service = category?.services.find((s) => s.slug === svc)
        return category && service ? { category, service } : null
      })
      .filter(Boolean) as typeof allServices
  }, [q])

  useEffect(() => {
    if (!q) return
    const t = setTimeout(() => {
      router.replace(`/search?q=${encodeURIComponent(q)}`, { scroll: false })
      track("search", { query: q, results: results.length, source: "search_page" })
    }, 600)
    return () => clearTimeout(t)
  }, [q, results.length, router])

  const live = results.filter((r) => r.category.status === "live")
  const soon = results.filter((r) => r.category.status !== "live")

  return (
    <>
      <h1 className="font-serif text-5xl sm:text-6xl mb-8">{q ? <>Results for “{q}”</> : "What are you looking for?"}</h1>
      <div className="flex items-center gap-3 h-16 rounded-full border border-zinc-300 bg-white px-6 max-w-2xl focus-within:border-foreground transition-colors">
        <Search className="w-5 h-5 text-zinc-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Waxing, facial, AC service…" aria-label="Search services" className="flex-1 bg-transparent outline-none text-[16px] sm:text-lg" />
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {POPULAR.map((p) => (
          <button key={p} onClick={() => setQ(p)} className="rounded-full border border-zinc-200 px-4 h-9 text-sm hover:border-zinc-400">{p}</button>
        ))}
      </div>

      {q && results.length === 0 && <p className="mt-16 text-zinc-500">Nothing matched “{q}”. Try a simpler word, like “wax” or “AC”.</p>}
      {live.length > 0 && (
        <section className="mt-14">
          <p className="text-sm text-zinc-500 mb-4">Live now · {live.length}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{live.map(({ category, service }) => <ServiceCard key={category.slug + service.slug} category={category} service={service} className="h-full" />)}</div>
        </section>
      )}
      {soon.length > 0 && (
        <section className="mt-14">
          <p className="text-sm text-zinc-500 mb-4">Coming soon · {soon.length}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{soon.map(({ category, service }) => <ServiceCard key={category.slug + service.slug} category={category} service={service} className="h-full" />)}</div>
        </section>
      )}
    </>
  )
}
