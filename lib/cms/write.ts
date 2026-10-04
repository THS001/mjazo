import "server-only"
import { revalidateTag, updateTag } from "next/cache"
import { blockFields, resolveObject, zodObject, type BlocksField, type Field, type Fields } from "./fields"
import { allTypes, getType, type ContentType } from "./registry"
import { fieldPermError, publishPermError, typeAccessError } from "./field-perms"
import { CmsAuthError, type CmsUser } from "./auth"
import { ValidationError } from "./action"
import { storedDefaults, withDefaultUrdu } from "./defaults"
import { saveRedirect } from "./redirects"
import {
  addAudit,
  addVersion,
  ConflictError,
  deleteRow,
  dueScheduled,
  getRow,
  getVersion,
  listRows,
  listVersions,
  setPositions,
  writeRow,
  type Data,
  type EntryRow,
} from "./store"
import "./types"

// The admin's view of the CMS and every change it can make. Each mutation checks permissions,
// validates against the type's fields, records a version and an audit entry, and expires the
// cache tag so the public site updates on its next request.

export { ConflictError }
export type State = "default" | "live" | "changed" | "draft" | "scheduled" | "hidden"
export const STATE_LABEL: Record<State, string> = { default: "Live", live: "Live", changed: "Unpublished changes", draft: "Draft", scheduled: "Scheduled", hidden: "Hidden" }

export type ListItem = {
  id: string
  title: string
  state: State
  review: boolean
  updatedAt: string | null
  updatedBy: string | null
  publishAt: string | null
  cols: Record<string, unknown>
  path: string | null
}

export type Loaded = { type: string; id: string; data: Data; version: number; state: State; review: boolean; isDefault: boolean; publishAt: string | null; updatedAt: string | null; updatedBy: string | null; publishedAt: string | null; publishedBy: string | null; live: Data | null }

export { ValidationError }

const mustType = (type: string) => {
  const t = getType(type)
  if (!t) throw new Error(`Unknown content type: ${type}`)
  return t
}

/** Built-in content for a type, in the stored (localised) shape, keyed by entry id. */
export const defaultsOf = (t: ContentType<unknown, unknown>): Map<string, Data> => storedDefaults(t)

function stateOf(row: EntryRow | null, isDefault: boolean): State {
  if (!row) return "default"
  if (row.status === "archived") return "hidden"
  if (row.status === "scheduled") return "scheduled"
  if (row.published) return row.draft ? "changed" : "live"
  return row.draft ? (isDefault ? "changed" : "draft") : isDefault ? "default" : "draft"
}

export const titleOf = (t: ContentType<unknown, unknown>, data: Data | null | undefined, id: string) => {
  if (!data) return id
  const plain = resolveObject(t.fields, data, "en") as Data
  return (t.titleOf ? t.titleOf(plain) : (plain.name as string) || (plain.title as string)) || id
}

// ---------------------------------------------------------------------------
// Reading (admin)
// ---------------------------------------------------------------------------

export async function adminList(type: string): Promise<ListItem[]> {
  const t = mustType(type)
  const defaults = defaultsOf(t)
  const rows = new Map((await listRows(type)).map((r) => [r.id, r]))
  const ids = [...new Set([...defaults.keys(), ...rows.keys()])]
  const order = (id: string) => rows.get(id)?.position ?? ([...defaults.keys()].indexOf(id) >= 0 ? [...defaults.keys()].indexOf(id) : 100_000)
  return ids
    .sort((a, b) => order(a) - order(b))
    .map((id) => {
      const row = rows.get(id) ?? null
      const data = row?.draft ?? row?.published ?? defaults.get(id) ?? null
      const plain = data ? (resolveObject(t.fields, data, "en") as Data) : {}
      return {
        id,
        title: titleOf(t, data, id),
        state: stateOf(row, defaults.has(id)),
        review: Boolean(row?.review),
        updatedAt: row?.updated_at ?? null,
        updatedBy: row?.updated_by ?? null,
        publishAt: row?.publish_at ?? null,
        cols: Object.fromEntries((t.columns ?? []).map((c) => [c.key, plain[c.key] ?? null])),
        path: t.path && data ? t.path(plain) : null,
      }
    })
}

