import type { Metadata } from "next"
import { PacksPage } from "@/components/account/pack-views"
import { pageLocale } from "@/lib/cms/locale"
import { getUi } from "@/lib/cms/read"
import { pageMetadata } from "@/lib/cms/seo/metadata"
import { packOffersIn } from "@/lib/server/pack-offers"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  const ui = await getUi()
  return pageMetadata({ path: "/account/packs", title: ui.packs.title, noindex: true })
}

export default async function AccountPacksPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params)
  return <PacksPage offers={await packOffersIn(locale)} />
}
