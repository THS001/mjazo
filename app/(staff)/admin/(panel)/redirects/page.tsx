import { pageUser } from "@/lib/cms/auth"
import { can } from "@/lib/cms/roles"
import { writable } from "@/lib/cms/store"
import { APP_PATHS, sitePages } from "@/lib/cms/seo/pages"
import { RedirectsManager } from "@/components/admin/redirects"

export const metadata = { title: "Redirects" }

export default async function RedirectsPage() {
  const user = await pageUser()
  const known = [...new Set([...(await sitePages("en")).map((p) => p.path), ...APP_PATHS])]
  return (
    <div>
      <h1 className="font-serif text-3xl">Redirects</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-zinc-500">
        Send visitors (and Google) from an old address to a new one, so links in old messages, ads and search results keep working after a page moves or is removed.
      </p>
      <RedirectsManager canEdit={can(user.role, "seo")} writable={writable()} knownPaths={known} />
    </div>
  )
}