export async function loadEntry(type: string, id: string): Promise<Loaded | null> {
  const t = mustType(type)
  const def = defaultsOf(t).get(id)
  const row = await getRow(type, id)
  const data = row?.draft ?? row?.published ?? def
  if (!data) return null
  return {
    type,
    id,
    // Fields added to the type since this entry was saved start from their default.
    data: def ? withDefaultUrdu(t.fields, { ...def, ...data }, def) : data,
    version: row?.version ?? 0,
    state: stateOf(row, Boolean(def)),
    review: Boolean(row?.review),
    isDefault: Boolean(def),
    publishAt: row?.publish_at ?? null,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
    publishedAt: row?.published_at ?? null,
    publishedBy: row?.published_by ?? null,
    live: row?.published ?? (row?.status === "archived" ? null : (def ?? null)),
  }
}

/** id + title of every item in a collection, for reference pickers. */
export async function refOptions(type: string) {
  return (await adminList(type)).filter((i) => i.state !== "hidden").map((i) => ({ id: i.id, title: i.title }))
}

export { listVersions }

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

// The rules themselves are in field-perms.ts (pure, and tested role by role).
function checkTypeAccess(t: ContentType<unknown, unknown>, user: CmsUser) {
  const error = typeAccessError(t, user.role)
  if (error) throw new CmsAuthError(error)
}

function checkFieldPerms(t: ContentType<unknown, unknown>, user: CmsUser, before: Data | undefined, after: Data) {
  const error = fieldPermError(t.fields, user.role, before, after)
  if (error) throw new CmsAuthError(error)
}

export function validate(t: ContentType<unknown, unknown>, data: Data) {
  const r = zodObject(t.fields).safeParse(data)
  if (r.success) {
    const problems = t.check?.(data) ?? []
    if (problems.length) throw new ValidationError(problems)
    return
  }
  // A readable place for each problem, e.g. "Blocks › Hero #2 › Title".
  const label = (path: (string | number)[]) => {
    let fields: Fields | undefined = t.fields
    let blocks: BlocksField | null = null
    let value: unknown = data
    const parts: string[] = []
    for (const p of path) {
      value = (value as Record<string | number, unknown> | undefined)?.[p]
      if (typeof p === "number") {
        if (blocks) {
          fields = blockFields(blocks, value)
          parts.push(`${fields ? blocks.blocks[(value as { _type: string })._type].label : "Block"} #${p + 1}`)
          blocks = null
        } else parts.push(`#${p + 1}`)
        continue
      }
      const fd: Field | undefined = fields?.[p]
      if (!fd) break
      parts.push(fd.label)
      blocks = fd.kind === "blocks" ? fd : null
      fields = fd.kind === "group" ? fd.fields : fd.kind === "list" && fd.of.kind === "group" ? fd.of.fields : undefined
    }
    return parts.join(" › ") || "Entry"
  }
  throw new ValidationError(r.error.issues.slice(0, 8).map((i) => `${label(i.path)}: ${i.message}`))
}

/** Slugs (and a type's `unique` value, like a block page's address) must be unique within a collection. */
async function checkSlug(t: ContentType<unknown, unknown>, id: string, data: Data) {
  if (t.kind !== "collection") return
  const keys = [...(typeof data.slug === "string" ? [{ key: "slug", label: "Slug" }] : []), ...(t.unique && typeof data[t.unique.key] === "string" ? [t.unique] : [])]
  if (!keys.length) return
  const others = (await adminList(t.type)).filter((i) => i.id !== id && i.state !== "hidden")
  for (const o of others) {
    const loaded = await loadEntry(t.type, o.id)
    for (const k of keys) if (loaded?.data[k.key] === data[k.key]) throw new ValidationError([`${k.label} “${data[k.key]}” is already used by “${o.title}”.`])
  }
}

const changedKeys = (a: Data | null | undefined, b: Data | null | undefined) =>
  [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].filter((k) => JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]))

/** Expire the cached published content of a type: every page that used it re-renders on its next visit. */
function expire(type: string, inServerAction = true) {
  const tag = `cms:${type}`
  if (inServerAction) updateTag(tag)
  else revalidateTag(tag, { expire: 0 })
}

const audit = (user: CmsUser | null, action: string, t: ContentType<unknown, unknown>, id: string, title: string, detail?: string) =>
  addAudit({ user_id: user?.id ?? null, user_name: user?.name ?? "System", action, type: t.type, entry_id: id, title, detail: detail ?? null })

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

type Base = Omit<EntryRow, "version" | "updated_at">
const baseRow = (type: string, id: string, row: EntryRow | null): Base => ({
  type,
  id,
  status: row?.status ?? "draft",
  draft: row?.draft ?? null,
  published: row?.published ?? null,
  review: row?.review ?? false,
  position: row?.position ?? null,
  publish_at: row?.publish_at ?? null,
  updated_by: row?.updated_by ?? null,
  published_by: row?.published_by ?? null,
  published_at: row?.published_at ?? null,
})

