import type { Metadata } from "next"
import { CartPageView } from "@/components/checkout/cart-page"

export const metadata: Metadata = {
  alternates: { canonical: "/cart" }, title: "Your cart", robots: { index: false, follow: true } }

export default function CartPage() {
  return (
    <div className="pt-28 sm:pt-32 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Cart</p>
        <h1 className="font-serif text-5xl sm:text-6xl mb-10">Your glow list.</h1>
        <CartPageView />
      </div>
    </div>
  )
}
