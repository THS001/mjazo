import type { Metadata } from "next"
import { Suspense } from "react"
import { Confirmation } from "@/components/checkout/confirmation"

export const metadata: Metadata = {
  alternates: { canonical: "/booking/confirmed" }, title: "Booking confirmed", robots: { index: false, follow: false } }

export default function ConfirmedPage() {
  return (
    <div className="min-h-screen pt-28 sm:pt-32 pb-24" style={{ background: "radial-gradient(120% 60% at 50% 0%, oklch(0.95 0.05 80) 0%, oklch(0.985 0 0) 60%)" }}>
      <Suspense fallback={null}>
        <Confirmation />
      </Suspense>
    </div>
  )
}