export async function saveDraft(user: CmsUser, type: string, id: string, data: Data, version: number, opts: { manual?: boolean; review?: boolean } = {}) {
  const t = mustType(type)
  checkTypeAccess(t, user)
  const before = await loadEntry(type, id)
  checkFieldPerms(t, user, before?.data, data)
  validate(t, data)
  const row = await getRow(type, id)
  const saved = await writeRow({ ...baseRow(type, id, row), draft: data, review: opts.review ?? row?.review ?? false, updated_by: user.name }, version)
  if (opts.manual) await addVersion({ type, entry_id: id, version: saved.version, kind: "saved", data, note: null, user_id: user.id, user_name: user.name })
  if (opts.manual || opts.review) await audit(user, opts.review ? "submitted for review" : "saved", t, id, titleOf(t, data, id), `Changed: ${changedKeys(before?.data, data).join(", ") || "nothing"}`)
  return saved
}

export async function publish(user: CmsUser, type: string, id: string, version: number, inServerAction = true) {
  const t = mustType(type)
  checkTypeAccess(t, user)
  const loaded = await loadEntry(type, id)
  if (!loaded) throw new ValidationError(["This item no longer exists."])
  const denied = publishPermError(t.fields, user.role, loaded.live, loaded.data)
  if (denied) throw new CmsAuthError(denied)
  const data = t.beforePublish ? t.beforePublish(loaded.data) : loaded.data
  validate(t, data)
  await checkSlug(t, id, data)
  const row = await getRow(type, id)
  const now = new Date().toISOString()
  const saved = await writeRow(
    { ...baseRow(type, id, row), status: "published", published: data, draft: null, review: false, publish_at: null, published_at: now, published_by: user.name, updated_by: user.name },
    version,
  )
  await addVersion({ type, entry_id: id, version: saved.version, kind: "published", data, note: null, user_id: user.id, user_name: user.name })
  // A new slug: send the old address to the new one, so links and search results keep working.
  if (t.path && loaded.live) {
    const before = t.path(resolveObject(t.fields, loaded.live, "en") as never)
    const after = t.path(resolveObject(t.fields, data, "en") as never)
    if (before && after && before !== after) await saveRedirect(user, { source: before, destination: after, note: "Added automatically when the address changed" }, { auto: true }).catch((e) => console.error("[cms] auto redirect failed", e))
  }
  expire(type, inServerAction)
  await audit(user, "published", t, id, titleOf(t, data, id), `Changed: ${changedKeys(loaded.live, data).join(", ") || "nothing"}`)
  return saved
}

export async function discardDraft(user: CmsUser, type: string, id: string, version: number) {
  const t = mustType(type)
  checkTypeAccess(t, user)
  const row = await getRow(type, id)
  if (!row) return null
  const isDefault = defaultsOf(t).has(id)
  if (!row.published && !isDefault && row.status !== "archived") {
    await deleteRow(type, id)
    await audit(user, "deleted draft", t, id, titleOf(t, row.draft, id))
    return null
  }
  const saved = await writeRow({ ...baseRow(type, id, row), draft: null, review: false, status: row.status === "scheduled" ? (row.published ? "published" : "draft") : row.status, publish_at: null, updated_by: user.name }, version)
  await audit(user, "discarded changes", t, id, titleOf(t, row.draft, id))
  return saved
}

export async function schedule(user: CmsUser, type: string, id: string, version: number, at: string) {
  const t = mustType(type)
  checkTypeAccess(t, user)
  if (!(Date.parse(at) > Date.now())) throw new ValidationError(["Pick a time in the future."])
  const loaded = await loadEntry(type, id)
  if (!loaded) throw new ValidationError(["This item no longer exists."])
  validate(t, loaded.data)
  const row = await getRow(type, id)
  const saved = await writeRow({ ...baseRow(type, id, row), draft: loaded.data, status: "scheduled", publish_at: new Date(at).toISOString(), updated_by: user.name }, version)
  await audit(user, "scheduled", t, id, titleOf(t, loaded.data, id), `For ${new Date(at).toISOString()}`)
  return saved
}

