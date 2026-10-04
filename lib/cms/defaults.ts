import { localizeObject, type Field, type Fields, type RichDoc } from "./fields"
import type { ContentType } from "./registry"

// Built-in content in the stored shape ({ en, ur } for every localised field), keyed by entry id.
// It seeds the admin and is what the site shows until an entry is published. A type can ship Urdu
// with its defaults through `translations.ur` (same shape as the CMS data, plain strings), which
// fills the `ur` side of each localised value.

export const SINGLETON = "main"
type Data = Record<string, unknown>

const isLoc = (fd: Field) => fd.kind === "richText" || ((fd.kind === "text" || fd.kind === "textarea") && fd.localized !== false)

/** Adds Urdu from a plain overlay to stored values (localised fields only; lists by position). */
export function withUrdu(fields: Fields, stored: Data, ur: unknown): Data {
  if (!ur || typeof ur !== "object") return stored
  const overlay = ur as Data
  const one = (fd: Field, v: unknown, u: unknown): unknown => {
    if (u === undefined || u === null || v === undefined || v === null) return v
    if (isLoc(fd)) {
      const empty = typeof u === "string" ? !u.trim() : (u as RichDoc)?.content?.length === 0
      return empty ? v : { ...(v as object), ur: u }
    }
    if (fd.kind === "group") return withUrdu(fd.fields, v as Data, u)
    if (fd.kind === "list" && Array.isArray(v) && Array.isArray(u)) return v.map((x, i) => one(fd.of, x, u[i]))
    return v
  }
  const out: Data = { ...stored }
  for (const [k, fd] of Object.entries(fields)) if (k in out && k in overlay) out[k] = one(fd, out[k], overlay[k])
  return out
}

const memo = new Map<string, Map<string, Data>>()

/** Built-in content of a type in the stored (localised) shape, keyed by entry id. */
export function storedDefaults(t: ContentType<unknown, unknown>): Map<string, Data> {
  const hit = memo.get(t.type)
  if (hit) return hit
  const toStored = (d: unknown) => localizeObject(t.fields, (t.toCms ? t.toCms(d) : d) as Data)
  const ur = t.translations?.ur?.()
  let out: Map<string, Data>
  if (t.kind === "singleton") {
    out = new Map([[SINGLETON, withUrdu(t.fields, toStored(t.defaults()), ur)]])
  } else {
    const byId = (ur ?? {}) as Record<string, unknown>
    out = new Map(
      (t.defaults() as unknown[]).map((d) => {
        const id = t.idOf!(d)
        return [id, withUrdu(t.fields, toStored(d), byId[id])]
      }),
    )
  }
  memo.set(t.type, out)
  return out
}

/**
 * Saved entries keep the shipped Urdu where they haven't changed the English: a value with no Urdu
 * whose English still matches the built-in text takes the built-in Urdu. (Entries saved before Urdu
 * shipped would otherwise hide it.)
 */
export function withDefaultUrdu(fields: Fields, data: Data, def: Data | undefined): Data {
  if (!def) return data
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const one = (fd: Field, v: unknown, d: unknown): unknown => {
    if (v === undefined || v === null || d === undefined || d === null) return v
    if (isLoc(fd)) {
      const sv = v as { en?: unknown; ur?: unknown }
      const dv = d as { en?: unknown; ur?: unknown }
      const empty = (u: unknown) => u === undefined || u === "" || (typeof u === "object" && u !== null && (u as RichDoc).content?.length === 0)
      return empty(sv.ur) && !empty(dv.ur) && same(sv.en, dv.en) ? { ...(v as object), ur: dv.ur } : v
    }
    if (fd.kind === "group") return withDefaultUrdu(fd.fields, v as Data, d as Data)
    if (fd.kind === "list" && Array.isArray(v) && Array.isArray(d)) return v.map((x, i) => one(fd.of, x, d[i]))
    return v
  }
  const out: Data = { ...data }
  for (const [k, fd] of Object.entries(fields)) if (k in out) out[k] = one(fd, out[k], def[k])
  return out
}
