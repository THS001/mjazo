import Link from "next/link"
import { pageUser } from "@/lib/cms/auth"
import { can } from "@/lib/cms/roles"
import { isLocale } from "@/lib/i18n"
import { SeoDashboard } from "@/components/admin/seo"

export const metadata = { title: "SEO" }

export default async function SeoPage({ searchParams }: { searchParams: Promise<{ path?: string; locale?: string }> }) {
  const user = await pageUser()
  const sp = await searchParams
  return (
    <div>
      <h1 className="font-serif text-3xl">SEO</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-zinc-500">
        How every page scores in search, what to fix first, and how fast it loads. Titles, descriptions and focus keywords are edited in each page&apos;s SEO group; site-wide defaults and title patterns are in{" "}
        <Link href="/admin/c/settings-seo/main" className="underline underline-offset-2 hover:text-foreground">
          SEO settings
        </Link>
        . Moved pages go in{" "}
        <Link href="/admin/redirects" className="underline underline-offset-2 hover:text-foreground">
          Redirects
        </Link>
        .
      </p>
      <SeoDashboard canAudit={can(user.role, "seo")} initialPath={sp.path} initialLocale={isLocale(sp.locale) ? sp.locale : undefined} />
    </div>
  )
}
