import type { Field, Fields } from "./fields"
import { AUTHOR_GROUPS, can, type Role } from "./roles"

// Who may change what inside an entry: prices need "prices", SEO fields need "seo", and the SEO
// role (seo without edit) may change SEO fields only. Pure functions that return the reason a change
// is refused (or null), so write.ts enforces them and the tests check every role against them.

type Data = Record<string, unknown>
type TypeInfo = { fields: Fields; group: string; perm?: "settings" | null }

/** People with "seo" but not "edit" (the SEO role). */
export const seoOnly = (role: Role) => !can(role, "edit") && can(role, "seo")

/** Every value of fields carrying `perm`, so we can tell whether a save changed them. */
export function permValues(fields: Fields, data: unknown, perm: Field["perm"]): string {
  const out: unknown[] = []
  const walk = (fd: Field, v: unknown) => {
    if (fd.perm === perm) out.push(v)
    else if (fd.kind === "list" && Array.isArray(v)) v.forEach((x) => walk(fd.of, x))
    else if (fd.kind === "group" && v && typeof v === "object") Object.entries(fd.fields).forEach(([k, f]) => walk(f, (v as Data)[k]))
  }
  Object.entries(fields).forEach(([k, fd]) => walk(fd, (data as Data | undefined)?.[k]))
  return JSON.stringify(out)
}

/** The data with every SEO field left out, to tell whether anything else changed. */
export function withoutSeo(fields: Fields, data: unknown): unknown {
  if (!data || typeof data !== "object") return data
  const out: Data = {}
  for (const [k, fd] of Object.entries(fields)) {
    const v = (data as Data)[k]
    if (fd.perm === "seo") continue
    if (fd.kind === "group") out[k] = withoutSeo(fd.fields, v)
    else if (fd.kind === "list" && Array.isArray(v)) out[k] = fd.of.kind === "group" ? v.map((x) => withoutSeo((fd.of as Extract<Field, { kind: "group" }>).fields, x)) : v
    else out[k] = v
  }
  return out
}

export const onlySeoChanged = (fields: Fields, before: Data | null | undefined, after: Data) => JSON.stringify(withoutSeo(fields, before ?? {})) === JSON.stringify(withoutSeo(fields, after))

/** Whether this role may edit this type at all. */
export function typeAccessError(t: TypeInfo, role: Role): string | null {
  if (!can(role, "edit") && !can(role, "seo")) return "Your role can view content but not change it."
  if (seoOnly(role)) return null // limited to SEO fields by fieldPermError
  if (t.perm === "settings" && !can(role, "settings")) return "Only Owners and Admins can change site settings."
  if (role === "author" && !AUTHOR_GROUPS.includes(t.group)) return "Authors can edit blog posts and help articles only."
  return null
}

/** Whether this role may save `after` over `before`. */
export function fieldPermError(fields: Fields, role: Role, before: Data | null | undefined, after: Data): string | null {
  if (!can(role, "prices") && permValues(fields, before, "prices") !== permValues(fields, after, "prices")) return "Only Owners and Admins can change prices."
  if (!can(role, "seo") && permValues(fields, before, "seo") !== permValues(fields, after, "seo")) return "Your role can't change SEO fields."
  if (seoOnly(role) && !onlySeoChanged(fields, before, after)) return "Your role can change SEO fields only."
  return null
}

/** Whether this role may publish `data` over the live version: the SEO role may publish SEO changes only. */
export function publishPermError(fields: Fields, role: Role, live: Data | null | undefined, data: Data): string | null {
  if (can(role, "publish")) return null
  if (can(role, "seo") && onlySeoChanged(fields, live, data)) return null
  return can(role, "seo") ? "Your role can publish SEO changes only. Ask an Editor to publish the rest." : "Your role can't publish. Submit it for review instead."
}
