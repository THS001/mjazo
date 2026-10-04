import type { Fields } from "./fields"
import { allTypes, getType, type ContentType, type Group } from "./registry"
import "./types"

// Serialisable descriptions of content types for the admin's client components
// (the registry entries hold functions, which can't cross to the browser).

export type TypeMeta = {
  type: string
  label: string
  plural: string
  group: Group
  kind: "collection" | "singleton"
  icon: string
  description: string | null
  fields: Fields
  columns: { key: string; label: string; format?: "price" | "status" | "ref" }[]
  perm: "settings" | null
}

export const GROUP_ORDER: Group[] = ["Pages", "Catalogue", "Blog", "Help", "Legal", "Navigation", "Settings"]

export const toMeta = (t: ContentType<unknown, unknown>): TypeMeta => ({
  type: t.type,
  label: t.label,
  plural: t.plural ?? t.label,
  group: t.group,
  kind: t.kind,
  icon: t.icon ?? "FileText",
  description: t.description ?? null,
  fields: t.fields,
  columns: t.columns ?? [],
  perm: t.perm ?? null,
})

export const typeMeta = (type: string) => {
  const t = getType(type)
  return t ? toMeta(t) : null
}

export function navGroups() {
  const types = allTypes().map(toMeta)
  return GROUP_ORDER.map((group) => ({ group, types: types.filter((t) => t.group === group) })).filter((g) => g.types.length)
}

/** Every collection a type's ref fields point at (for reference pickers). */
export function refTargets(fields: Fields): string[] {
  const out = new Set<string>()
  const walk = (fs: Fields) => {
    for (const fd of Object.values(fs)) {
      if (fd.kind === "ref") out.add(fd.to)
      else if (fd.kind === "group") walk(fd.fields)
      else if (fd.kind === "list") {
        if (fd.of.kind === "ref") out.add(fd.of.to)
        if (fd.of.kind === "group") walk(fd.of.fields)
      } else if (fd.kind === "blocks") Object.values(fd.blocks).forEach((b) => walk(b.fields))
    }
  }
  walk(fields)
  return [...out]
}
