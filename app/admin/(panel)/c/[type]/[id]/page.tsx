import { notFound } from "next/navigation"
import { getCmsUser } from "@/lib/cms/auth"
import { resolveObject } from "@/lib/cms/fields"
import { refTargets, typeMeta } from "@/lib/cms/meta"
import { getType } from "@/lib/cms/registry"
import { permsFor } from "@/lib/cms/perms"
import { loadEntry, refOptions } from "@/lib/cms/write"
import { Editor } from "@/components/admin/editor"

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const meta = typeMeta((await params).type)
  return { title: meta ? `Edit ${meta.label.toLowerCase()}` : "Not found" }
}

export default async function EntryPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params
  const meta = typeMeta(type)
  const entry = meta ? await loadEntry(type, decodeURIComponent(id)) : null
  if (!meta || !entry) notFound()
  const user = (await getCmsUser())!
  const refs = Object.fromEntries(await Promise.all(refTargets(meta.fields).map(async (t) => [t, await refOptions(t)] as const)))
  const t = getType(type)!
  const path = t.path ? t.path(resolveObject(meta.fields, entry.data, "en")) : "/"
  return <Editor meta={meta} entry={entry} refs={refs} perms={permsFor(user.role, meta.group, meta.perm)} previewPath={path} />
}

