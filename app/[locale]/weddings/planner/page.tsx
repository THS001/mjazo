import type { Metadata } from "next"
import { ShaadiPlanner } from "@/components/shaadi/planner"
import { getPage } from "@/lib/cms/read"
import type { PlannerContent } from "@/lib/cms/types/pages/tools"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/weddings/planner", seo: (await getPage("shaadi-planner")).seo })
}

export default async function ShaadiPlannerPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  const c = await getPage<PlannerContent>("shaadi-planner")
  return <ShaadiPlanner hero={c.hero} t={c.tool} />
}
