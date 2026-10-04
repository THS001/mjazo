"use client"

import Link from "@/components/site/locale-link"
import { Clock, Plus } from "lucide-react"
import { formatDuration, formatPKR, type Category, type Service } from "@/lib/catalog"
import { track } from "@/lib/site"
import { useCart } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Icon } from "./primitives"
import { fillNodes, useCatalog, useT } from "@/components/cms/provider"
import { CmsImage, isImage } from "@/components/cms/image"

export function addServiceToCart(category: Category, service: Service, add: ReturnType<typeof useCart.getState>["add"]) {
  add({
    category: category.slug,
    categoryName: category.name,
    service: service.slug,
    name: service.name,
    options: service.variants?.map((v) => v.options[0].label) ?? [],
    addOns: [],
    unitPrice: service.price,
    duration: service.duration,
  })
  track("add_to_cart", { category: category.slug, service: service.slug, price: service.price })
}

export function ServiceCard({ category, service, className }: { category: Category; service: Service; className?: string }) {
  const { getWorld } = useCatalog()
  const t = useT()
  const add = useCart((s) => s.add)
  const world = getWorld(category.world)
  const href = `/services/${category.slug}/${service.slug}`
  const live = category.status === "live"
  const quickAdd = live && service.price > 0 && !service.variants?.length

  return (
    <div className={cn("group relative flex flex-col rounded-3xl border border-zinc-200 bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.2)]", className)}>
      <Link href={href} className="relative aspect-[4/3] overflow-hidden" style={{ background: world?.tint }} aria-label={service.name}>
        {isImage(service.image) ? (
          <CmsImage img={service.image} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700 group-hover:scale-110">
              <Icon name={category.icon} className="w-16 h-16 text-black/70" strokeWidth={1} />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.6),transparent_60%)]" />
          </>
        )}
        {service.popular && <span className="absolute top-3 start-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium">{t.common.mostBooked}</span>}
        {!live && <span className="absolute top-3 end-3 rounded-full bg-black/70 text-white px-2.5 py-1 text-[11px]">{t.common.comingSoon}</span>}
      </Link>
      <div className="flex flex-col flex-1 p-5">
        <p className="text-xs text-zinc-500 mb-1">{category.name}</p>
        <Link href={href} className="font-medium leading-snug hover:underline underline-offset-4">{service.name}</Link>
        <p className="text-sm text-zinc-500 mt-1.5 line-clamp-2 flex-1">{service.short}</p>
        <div className="flex items-end justify-between mt-4">
          <div>
            <p className="text-sm font-medium">{service.price > 0 ? fillNodes(t.common.fromPrice, { price: formatPKR(service.price) }, (s) => <span className="text-zinc-400 font-normal text-xs">{s}</span>) : t.common.priceOnRequest}</p>
            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" />{formatDuration(service.duration, t.duration)}</p>
          </div>
          {quickAdd ? (
            <button onClick={() => addServiceToCart(category, service, add)} className="h-9 rounded-full border border-zinc-300 ps-3 pe-3.5 text-sm flex items-center gap-1 hover:bg-foreground hover:text-background hover:border-foreground transition-colors">
              <Plus className="w-3.5 h-3.5" /> {t.common.add}
            </button>
          ) : (
            <Link href={href} className="h-9 rounded-full border border-zinc-300 px-3.5 text-sm flex items-center hover:bg-foreground hover:text-background hover:border-foreground transition-colors">
              {live ? t.common.options : t.common.notifyMe}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
