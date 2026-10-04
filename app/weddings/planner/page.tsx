import type { Metadata } from "next"
import { ShaadiPlanner } from "@/components/shaadi/planner"

export const metadata: Metadata = {
  alternates: { canonical: "/weddings/planner" },
  title: "Shaadi Orchestrator: plan the whole family's wedding glam",
  description: "Tell us your events and who needs glam. Mjazo's AI plans everyone's pre-wedding glow and works backwards from photo time, so the whole family is ready together. Karachi, at home.",
}

export default function ShaadiPlannerPage() {
  return <ShaadiPlanner />
}
