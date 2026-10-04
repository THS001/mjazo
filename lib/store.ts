"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface CartItem {
  key: string
  category: string
  categoryName: string
  service: string
  name: string
  options: string[]
  addOns: { id: string; name: string; price: number }[]
  unitPrice: number
  duration: number
  qty: number
}

interface CartState {
  items: CartItem[]
  open: boolean
  add: (item: Omit<CartItem, "key" | "qty">, opts?: { open?: boolean }) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
  setOpen: (open: boolean) => void
}

const keyOf = (i: Omit<CartItem, "key" | "qty">) =>
  [i.category, i.service, ...i.options, ...i.addOns.map((a) => a.id)].join("|")

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      add: (item, opts) =>
        set((s) => {
          const key = keyOf(item)
          const existing = s.items.find((i) => i.key === key)
          const items = existing
            ? s.items.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i))
            : [...s.items, { ...item, key, qty: 1 }]
          return { items, open: opts?.open ?? true }
        }),
      setQty: (key, qty) =>
        set((s) => ({
          items: qty <= 0 ? s.items.filter((i) => i.key !== key) : s.items.map((i) => (i.key === key ? { ...i, qty } : i)),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
    }),
    { name: "mjazo-cart", partialize: (s) => ({ items: s.items }) },
  ),
)

export const cartTotal = (items: CartItem[]) => items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0)
export const cartCount = (items: CartItem[]) => items.reduce((sum, i) => sum + i.qty, 0)

interface LocationState {
  area: string | null
  subArea: string | null
  set: (area: string | null, subArea?: string | null) => void
}

export const useLocation = create<LocationState>()(
  persist(
    (set) => ({
      area: null,
      subArea: null,
      set: (area, subArea = null) => set({ area, subArea }),
    }),
    { name: "mjazo-location" },
  ),
)
