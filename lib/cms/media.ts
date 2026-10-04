import "server-only"
import { promises as fs } from "fs"
import path from "path"
import { db } from "@/lib/server/store"
import type { Localized } from "./fields"
import { addAudit, allRows } from "./store"

// The media library: images, video, 3D models (GLB) and PDFs.
// - Supabase: files in the public `media` bucket, rows in cms_media (migration 0004). Browsers
//   upload straight to Storage with a signed URL, so large files never pass through a function.
// - Local development: files in .data/media, rows in .data/cms/media.json, served by
//   /api/cms/media/file/... (never on Vercel).
// Content stores a media item's id; the site looks up the current file on every read, so
// replacing a file or editing its alt text updates every page that uses it.

export type MediaKind = "image" | "video" | "model" | "file"
export type MediaRow = {
  id: string
  path: string
  url: string
  kind: MediaKind
  mime: string
  size: number
  width: number | null
  height: number | null
  alt: Localized | null
  focal: [number, number] | null
  color: string | null
  tags: string[]
  uploaded_by: string | null
  created_at: string
}
type Actor = { id: string; name: string }

const MB = 1024 * 1024
export const MEDIA_TYPES: Record<string, { kind: MediaKind; ext: string; max: number }> = {
  "image/jpeg": { kind: "image", ext: "jpg", max: 10 * MB },
  "image/png": { kind: "image", ext: "png", max: 10 * MB },
  "image/webp": { kind: "image", ext: "webp", max: 10 * MB },
  "image/avif": { kind: "image", ext: "avif", max: 10 * MB },
  "image/gif": { kind: "image", ext: "gif", max: 10 * MB },
  "video/mp4": { kind: "video", ext: "mp4", max: 50 * MB },
  "video/webm": { kind: "video", ext: "webm", max: 50 * MB },
  "model/gltf-binary": { kind: "model", ext: "glb", max: 25 * MB },
  "application/pdf": { kind: "file", ext: "pdf", max: 10 * MB },
}
const BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif", mp4: "video/mp4", webm: "video/webm", glb: "model/gltf-binary", pdf: "application/pdf" }

export class MediaError extends Error {}

/** The real type of an upload: browsers often send "" or octet-stream for .glb files. SVG is never accepted. */
export function mediaType(name: string, mime: string) {
  const ext = name.toLowerCase().split(".").pop() ?? ""
  const m = MEDIA_TYPES[mime] ? mime : BY_EXT[ext]
  if (!m || ext === "svg" || /svg/.test(mime)) throw new MediaError("That file type isn't supported. Use JPG, PNG, WebP, AVIF, GIF, MP4, WebM, GLB or PDF.")
  return { mime: m, ...MEDIA_TYPES[m] }
}

/** Checks a file's first bytes match its claimed type (a renamed .exe is not an image). */
export function sniff(bytes: Uint8Array, mime: string): boolean {
  const at = (o: number, s: string) => [...s].every((c, i) => bytes[o + i] === c.charCodeAt(0))
  const hex = (o: number, h: number[]) => h.every((b, i) => bytes[o + i] === b)
  switch (mime) {
    case "image/jpeg":
      return hex(0, [0xff, 0xd8, 0xff])
    case "image/png":
      return hex(0, [0x89, 0x50, 0x4e, 0x47])
    case "image/gif":
      return at(0, "GIF8")
    case "image/webp":
      return at(0, "RIFF") && at(8, "WEBP")
    case "image/avif":
      return at(4, "ftyp") && (at(8, "avif") || at(8, "avis") || at(8, "mif1"))
    case "video/mp4":
      return at(4, "ftyp")
    case "video/webm":
      return hex(0, [0x1a, 0x45, 0xdf, 0xa3])
    case "model/gltf-binary":
      return at(0, "glTF")
    case "application/pdf":
      return at(0, "%PDF")
    default:
      return false
  }
}

const safeName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "file"
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
export const mediaName = (p: string) => p.split("/").pop()!.replace(/^[a-z0-9]+-/, "")

// ---------------------------------------------------------------------------
// Local fallback
// ---------------------------------------------------------------------------

const LOCAL_DIR = path.join(process.cwd(), ".data", "media")
const LOCAL_DB = path.join(process.cwd(), ".data", "cms", "media.json")
let chain: Promise<unknown> = Promise.resolve()
const local = <T>(fn: (rows: MediaRow[]) => T | Promise<T>, write = false): Promise<T> => {
  const run = chain.then(async () => {
    let rows: MediaRow[] = []
    try {
      rows = JSON.parse(await fs.readFile(LOCAL_DB, "utf8"))
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
    }
    const out = await fn(rows)
    if (write) {
      await fs.mkdir(path.dirname(LOCAL_DB), { recursive: true })
      await fs.writeFile(LOCAL_DB, JSON.stringify(rows))
    }
    return out
  })
  chain = run.catch(() => {})
  return run
}
const localFile = (p: string) => {
  const full = path.resolve(LOCAL_DIR, p)
  if (!full.startsWith(LOCAL_DIR + path.sep)) throw new MediaError("Bad path")
  return full
}
export const localUrl = (p: string) => `/api/cms/media/file/${p}`
const usesLocal = () => !db && !process.env.VERCEL

