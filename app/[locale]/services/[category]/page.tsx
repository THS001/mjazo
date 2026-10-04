import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CategoryView } from "@/components/services/category-view"
import { getCatalog, getSeoSettings } from "@/lib/cms/read"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateStaticParams() {
  const { visibleCategories } = await getCatalog()
  return visibleCategories.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; category: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const [{ getCategory }, s] = await Promise.all([getCatalog(), getSeoSettings()])
  const c = getCategory((await params).category)
  if (!c) return {}
  return pageMetadata({ path: `/services/${c.slug}`, seo: c.seo, title: s.patterns.categoryTitle, description: c.status === "live" ? s.patterns.categoryDescription : s.patterns.categoryDescriptionSoon, vars: { category: c.name, tagline: c.tagline }, image: c.image })
}

export default async function CategoryPage({ params }: { params: Promise<{ locale: string; category: string }> }) {
  await pageLocale(params)
  const { getCategory, getWorld, visibleCategories } = await getCatalog()
  const category = getCategory((await params).category)
  if (!category) notFound()
  const world = getWorld(category.world)!
  return <CategoryView category={category} crumbs={[{ label: "Services", href: "/services" }, { label: world.name, href: `/services/w/${world.slug}` }, { label: category.name }]} />
}
