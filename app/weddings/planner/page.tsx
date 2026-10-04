import type { Metadata } from "next"
import { ShaadiPlanner } from "@/components/shaadi/planner"
import { getPage } from "@/lib/cms/read"
import type { PlannerContent } from "@/lib/cms/types/pages/tools"

export const metadata: Metadata = {
  alternates: { canonical: "/weddings/planner" },
  title: "Shaadi Orchestrator: plan the whole family's wedding glam",
  description: "Tell us your events and who needs glam. Mjazo's AI plans everyone's pre-wedding glow and works backwards from photo time, so the whole family is ready together. Karachi, at home.",
}

export default async function ShaadiPlannerPage() {
  return <ShaadiPlanner hero={(await getPage<PlannerContent>("shaadi-planner")).hero} />
}
