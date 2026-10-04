import { LegalPage, legalMetadata, loadLegal } from "@/components/site/legal-page"

export const generateMetadata = () => legalMetadata("terms", "/terms")

export default async function Page() {
  return <LegalPage {...await loadLegal("terms")} />
}
