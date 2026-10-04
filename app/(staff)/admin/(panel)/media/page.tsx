import { getCmsUser } from "@/lib/cms/auth"
import { can } from "@/lib/cms/roles"
import { writable } from "@/lib/cms/store"
import { MediaLibrary } from "@/components/admin/media"

export const metadata = { title: "Media" }

export default async function MediaPage() {
  const user = (await getCmsUser())!
  const canEdit = can(user.role, "media") && writable()
  return (
    <div>
      <h1 className="font-serif text-3xl">Media</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-zinc-500">
        Images, videos and 3D models for the site. Drop files anywhere on this page to upload. Pick a file to edit its alt text, focal point and tags, see where it's used, or replace it everywhere at once.
      </p>
      <MediaLibrary mode="manage" canEdit={canEdit} canDelete={can(user.role, "media.delete") && writable()} />
    </div>
  )
}
