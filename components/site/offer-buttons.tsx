"use client"

import { useRef, useState } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Check, Plus } from "lucide-react"
import { type Bundle } from "@/lib/catalog"
import { track } from "@/lib/site"
import { useCart } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useCatalog } from "@/components/cms/provider"

/** Adds a bundle to the cart as a single line at the bundle price. */
export function AddBundleButton({ bundle, className }: { bundle: Bundle; className?: string }) {
  const { getService } = useCatalog()
  const add = useCart((s) => s.add)
  const [added, setAdded] = useState(false)
  const parts = bundle.items.map((i) => getService(i.category, i.service)).filter(Boolean)
  return (
    <button
      onClick={() => {
        add({
          category: bundle.items[0].category,
          categoryName: "Bundle",
          service: `bundle-${bundle.slug}`,
          name: bundle.name,
          options: parts.map((p) => p!.service.name),
          addOns: [],
          unitPrice: bundle.price,
          duration: parts.reduce((s, p) => s + p!.service.duration, 0),
        })
        track("add_to_cart", { bundle: bundle.slug, price: bundle.price })
        setAdded(true)
        setTimeout(() => setAdded(false), 1800)
      }}
      className={cn("h-12 rounded-full px-6 text-sm font-medium flex items-center gap-2 transition-colors", added ? "bg-white text-black" : "bg-brand text-black hover:bg-white", className)}
    >
      {added ? <><Check className="w-4 h-4" /> Added</> : <><Plus className="w-4 h-4" /> Add bundle</>}
    </button>
  )
}

/** Metallic membership card that tilts toward the pointer (±15°) with a moving sheen. */
export function PlusCard() {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rx = useSpring(useTransform(my, [0, 1], [15, -15]), { stiffness: 150, damping: 18 })
  const ry = useSpring(useTransform(mx, [0, 1], [-15, 15]), { stiffness: 150, damping: 18 })
  const sheen = useTransform(mx, [0, 1], ["0%", "100%"])
  return (
    <motion.div
      style={{ perspective: 1200, transformPerspective: 1200 }}
      className="w-full max-w-md mx-auto"
      initial={{ rotateY: -90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ delay: 0.8, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <motion.div
        ref={ref}
        onPointerMove={(e) => {
          const r = ref.current!.getBoundingClientRect()
          mx.set((e.clientX - r.left) / r.width)
          my.set((e.clientY - r.top) / r.height)
        }}
        onPointerLeave={() => {
          mx.set(0.5)
          my.set(0.5)
        }}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative aspect-[1.586] rounded-[1.6rem] p-7 sm:p-8 text-[#2b2108] overflow-hidden shadow-[0_50px_100px_-30px_rgba(244,164,55,0.45)]"
      >
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #f7e2a6 0%, #e9bf5b 30%, #c9962f 55%, #f3d68a 75%, #b98426 100%)" }} />
        <motion.div className="absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent" style={{ left: sheen, x: "-50%" }} />
        <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay" style={{ backgroundImage: "repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 3px)" }} />
        <div className="relative h-full flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-semibold tracking-[0.3em] text-sm">MJAZO</span>
            <span className="font-serif italic text-2xl">Plus</span>
          </div>
          <div className="w-12 h-9 rounded-md bg-gradient-to-br from-[#fff3c9] to-[#c79a3a] border border-black/10" />
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] tracking-[0.2em] opacity-70">MEMBER</p>
              <p className="font-medium tracking-wide">Plus member</p>
            </div>
            <p className="text-[10px] tracking-[0.2em] opacity-70">KARACHI</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
