"use client"

import { useState } from "react"
import { useRouter } from "@/components/site/locale-link"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Clock, MessageCircle, Minus, Plus } from "lucide-react"
import { formatDuration, formatPKR, type Category, type Service } from "@/lib/catalog"
import { track } from "@/lib/site"
import { useCart } from "@/lib/store"
import { cn } from "@/lib/utils"
import { NotifyForm } from "@/components/site/notify-form"
import { fill, useCatalog, useSite, useT } from "@/components/cms/provider"

/** Sticky purchase card on a service page (plus a bottom bar on mobile). */
export function ServicePurchase({ category, service }: { category: Category; service: Service }) {
  const { MIN_ORDER } = useCatalog()
  const { whatsappLink } = useSite()
  const t = useT()
  const router = useRouter()
  const add = useCart((s) => s.add)
  const [picks, setPicks] = useState<number[]>(() => service.variants?.map(() => 0) ?? [])
  const [addOns, setAddOns] = useState<string[]>([])
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const live = category.status === "live"
  const onRequest = service.price <= 0

  const variantDelta = service.variants?.reduce((sum, v, i) => sum + v.options[picks[i] ?? 0].delta, 0) ?? 0
  const chosen = service.addOns?.filter((a) => addOns.includes(a.id)) ?? []
  const unit = service.price + variantDelta + chosen.reduce((s, a) => s + a.price, 0)
  const total = unit * qty

  const addToCart = (open: boolean) => {
    for (let i = 0; i < qty; i++) {
      add(
        {
          category: category.slug,
          categoryName: category.name,
          service: service.slug,
          name: service.name,
          options: service.variants?.map((v, vi) => v.options[picks[vi] ?? 0].label) ?? [],
          addOns: chosen,
          unitPrice: unit,
          duration: service.duration,
        },
        { open },
      )
    }
    track("add_to_cart", { category: category.slug, service: service.slug, price: unit, qty })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  if (!live || onRequest) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35)]">
        <p className="text-sm text-zinc-500">{onRequest && live ? t.purchase.pricedToNeeds : t.common.comingSoon}</p>
        <p className="font-serif text-3xl mt-1">{onRequest ? t.common.priceOnRequest : fill(t.common.fromPrice, { price: formatPKR(service.price) })}</p>
        {onRequest && live ? (
          <>
            <p className="text-sm text-zinc-600 mt-3">{t.purchase.quoteBody}</p>
            <a
              href={whatsappLink(fill(t.purchase.quoteMessage, { service: service.name }))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("whatsapp_click", { placement: "service_quote", service: service.slug })}
              className="mt-5 flex items-center justify-center gap-2 h-12 rounded-full bg-foreground text-background text-sm hover:bg-brand hover:text-foreground transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> {t.purchase.quoteCta}
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-600 mt-3 mb-4">{fill(t.purchase.notLive, { service: service.name })}</p>
            <NotifyForm category={category.slug} source={`service-${service.slug}`} compact />
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35)]">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-zinc-500">{t.purchase.allIn}</p>
            <motion.p key={total} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }} className="font-serif text-4xl">{formatPKR(total)}</motion.p>
          </div>
          <p className="text-sm text-zinc-500 flex items-center gap-1"><Clock className="w-4 h-4" />{formatDuration(service.duration, t.duration)}</p>
        </div>

        {service.variants?.map((v, vi) => (
          <fieldset key={v.label} className="mt-6">
            <legend className="text-sm font-medium mb-2">{v.label}</legend>
            <div className="grid grid-cols-2 gap-2">
              {v.options.map((o, oi) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={picks[vi] === oi}
                  onClick={() => setPicks((p) => p.map((x, i) => (i === vi ? oi : x)))}
                  className={cn("rounded-2xl border px-3 py-2.5 text-start text-sm transition-colors", picks[vi] === oi ? "border-foreground bg-foreground text-background" : "border-zinc-200 hover:border-zinc-400")}
                >
                  <span className="block">{o.label}</span>
                  <span className={cn("block text-xs", picks[vi] === oi ? "text-white/60" : "text-zinc-400")}>{o.delta === 0 ? t.purchase.included : `${o.delta > 0 ? "+" : "−"} ${formatPKR(Math.abs(o.delta))}`}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}

        {service.addOns?.length ? (
          <fieldset className="mt-6">
            <legend className="text-sm font-medium mb-2">{t.purchase.addOns}</legend>
            {service.addOns.map((a) => {
              const on = addOns.includes(a.id)
              return (
                <button key={a.id} type="button" aria-pressed={on} onClick={() => setAddOns((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))} className="w-full flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2.5">
                    <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center transition-colors", on ? "bg-foreground border-foreground text-background" : "border-zinc-300")}>{on && <Check className="w-3.5 h-3.5" />}</span>
                    {a.name}
                  </span>
                  <span className="text-zinc-500">+ {formatPKR(a.price)}</span>
                </button>
              )
            })}
          </fieldset>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-medium">{t.purchase.people}</span>
          <div className="flex items-center rounded-full border border-zinc-200">
            <button type="button" aria-label={t.purchase.fewer} onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
            <span className="w-6 text-center" aria-live="polite">{qty}</span>
            <button type="button" aria-label={t.purchase.more} onClick={() => setQty((q) => Math.min(6, q + 1))} className="w-10 h-10 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="mt-6 grid gap-2">
          <button onClick={() => addToCart(true)} className={cn("h-12 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2", added ? "bg-brand text-foreground" : "bg-foreground text-background hover:bg-brand hover:text-foreground")}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={added ? "a" : "b"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-2">
                {added ? <><Check className="w-4 h-4" /> {t.purchase.addedToCart}</> : t.purchase.addToCart}
              </motion.span>
            </AnimatePresence>
          </button>
          <button
            onClick={() => {
              addToCart(false)
              router.push("/checkout")
            }}
            className="h-12 rounded-full border border-zinc-300 text-sm hover:border-foreground transition-colors"
          >
            {t.purchase.bookNow}
          </button>
        </div>
        {unit < MIN_ORDER && <p className="text-xs text-zinc-500 mt-3 text-center">{fill(t.purchase.minNote, { min: formatPKR(MIN_ORDER) })}</p>}
        <a href={whatsappLink(fill(t.purchase.bookMessage, { service: service.name }))} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { placement: "service_card", service: service.slug })} className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-600 hover:text-black">
          <MessageCircle className="w-4 h-4" /> {t.purchase.preferWhatsapp}
        </a>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2">
        <div className="flex items-center gap-3 rounded-full bg-white/95 backdrop-blur border border-zinc-200 shadow-lg ps-5 pe-1.5 py-1.5">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-zinc-500 truncate">{service.name}</p>
            <p className="text-sm font-medium">{formatPKR(total)}</p>
          </div>
          <button onClick={() => addToCart(true)} className={cn("h-11 px-5 rounded-full text-sm", added ? "bg-brand" : "bg-foreground text-background")}>{added ? t.common.added : t.purchase.addToCart}</button>
        </div>
      </div>
    </>
  )
}
