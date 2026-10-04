"use client"

import Link from "next/link"
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { formatPKR } from "@/lib/catalog"
import { cartTotal, useCart, type CartItem } from "@/lib/store"
import { Pill } from "./primitives"
import { useCatalog } from "@/components/cms/provider"

export function CartLines({ items }: { items: CartItem[] }) {
  const { setQty, remove } = useCart()
  return (
    <ul className="divide-y divide-zinc-100">
      {items.map((i) => (
        <li key={i.key} className="py-4 flex gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{i.name}</p>
            <p className="text-xs text-zinc-500">{i.categoryName}</p>
            {(i.options.length > 0 || i.addOns.length > 0) && (
              <p className="text-xs text-zinc-500 mt-1">{[...i.options, ...i.addOns.map((a) => `+ ${a.name}`)].join(" · ")}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center rounded-full border border-zinc-200">
                <button className="w-7 h-7 flex items-center justify-center" onClick={() => setQty(i.key, i.qty - 1)} aria-label="Decrease"><Minus className="w-3 h-3" /></button>
                <span className="w-5 text-center text-sm">{i.qty}</span>
                <button className="w-7 h-7 flex items-center justify-center" onClick={() => setQty(i.key, i.qty + 1)} aria-label="Increase"><Plus className="w-3 h-3" /></button>
              </div>
              <button onClick={() => remove(i.key)} className="text-zinc-400 hover:text-black" aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <p className="text-sm font-medium whitespace-nowrap">{formatPKR(i.unitPrice * i.qty)}</p>
        </li>
      ))}
    </ul>
  )
}

export function MinOrderBar({ total }: { total: number }) {
  const { MIN_ORDER } = useCatalog()
  const pct = Math.min(100, (total / MIN_ORDER) * 100)
  if (total >= MIN_ORDER) return <p className="text-xs text-brand-ink">Minimum order reached. Nice.</p>
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1.5">Add {formatPKR(MIN_ORDER - total)} more to reach the {formatPKR(MIN_ORDER)} minimum per visit.</p>
      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden"><div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export function CartDrawer() {
  const { items, open, setOpen } = useCart()
  const total = cartTotal(items)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full sm:max-w-md p-0 gap-0 pb-[env(safe-area-inset-bottom)]">
        <div className="p-6 border-b border-zinc-100">
          <SheetTitle className="font-serif text-3xl font-normal">Your cart</SheetTitle>
          <SheetDescription>Prices are all-in. Pay after the service.</SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6" data-lenis-prevent>
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-16">
              <ShoppingBag className="w-10 h-10 text-zinc-300" strokeWidth={1} />
              <p className="text-zinc-500 text-sm">Nothing here yet.</p>
              <Pill href="/services/w/beauty-wellness" variant="outline" onClick={() => setOpen(false)}>Browse beauty</Pill>
            </div>
          ) : (
            <CartLines items={items} />
          )}
        </div>
        {items.length > 0 && (
          <div className="p-6 border-t border-zinc-100 space-y-4">
            <MinOrderBar total={total} />
            <div className="flex justify-between text-base"><span>Total</span><span className="font-medium">{formatPKR(total)}</span></div>
            <div className="flex gap-2">
              <Link href="/cart" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-full border border-zinc-300 flex items-center justify-center text-sm hover:border-black">View cart</Link>
              <Link href="/checkout" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-full bg-foreground text-background flex items-center justify-center text-sm hover:bg-brand hover:text-foreground transition-colors">Checkout</Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
