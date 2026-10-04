import type { Fields } from "./fields"

// The content-type registry. Each type declares its fields once; the admin, validation, seeding
// and the read layer all work from this. Types are registered from lib/cms/types/*.

export type Group = "Pages" | "Catalogue" | "Blog" | "Help" | "Legal" | "Navigation" | "Settings"

/** A content type. `S` is the shape the site uses; `C` is the CMS shape (before localisation). */
export type ContentType<S = unknown, C = S> = {
  type: string
  label: string
  plural?: string
  group: Group
  kind: "collection" | "singleton"
  icon?: string
  description?: string
  fields: Fields
  /** Built-in content in the site's shape: an array for collections, one object for singletons. */
  defaults: () => S[] | S
  /** Collections: the entry id of a site item (usually its slug). */
  idOf?: (item: S) => string
  /** Convert between the site's shape and the CMS shape when they differ (e.g. FAQ tuples). */
  toCms?: (item: S) => C
  toSite?: (item: C) => S
  /** A short title for lists, history and the activity log. */
  titleOf?: (item: C) => string
  /** Extra columns in the collection list. */
  columns?: { key: string; label: string; format?: "price" | "status" | "ref" }[]
  /** Permission needed to edit at all (field-level `perm` applies on top). */
  perm?: "settings"
  /** Cache tags (besides cms:<type>) that a publish must refresh. */
  tags?: string[]
  /** Public path to preview an item, for "View" and "Preview" links. */
  path?: (item: C) => string | null
  /** Adjust stored data as it is published (e.g. stamp a "last updated" date). */
  beforePublish?: (data: Record<string, unknown>) => Record<string, unknown>
}

const types = new Map<string, ContentType<any, any>>()

export function register<S, C>(t: ContentType<S, C>) {
  if (types.has(t.type)) throw new Error(`CMS type registered twice: ${t.type}`)
  types.set(t.type, t)
  return t
}

export const getType = (type: string) => types.get(type)
export const allTypes = () => [...types.values()]
