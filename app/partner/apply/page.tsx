import type { Metadata } from "next"
import { ApplyForm } from "@/components/partner/apply-form"

export const metadata: Metadata = {
  alternates: { canonical: "/partner/apply" }, title: "Apply to join Mjazo as a beautician", description: "Apply in 2 minutes, in English or Urdu. We never ask for your CNIC online." }

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-brand pt-28 sm:pt-32 pb-24 px-4 sm:px-6">
      <ApplyForm />
    </div>
  )
}
