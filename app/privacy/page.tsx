import { LegalPage, legalMetadata, loadLegal } from "@/components/site/legal-page"

export const generateMetadata = () => legalMetadata("privacy", "/privacy")

export default async function Page() {
  return <LegalPage {...await loadLegal("privacy")} />
}
