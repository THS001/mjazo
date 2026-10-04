import { notFound, redirect } from "next/navigation"
import { pageUser } from "@/lib/cms/auth"
import { refTargets, typeMeta } from "@/lib/cms/meta"
import { SINGLETON } from "@/lib/cms/read"
import { can } from "@/lib/cms/roles"
import { adminList, refOptions } from "@/lib/cms/write"
import { CollectionList } from "@/components/admin/list"

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const meta = typeMeta((await params).type)
  return { title: meta ? (meta.kind === "collection" ? meta.plural : meta.label) : "Not found" }
}

export default async function CollectionPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const meta = typeMeta(type)
  if (!meta) notFound()
  if (meta.kind === "singleton") redirect(`/admin/c/${type}/${SINGLETON}`)
  const user = await pageUser()
  const [items, refs] = await Promise.all([adminList(type), Promise.all(refTargets(meta.fields).map(async (t) => [t, await refOptions(t)] as const))])
  const editable = can(user.role, "edit") && (meta.perm !== "settings" || can(user.role, "settings"))
  return <CollectionList meta={meta} items={items} refs={Object.fromEntries(refs)} canCreate={editable} canReorder={editable && can(user.role, "publish")} />
}
