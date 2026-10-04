import { LegalPage, legalMetadata, loadLegal } from "@/components/site/legal-page"
import { pageLocale } from "@/lib/cms/locale"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return legalMetadata("terms", "/terms")
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <LegalPage {...await loadLegal("terms")} />
}
