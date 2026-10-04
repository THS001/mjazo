import type { Metadata } from "next"
import { GlamMirror } from "@/components/glam/glam-mirror"
import { getPage } from "@/lib/cms/read"
import type { GlamContent } from "@/lib/cms/types/pages/tools"
import { pageLocale } from "@/lib/cms/locale"

export const metadata: Metadata = {
  alternates: { canonical: "/glam-mirror" },
  title: "Glam Mirror: try mehndi and makeup before you book",
  description: "Try mehndi designs on a photo of your own hand and see lip colours, blush, kajal and hair colour live on your face. It all runs on your phone. Save the look and send it to your Mjazo pro.",
}

export default async function GlamMirrorPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <GlamMirror content={await getPage<GlamContent>("glam-mirror")} />
}
