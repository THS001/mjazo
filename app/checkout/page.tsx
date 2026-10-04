import type { Metadata } from "next"
import { CheckoutFlow } from "@/components/checkout/checkout-flow"

export const metadata: Metadata = {
  alternates: { canonical: "/checkout" }, title: "Checkout", robots: { index: false, follow: false } }

export default function CheckoutPage() {
  return (
    <div className="bg-zinc-50 min-h-screen pt-28 sm:pt-32 pb-40 lg:pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Checkout</p>
          <h1 className="font-serif text-5xl sm:text-6xl">Almost there.</h1>
          <p className="text-zinc-600 mt-3">Four quick steps. Nothing to pay now.</p>
        </div>
        <CheckoutFlow />
      </div>
    </div>
  )
}
