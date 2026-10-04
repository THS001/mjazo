import type { Metadata } from "next"
import { CartPageView } from "@/components/checkout/cart-page"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/cart", title: "Your cart", noindex: "follow" })
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
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
