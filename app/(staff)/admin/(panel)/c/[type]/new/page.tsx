import { notFound } from "next/navigation"
import { getCmsUser } from "@/lib/cms/auth"
import { refTargets, typeMeta } from "@/lib/cms/meta"
import { refOptions } from "@/lib/cms/write"
import { Editor } from "@/components/admin/editor"
import { permsFor } from "@/lib/cms/perms"

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const meta = typeMeta((await params).type)
  return { title: meta ? `New ${meta.label.toLowerCase()}` : "Not found" }
}

export default async function NewEntryPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const meta = typeMeta(type)
  if (!meta || meta.kind !== "collection") notFound()
  const user = (await getCmsUser())!
  const refs = Object.fromEntries(await Promise.all(refTargets(meta.fields).map(async (t) => [t, await refOptions(t)] as const)))
  return <Editor meta={meta} entry={null} refs={refs} perms={permsFor(user.role, meta.group, meta.perm)} previewPath={null} />
}
