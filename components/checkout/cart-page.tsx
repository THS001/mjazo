"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ShoppingBag } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { cartTotal, useCart } from "@/lib/store"
import { CartLines, MinOrderBar } from "@/components/site/cart-drawer"
import { ServiceCard } from "@/components/site/service-card"
import { Icon, Pill } from "@/components/site/primitives"
import { useCatalog, useSite } from "@/components/cms/provider"

export function CartPageView() {
  const { allServices, getCategory, getWorld } = useCatalog()
  const { policy } = useSite()
  const { items, clear } = useCart()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const list = mounted ? items : []
  const total = cartTotal(list)
  const groups = Object.entries(
    list.reduce<Record<string, typeof list>>((acc, i) => {
      ;(acc[i.category] ??= []).push(i)
      return acc
    }, {}),
  )
  const inCart = new Set(list.map((i) => i.service))
  const suggestions = allServices.filter((x) => x.category.status === "live" && x.service.popular && !inCart.has(x.service.slug) && x.service.price > 0).slice(0, 4)

  if (!mounted) return <div className="h-64" />
  if (list.length === 0)
    return (
      <div className="rounded-[2rem] border border-dashed border-zinc-300 py-20 text-center">
        <ShoppingBag className="w-12 h-12 mx-auto text-zinc-300" strokeWidth={1} />
        <p className="font-serif text-3xl mt-6">Nothing here yet</p>
        <p className="text-zinc-500 mt-2">Start with a favourite. It takes two minutes.</p>
        <div className="mt-8 flex justify-center"><Pill href="/services/w/beauty-wellness">Browse Beauty & Wellness</Pill></div>
      </div>
    )

  return (
    <>
      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <div className="space-y-4">
          {groups.map(([slug, its]) => {
            const c = getCategory(slug)
            const w = c ? getWorld(c.world) : undefined
            return (
              <div key={slug} className="rounded-3xl border border-zinc-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: w?.tint }}><Icon name={c?.icon ?? "Sparkles"} className="w-5 h-5" /></span>
                  <div className="flex-1">
                    <p className="font-medium">{c?.name}</p>
                    <Link href={`/services/${slug}`} className="text-xs text-zinc-500 underline underline-offset-4">Add more from {c?.name}</Link>
                  </div>
                </div>
                <CartLines items={its} />
              </div>
            )
          })}
          <button onClick={clear} className="text-sm text-zinc-500 underline underline-offset-4 hover:text-black">Clear cart</button>
        </div>
        <aside className="lg:sticky lg:top-28 rounded-3xl bg-zinc-50 p-6 space-y-4">
          <div className="flex justify-between text-sm text-zinc-500"><span>Visit fee</span><span>Free</span></div>
          <div className="flex justify-between text-lg"><span>Total</span><span className="font-medium">{formatPKR(total)}</span></div>
          <MinOrderBar total={total} />
          <Link href="/checkout" className="flex h-14 items-center justify-center rounded-full bg-foreground text-background font-medium hover:bg-brand hover:text-foreground transition-colors">Choose a time</Link>
          <p className="text-xs text-zinc-500 text-center">Pay after your service. Free changes up to {policy.freeChangeHours} hours before.</p>
        </aside>
      </div>
      {suggestions.length > 0 && (
        <section className="mt-20">
          <p className="font-serif text-3xl mb-6">Add something?</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {suggestions.map(({ category, service }) => <ServiceCard key={service.slug} category={category} service={service} className="h-full" />)}
          </div>
        </section>
      )}
    </>
  )
}