export async function readLocalFile(p: string) {
  if (!usesLocal()) return null
  try {
    return await fs.readFile(localFile(p))
  } catch {
    return null
  }
}

export async function writeLocalFile(p: string, bytes: Uint8Array, mime: string) {
  if (!usesLocal()) throw new MediaError("Local uploads only work in development.")
  if (!sniff(bytes, mime)) throw new MediaError("The file's contents don't match its type.")
  const full = localFile(p)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, bytes)
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function listMedia(): Promise<MediaRow[]> {
  if (db) {
    const { data, error } = await db.from("cms_media").select("*").order("created_at", { ascending: false }).limit(2000)
    if (error) throw error
    return data as MediaRow[]
  }
  if (process.env.VERCEL) return []
  return local((rows) => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)))
}

export async function getMedia(id: string): Promise<MediaRow | null> {
  if (db) {
    const { data, error } = await db.from("cms_media").select("*").eq("id", id).maybeSingle()
    if (error) throw error
    return (data as MediaRow) ?? null
  }
  return local((rows) => rows.find((r) => r.id === id) ?? null)
}

/** Entries (draft or live) that use a media item. */
export async function mediaUsage(id: string): Promise<{ type: string; id: string; where: "live" | "draft" | "both" }[]> {
  const needle = `"id":"${id}"`
  const out: { type: string; id: string; where: "live" | "draft" | "both" }[] = []
  for (const r of await allRows()) {
    const live = r.published ? JSON.stringify(r.published).includes(needle) : false
    const draft = r.draft ? JSON.stringify(r.draft).includes(needle) : false
    if (live || draft) out.push({ type: r.type, id: r.id, where: live && draft ? "both" : live ? "live" : "draft" })
  }
  return out
}

// ---------------------------------------------------------------------------
// Uploading
// ---------------------------------------------------------------------------

export type Prepared = { id: string; path: string; mime: string } & ({ mode: "supabase"; token: string } | { mode: "local"; url: string })

