import type { Metadata } from "next"
import { GlamMirror } from "@/components/glam/glam-mirror"
import { getPage } from "@/lib/cms/read"
import type { GlamContent } from "@/lib/cms/types/pages/tools"
import { pageLocale } from "@/lib/cms/locale"
import { pageMetadata } from "@/lib/cms/seo/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await pageLocale(params)
  return pageMetadata({ path: "/glam-mirror", seo: (await getPage("glam-mirror")).seo })
}

export default async function GlamMirrorPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <GlamMirror content={await getPage<GlamContent>("glam-mirror")} />
}
