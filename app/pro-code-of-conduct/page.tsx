import { LegalPage, legalMetadata, loadLegal } from "@/components/site/legal-page"

export const generateMetadata = () => legalMetadata("pro-code-of-conduct", "/pro-code-of-conduct")

export default async function Page() {
  return <LegalPage {...await loadLegal("pro-code-of-conduct")} />
}
