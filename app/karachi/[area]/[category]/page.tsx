import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CategoryView } from "@/components/services/category-view"
import { getCatalog } from "@/lib/cms/read"

// Local SEO pages, e.g. /karachi/dha/womens-salon → "Women's Salon in DHA".
export async function generateStaticParams() {
  const { areas, visibleCategories } = await getCatalog()
  return areas.flatMap((a) => visibleCategories.map((c) => ({ area: a.slug, category: c.slug })))
}

export async function generateMetadata({ params }: { params: Promise<{ area: string; category: string }> }): Promise<Metadata> {
  const { getArea, getCategory } = await getCatalog()
  const p = await params
  const a = getArea(p.area)
  const c = getCategory(p.category)
  if (!a || !c) return {}
  const live = a.status === "live" && c.status === "live"
  return {
    title: `${c.name} at home in ${a.name}, Karachi`,
    description: `${c.tagline} in ${a.name}. ${live ? "Book today with all-in prices and pay after." : "Coming soon: join the waitlist."}`,
    alternates: { canonical: `/karachi/${a.slug}/${c.slug}` },
  }
}

export default async function AreaCategoryPage({ params }: { params: Promise<{ area: string; category: string }> }) {
  const { areas, getArea, getCategory, visibleCategories } = await getCatalog()
  const p = await params
  const area = getArea(p.area)
  const category = getCategory(p.category)
  if (!area || !category) notFound()
  return <CategoryView category={category} area={area} crumbs={[{ label: "Areas", href: "/karachi" }, { label: area.name, href: `/karachi/${area.slug}` }, { label: category.name }]} />
}
