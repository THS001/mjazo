import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CategoryView } from "@/components/services/category-view"
import { getCatalog } from "@/lib/cms/read"

export async function generateStaticParams() {
  const { visibleCategories } = await getCatalog()
  return visibleCategories.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { getCategory } = await getCatalog()
  const c = getCategory((await params).category)
  if (!c) return {}
  return {
    title: `${c.name} at home in Karachi: ${c.tagline}`,
    alternates: { canonical: `/services/${c.slug}` },
    description: `${c.tagline}. ${c.status === "live" ? "Book verified pros across Karachi with all-in prices. Pay after the service." : "Coming soon: join the waitlist."}`,
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { getCategory, getWorld, visibleCategories } = await getCatalog()
  const category = getCategory((await params).category)
  if (!category) notFound()
  const world = getWorld(category.world)!
  return <CategoryView category={category} crumbs={[{ label: "Services", href: "/services" }, { label: world.name, href: `/services/w/${world.slug}` }, { label: category.name }]} />
}
