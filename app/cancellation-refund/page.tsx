import { LegalPage, legalMetadata, loadLegal } from "@/components/site/legal-page"

export const generateMetadata = () => legalMetadata("cancellation-refund", "/cancellation-refund")

export default async function Page() {
  return <LegalPage {...await loadLegal("cancellation-refund")} />
}
