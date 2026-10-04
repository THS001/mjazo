import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { pageLocale } from "@/lib/cms/locale"
import { getContent, isPreview } from "@/lib/cms/read"
import { pageMetadata } from "@/lib/cms/seo/metadata"
import type { BlockPage } from "@/lib/cms/types/block-page"
import type { Img } from "@/lib/cms/fields"
import { Blocks } from "@/components/cms/blocks"
import { PageHero } from "@/components/site/page-hero"

// Any path no other page matches: a block page from the CMS (Pages → Block pages), else the 404.
// Pages published after a build render on their first visit and are then cached.

export async function generateStaticParams() {
  return (await getContent<BlockPage>("block-page", "en")).map((p) => ({ slug: p.path.slice(1).split("/") }))
}

async function find(slug: string[]) {
  const path = `/${slug.map((s) => decodeURIComponent(s)).join("/")}`
  return (await getContent<BlockPage>("block-page")).find((p) => p.path === path) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string[] }> }): Promise<Metadata> {
  await pageLocale(params)
  const page = await find((await params).slug)
  if (!page) return {}
  const hero = page.blocks.find((b) => b._type === "hero")
  return pageMetadata({ path: page.path, seo: page.seo, title: page.title, description: page.description || (typeof hero?.sub === "string" ? hero.sub : undefined), image: (hero?.image as Img) ?? undefined })
}

export default async function CatchAll({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  await pageLocale(params)
  const [page, preview] = await Promise.all([find((await params).slug), isPreview()])
  if (!page) notFound()
  // A page with no blocks yet still gets its name as a heading.
  if (!page.blocks.length) return <PageHero title={page.title} sub={preview ? "This page has no blocks yet. Add some in the editor." : undefined} />
  return <Blocks blocks={page.blocks} path={page.path} preview={preview} />
}