/** Step 1: check the file and reserve a place for it. The browser then uploads the bytes itself. */
export async function prepareUpload(file: { name: string; mime: string; size: number }): Promise<Prepared> {
  const t = mediaType(file.name, file.mime)
  if (file.size > t.max) throw new MediaError(`That file is ${(file.size / MB).toFixed(1)} MB; the limit for this type is ${t.max / MB} MB.`)
  if (file.size <= 0) throw new MediaError("That file is empty.")
  const id = newId()
  const d = new Date()
  const p = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${id}-${safeName(file.name)}.${t.ext}`
  if (db) {
    const { data, error } = await db.storage.from("media").createSignedUploadUrl(p)
    if (error || !data) throw new MediaError(`Storage refused the upload: ${error?.message ?? "no URL"}. Is the media bucket set up (migration 0004)?`)
    return { id, path: p, mime: t.mime, mode: "supabase", token: data.token }
  }
  if (process.env.VERCEL) throw new MediaError("Uploads need Supabase on the live site.")
  return { id, path: p, mime: t.mime, mode: "local", url: `/api/cms/media/upload?path=${encodeURIComponent(p)}&mime=${encodeURIComponent(t.mime)}` }
}

const publicUrl = (p: string) => (db ? db.storage.from("media").getPublicUrl(p).data.publicUrl : localUrl(p))

/** Confirms the uploaded object exists and has the right kind of contents (first bytes). */
async function verifyStored(p: string, mime: string) {
  if (!db) {
    const bytes = await readLocalFile(p)
    if (!bytes) throw new MediaError("The upload didn't arrive. Please try again.")
    return bytes.length
  }
  const res = await fetch(publicUrl(p), { headers: { Range: "bytes=0-31" }, cache: "no-store" })
  if (!res.ok && res.status !== 206) throw new MediaError("The upload didn't arrive. Please try again.")
  const head = new Uint8Array(await res.arrayBuffer())
  if (!sniff(head, mime)) {
    await db.storage.from("media").remove([p])
    throw new MediaError("The file's contents don't match its type, so it was removed.")
  }
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0)
  return total
}

type Meta = { width?: number | null; height?: number | null; color?: string | null }
const cleanMeta = (m: Meta) => ({
  width: m.width && m.width > 0 ? Math.round(m.width) : null,
  height: m.height && m.height > 0 ? Math.round(m.height) : null,
  color: m.color && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : null,
})

/** Step 2: record an uploaded file in the library. */
export async function finishUpload(user: Actor, up: { id: string; path: string; mime: string } & Meta): Promise<MediaRow> {
  const t = mediaType(up.path, up.mime)
  if (!/^\d{4}\/\d{2}\/[a-z0-9]+-[a-z0-9-]+\.[a-z0-9]+$/.test(up.path) || !up.path.includes(`/${up.id}-`)) throw new MediaError("Bad upload reference.")
  const size = await verifyStored(up.path, t.mime)
  const row: MediaRow = {
    id: up.id,
    path: up.path,
    url: publicUrl(up.path),
    kind: t.kind,
    mime: t.mime,
    size,
    ...cleanMeta(up),
    alt: null,
    focal: null,
    tags: [],
    uploaded_by: user.name,
    created_at: new Date().toISOString(),
  }
  if (db) {
    const { data, error } = await db.from("cms_media").insert(row).select().single()
    if (error) throw error
    await audit(user, "uploaded", row)
    return data as MediaRow
  }
  await local((rows) => {
    rows.push(row)
  }, true)
  await audit(user, "uploaded", row)
  return row
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

export type MediaPatch = { alt?: Localized | null; focal?: [number, number] | null; tags?: string[] }
const cleanPatch = (p: MediaPatch): MediaPatch => ({
  ...(p.alt !== undefined ? { alt: p.alt ? { en: String(p.alt.en ?? "").slice(0, 300), ...(p.alt.ur ? { ur: String(p.alt.ur).slice(0, 300) } : {}), ...(p.alt.ai ? { ai: true } : {}) } : null } : {}),
  ...(p.focal !== undefined ? { focal: p.focal ? [Math.min(1, Math.max(0, Number(p.focal[0]) || 0.5)), Math.min(1, Math.max(0, Number(p.focal[1]) || 0.5))] : null } : {}),
  ...(p.tags !== undefined ? { tags: [...new Set(p.tags.map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 20) } : {}),
})

export async function updateMedia(user: Actor, id: string, patch: MediaPatch): Promise<MediaRow> {
  const p = cleanPatch(patch)
  let row: MediaRow | null
  if (db) {
    const { data, error } = await db.from("cms_media").update(p).eq("id", id).select().maybeSingle()
    if (error) throw error
    row = data as MediaRow | null
  } else {
    row = await local((rows) => {
      const r = rows.find((x) => x.id === id)
      if (r) Object.assign(r, p)
      return r ?? null
    }, true)
  }
  if (!row) throw new MediaError("That file no longer exists.")
  await audit(user, "edited", row, Object.keys(p).join(", "))
  return row
}

/** Swap the file behind a media item (same id, so every page using it gets the new file). */
export async function replaceMedia(user: Actor, id: string, up: { path: string; mime: string } & Meta): Promise<MediaRow> {
  const cur = await getMedia(id)
  if (!cur) throw new MediaError("That file no longer exists.")
  const t = mediaType(up.path, up.mime)
  if (t.kind !== cur.kind) throw new MediaError(`Replace a ${cur.kind} with another ${cur.kind}.`)
  if (!/^\d{4}\/\d{2}\/[a-z0-9]+-[a-z0-9-]+\.[a-z0-9]+$/.test(up.path)) throw new MediaError("Bad upload reference.")
  const size = await verifyStored(up.path, t.mime)
  const patch = { path: up.path, url: publicUrl(up.path), mime: t.mime, size, ...cleanMeta(up) }
  let row: MediaRow | null
  if (db) {
    const { data, error } = await db.from("cms_media").update(patch).eq("id", id).select().single()
    if (error) throw error
    row = data as MediaRow
    await db.storage.from("media").remove([cur.path])
  } else {
    row = await local((rows) => {
      const r = rows.find((x) => x.id === id)
      if (r) Object.assign(r, patch)
      return r ?? null
    }, true)
    await fs.rm(localFile(cur.path), { force: true })
  }
  await audit(user, "replaced", row!)
  return row!
}

export async function deleteMedia(user: Actor, id: string) {
  const cur = await getMedia(id)
  if (!cur) return
  const used = await mediaUsage(id)
  if (used.length) throw new MediaError(`It's used in ${used.length} place${used.length > 1 ? "s" : ""}. Remove it from ${used.length > 1 ? "them" : "there"} first.`)
  if (db) {
    const { error } = await db.from("cms_media").delete().eq("id", id)
    if (error) throw error
    await db.storage.from("media").remove([cur.path])
  } else {
    await local((rows) => {
      const i = rows.findIndex((r) => r.id === id)
      if (i >= 0) rows.splice(i, 1)
    }, true)
    await fs.rm(localFile(cur.path), { force: true })
  }
  await audit(user, "deleted", cur)
}

/** The bytes of an image, for the AI alt-text suggestion (vision models take base64). */
export async function mediaBytes(row: MediaRow): Promise<Buffer | null> {
  if (!db) return readLocalFile(row.path)
  const res = await fetch(row.url, { cache: "no-store" })
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null
}

const audit = (user: Actor, action: string, row: MediaRow, detail?: string) =>
  addAudit({ user_id: user.id, user_name: user.name, action, type: "media", entry_id: row.id, title: mediaName(row.path), detail: detail ?? null })