export async function unschedule(user: CmsUser, type: string, id: string, version: number) {
  const t = mustType(type)
  checkTypeAccess(t, user)
  const row = await getRow(type, id)
  if (!row || row.status !== "scheduled") return row
  const saved = await writeRow({ ...baseRow(type, id, row), status: row.published ? "published" : "draft", publish_at: null, updated_by: user.name }, version)
  await audit(user, "unscheduled", t, id, titleOf(t, row.draft, id))
  return saved
}

export async function createEntry(user: CmsUser, type: string, data: Data) {
  const t = mustType(type)
  if (t.kind !== "collection") throw new Error("Only collections have new items.")
  checkTypeAccess(t, user)
  checkFieldPerms(t, user, undefined, data)
  validate(t, data)
  const id = t.newId ? t.newId(data) : String(data.slug ?? "")
  if (!id) throw new ValidationError([t.newId ? `Give it ${t.unique ? `an ${t.unique.label.toLowerCase()}` : "a name"} first.` : "Give it a slug first."])
  if (defaultsOf(t).has(id) || (await getRow(type, id))) throw new ValidationError([t.newId ? `An item like this already exists (${id}). Choose another ${t.unique?.label.toLowerCase() ?? "name"}.` : `An item with the slug “${id}” already exists.`])
  await checkSlug(t, id, data)
  const saved = await writeRow({ ...baseRow(type, id, null), draft: data, updated_by: user.name }, 0)
  await audit(user, "created", t, id, titleOf(t, data, id))
  return saved
}

/** Hide an item from the site (it can be restored). A never-published new item is deleted outright. */
export async function archive(user: CmsUser, type: string, id: string, version: number) {
  const t = mustType(type)
  checkTypeAccess(t, user)
  if (t.kind !== "collection") throw new Error("Settings and pages can't be deleted.")
  const row = await getRow(type, id)
  const isDefault = defaultsOf(t).has(id)
  const title = titleOf(t, row?.draft ?? row?.published ?? defaultsOf(t).get(id), id)
  if (row && !row.published && !isDefault) {
    await deleteRow(type, id)
  } else {
    await writeRow({ ...baseRow(type, id, row), status: "archived", draft: null, publish_at: null, updated_by: user.name }, version)
    expire(type)
  }
  await audit(user, "hid", t, id, title)
}

export async function unarchive(user: CmsUser, type: string, id: string, version: number) {
  const t = mustType(type)
  checkTypeAccess(t, user)
  const row = await getRow(type, id)
  if (!row || row.status !== "archived") return row
  const saved = await writeRow({ ...baseRow(type, id, row), status: row.published || defaultsOf(t).has(id) ? "published" : "draft", updated_by: user.name }, version)
  expire(type)
  await audit(user, "restored to site", t, id, titleOf(t, row.published ?? defaultsOf(t).get(id), id))
  return saved
}

/** Drag-to-reorder: positions apply to the live site straight away. */
export async function reorder(user: CmsUser, type: string, ids: string[]) {
  const t = mustType(type)
  checkTypeAccess(t, user)
  const existing = new Set((await listRows(type)).map((r) => r.id))
  for (const id of ids) if (!existing.has(id)) await writeRow({ ...baseRow(type, id, null), status: "published", updated_by: user.name }, 0).catch(() => {})
  await setPositions(type, ids.map((id, i) => ({ id, position: i })))
  expire(type)
  await audit(user, "reordered", t, "*", t.plural ?? t.label)
}

export async function restoreVersion(user: CmsUser, type: string, id: string, seq: number, version: number) {
  const t = mustType(type)
  const v = await getVersion(seq)
  if (!v || v.type !== type || v.entry_id !== id) throw new ValidationError(["That version doesn't belong to this item."])
  const saved = await saveDraft(user, type, id, v.data, version)
  await addVersion({ type, entry_id: id, version: saved.version, kind: "restored", data: v.data, note: `From version ${v.version}`, user_id: user.id, user_name: user.name })
  await audit(user, "restored a version", t, id, titleOf(t, v.data, id), `Version ${v.version} from ${v.created_at}`)
  return saved
}

/** Cron: publish everything whose scheduled time has passed. */
export async function publishDue() {
  const system: CmsUser = { id: "system", email: "system", name: "Scheduler", role: "owner" }
  const done: string[] = []
  for (const row of await dueScheduled()) {
    try {
      await publish(system, row.type, row.id, row.version, false)
      done.push(`${row.type}/${row.id}`)
    } catch (e) {
      console.error("[cms] scheduled publish failed", row.type, row.id, e)
    }
  }
  return done
}

export const contentTypes = () => allTypes()
