import { LegalPage, legalMetadata, loadLegal } from "@/components/site/legal-page"
import { pageLocale } from "@/lib/cms/locale"

export const generateMetadata = () => legalMetadata("privacy", "/privacy")

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <LegalPage {...await loadLegal("privacy")} />
}
