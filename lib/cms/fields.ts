import { z } from "zod"

// The CMS schema DSL. A content type is a set of fields declared once; from that one declaration
// we derive validation (zod), the admin form, default values and the read-side resolution.
//
// Storage shape vs site shape:
// - Localised fields are stored as { en, ur?, ai? } (ai = the Urdu was machine-translated and
//   has not been reviewed yet). The site always receives plain strings for one locale.
// - Text may contain {{tokens}} (e.g. {{policy.freeChangeHours}}) that are filled in on read.

import { LOCALES, type Locale } from "@/lib/i18n"

export { LOCALES, type Locale }
export type Localized<T = string> = { en: T; ur?: T; ai?: boolean }

type Common = { label: string; help?: string; required?: boolean; width?: "full" | "half" | "third"; perm?: "prices" | "settings" }

export type TextField = Common & { kind: "text" | "textarea"; localized?: boolean; max?: number; placeholder?: string; mono?: boolean }
export type RichTextField = Common & { kind: "richText" }
export type NumberField = Common & { kind: "number"; min?: number; max?: number; step?: number; unit?: string }
export type PriceField = Common & { kind: "price" }
export type BooleanField = Common & { kind: "boolean" }
export type SelectField = Common & { kind: "select"; options: { value: string; label: string }[] }
export type IconField = Common & { kind: "icon" }
export type ColorField = Common & { kind: "color" }
export type SlugField = Common & { kind: "slug" }
export type DateField = Common & { kind: "date" }
/** A media-library item: an image (default), a video or a 3D model, by `accept`. */
export type ImageField = Common & { kind: "image"; accept?: "image" | "video" | "model" }
export type RefField = Common & { kind: "ref"; to: string }
export type ListField = Common & { kind: "list"; of: Field; itemLabel?: string; min?: number; max?: number }
export type GroupField = Common & { kind: "group"; fields: Fields }
export type Field =
  | TextField
  | RichTextField
  | NumberField
  | PriceField
  | BooleanField
  | SelectField
  | IconField
  | ColorField
  | SlugField
  | DateField
  | ImageField
  | RefField
  | ListField
  | GroupField
export type Fields = Record<string, Field>

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

type Opt<F> = Omit<F, "kind" | "label">
export const f = {
  text: (label: string, o: Opt<TextField> = {}): TextField => ({ kind: "text", label, ...o }),
  textarea: (label: string, o: Opt<TextField> = {}): TextField => ({ kind: "textarea", label, ...o }),
  /** A plain (not translated) string: slugs, URLs, phone numbers, codes. */
  code: (label: string, o: Opt<TextField> = {}): TextField => ({ kind: "text", label, localized: false, mono: true, ...o }),
  richText: (label: string, o: Opt<RichTextField> = {}): RichTextField => ({ kind: "richText", label, ...o }),
  number: (label: string, o: Opt<NumberField> = {}): NumberField => ({ kind: "number", label, ...o }),
  price: (label: string, o: Opt<PriceField> = {}): PriceField => ({ kind: "price", label, perm: "prices", ...o }),
  boolean: (label: string, o: Opt<BooleanField> = {}): BooleanField => ({ kind: "boolean", label, ...o }),
  select: (label: string, options: (string | { value: string; label: string })[], o: Omit<Opt<SelectField>, "options"> = {}): SelectField => ({
    kind: "select",
    label,
    options: options.map((x) => (typeof x === "string" ? { value: x, label: x } : x)),
    ...o,
  }),
  icon: (label: string, o: Opt<IconField> = {}): IconField => ({ kind: "icon", label, ...o }),
  color: (label: string, o: Opt<ColorField> = {}): ColorField => ({ kind: "color", label, ...o }),
  slug: (label = "Slug", o: Opt<SlugField> = {}): SlugField => ({ kind: "slug", label, ...o }),
  date: (label: string, o: Opt<DateField> = {}): DateField => ({ kind: "date", label, ...o }),
  image: (label: string, o: Opt<ImageField> = {}): ImageField => ({ kind: "image", label, ...o }),
  video: (label: string, o: Omit<Opt<ImageField>, "accept"> = {}): ImageField => ({ kind: "image", label, accept: "video", ...o }),
  model: (label: string, o: Omit<Opt<ImageField>, "accept"> = {}): ImageField => ({ kind: "image", label, accept: "model", ...o }),
  ref: (label: string, to: string, o: Omit<Opt<RefField>, "to"> = {}): RefField => ({ kind: "ref", label, to, ...o }),
  list: (label: string, of: Field, o: Omit<Opt<ListField>, "of"> = {}): ListField => ({ kind: "list", label, of, ...o }),
  group: (label: string, fields: Fields, o: Omit<Opt<GroupField>, "fields"> = {}): GroupField => ({ kind: "group", label, fields, ...o }),
}

export const isLocalized = (fd: Field) => fd.kind === "richText" || ((fd.kind === "text" || fd.kind === "textarea") && fd.localized !== false)

// ---------------------------------------------------------------------------
// Rich text: a small TipTap-compatible JSON document
// ---------------------------------------------------------------------------

export type RichMark = { type: "bold" | "italic" | "link"; attrs?: { href?: string } }
export type RichNode = { type: string; text?: string; marks?: RichMark[]; attrs?: Record<string, unknown>; content?: RichNode[] }
export type RichDoc = { type: "doc"; content: RichNode[] }
export const emptyDoc = (): RichDoc => ({ type: "doc", content: [] })

/** Build a document from headings and paragraphs (built-in content). Blank lines split paragraphs. */
export function docFrom(blocks: { h?: string; p: string }[]): RichDoc {
  return {
    type: "doc",
    content: blocks.flatMap((b) => [
      ...(b.h ? [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: b.h }] }] : []),
      ...b.p.split(/\n{2,}/).map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
    ]),
  }
}

const richNode: z.ZodType<RichNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    marks: z.array(z.object({ type: z.enum(["bold", "italic", "link"]), attrs: z.object({ href: z.string().optional() }).passthrough().optional() })).optional(),
    attrs: z.record(z.unknown()).optional(),
    content: z.array(richNode).optional(),
  }),
)
const richDoc = z.object({ type: z.literal("doc"), content: z.array(richNode) })

/** Plain text of a rich document (search, SEO checks, previews). */
export function richToText(doc: RichDoc | undefined): string {
  const walk = (n: RichNode): string => (n.text ?? "") + (n.content ?? []).map(walk).join(n.type === "doc" ? "\n" : "")
  return doc ? doc.content.map(walk).join("\n").trim() : ""
}

// ---------------------------------------------------------------------------
// Validation of the stored shape
// ---------------------------------------------------------------------------

const localized = <T extends z.ZodTypeAny>(inner: T) => z.object({ en: inner, ur: inner.optional(), ai: z.boolean().optional() })

export function zodFor(fd: Field): z.ZodTypeAny {
  let s: z.ZodTypeAny
  switch (fd.kind) {
    case "text":
    case "textarea": {
      const str = fd.max ? z.string().max(fd.max * 2) : z.string() // soft limit is a warning in the form; hard limit is generous
      s = fd.localized === false ? str : localized(str)
      break
    }
    case "richText":
      s = localized(richDoc)
      break
    case "number":
    case "price":
      s = z.number().finite()
      break
    case "boolean":
      s = z.boolean()
      break
    case "select":
      s = z.enum(fd.options.map((o) => o.value) as [string, ...string[]])
      break
    case "color":
      s = z.string().regex(/^#[0-9a-fA-F]{6}$/)
      break
    case "slug":
      s = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
      break
    case "date":
      s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
      break
    case "icon":
    case "ref":
      s = z.string()
      break
    case "image":
      s = z.object({ id: z.string(), url: z.string(), alt: localized(z.string()).optional(), w: z.number().optional(), h: z.number().optional(), focal: z.tuple([z.number(), z.number()]).optional() }).nullable()
      break
    case "list": {
      let arr = z.array(zodFor(fd.of))
      if (fd.min) arr = arr.min(fd.min)
      if (fd.max) arr = arr.max(fd.max)
      s = arr
      break
    }
    case "group":
      s = zodObject(fd.fields)
      break
  }
  return fd.required ? s : s.optional()
}

export const zodObject = (fields: Fields) => z.object(Object.fromEntries(Object.entries(fields).map(([k, fd]) => [k, zodFor(fd)])))

// ---------------------------------------------------------------------------
// Plain site value -> stored value (seeding and editing defaults)
// ---------------------------------------------------------------------------

export function localizeValue(fd: Field, v: unknown): unknown {
  if (v === undefined || v === null) return v
  if (isLocalized(fd)) {
    if (typeof v === "object" && v && "en" in (v as object)) return v // already stored shape
    return { en: v }
  }
  if (fd.kind === "list") return Array.isArray(v) ? v.map((x) => localizeValue(fd.of, x)) : []
  if (fd.kind === "group") return localizeObject(fd.fields, v as Record<string, unknown>)
  return v
}

export function localizeObject(fields: Fields, v: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(v ?? {}) }
  for (const [k, fd] of Object.entries(fields)) if (k in out) out[k] = localizeValue(fd, out[k])
  return out
}

// ---------------------------------------------------------------------------
// Stored value -> plain site value for one locale (with tokens filled in)
// ---------------------------------------------------------------------------

export type TokenContext = Record<string, unknown>

/** Fills {{path.to.value}} from the context. Unknown tokens are left as they are, so mistakes stay visible. */
export function renderTokens(s: string, ctx: TokenContext | undefined): string {
  if (!ctx || !s.includes("{{")) return s
  return s.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (m, path: string) => {
    const v = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ctx)
    return typeof v === "string" || typeof v === "number" ? String(v) : m
  })
}

/** Fills {{tokens}} in every string of a plain value (built-in content that never went through the CMS). */
export function tokensDeep<T>(v: T, ctx: TokenContext | undefined): T {
  if (!ctx) return v
  if (typeof v === "string") return renderTokens(v, ctx) as T
  if (Array.isArray(v)) return v.map((x) => tokensDeep(x, ctx)) as T
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tokensDeep(x, ctx)])) as T
  return v
}

function pick<T>(v: Localized<T> | T, locale: Locale): T {
  if (v && typeof v === "object" && "en" in (v as object)) {
    const l = v as Localized<T>
    const ur = l.ur
    return locale === "ur" && ur !== undefined && ur !== "" && !(typeof ur === "object" && (ur as unknown as RichDoc).content?.length === 0) ? ur : l.en
  }
  return v as T
}

function tokensInDoc(doc: RichDoc, ctx?: TokenContext): RichDoc {
  if (!ctx) return doc
  const walk = (n: RichNode): RichNode => ({ ...n, ...(n.text !== undefined ? { text: renderTokens(n.text, ctx) } : {}), ...(n.content ? { content: n.content.map(walk) } : {}) })
  return { ...doc, content: doc.content.map(walk) }
}

export function resolveValue(fd: Field, v: unknown, locale: Locale, ctx?: TokenContext): unknown {
  if (v === undefined || v === null) return v
  switch (fd.kind) {
    case "text":
    case "textarea": {
      const s = fd.localized === false ? (v as string) : pick(v as Localized, locale)
      return typeof s === "string" ? renderTokens(s, ctx) : s
    }
    case "richText":
      return tokensInDoc(pick(v as Localized<RichDoc>, locale), ctx)
    case "image": {
      const img = v as { alt?: Localized } & Record<string, unknown>
      return { ...img, alt: img.alt ? pick(img.alt, locale) : "" }
    }
    case "list":
      return Array.isArray(v) ? v.map((x) => resolveValue(fd.of, x, locale, ctx)) : []
    case "group":
      return resolveObject(fd.fields, v as Record<string, unknown>, locale, ctx)
    default:
      return v
  }
}

export function resolveObject(fields: Fields, v: Record<string, unknown>, locale: Locale, ctx?: TokenContext): Record<string, unknown> {
  const out: Record<string, unknown> = { ...v }
  for (const [k, fd] of Object.entries(fields)) if (k in out) out[k] = resolveValue(fd, out[k], locale, ctx)
  return out
}

// ---------------------------------------------------------------------------
// Media: stored references -> the current file, for the site
// ---------------------------------------------------------------------------

/** How an image field is stored: the media id (plus the URL as a fallback) and an optional alt override. */
export type MediaRef = { id: string; url: string; alt?: Localized; w?: number; h?: number; focal?: [number, number] }
/** What the site receives for an image field. */
export type Img = { id: string; url: string; alt: string; w?: number; h?: number; focal?: [number, number]; color?: string; mime?: string } | null
/** A media-library row, as much of it as the site needs. */
export type MediaInfo = { url: string; mime: string; width: number | null; height: number | null; alt: Localized | null; focal: [number, number] | null; color: string | null }

export const hasMediaFields = (fields: Fields): boolean =>
  Object.values(fields).some((fd) => fd.kind === "image" || (fd.kind === "group" && hasMediaFields(fd.fields)) || (fd.kind === "list" && (fd.of.kind === "image" || (fd.of.kind === "group" && hasMediaFields(fd.of.fields)))))

/**
 * Replaces resolved image values with the media library's current file, size, focal point and alt
 * text (a field's own alt text wins). Items missing from the library are dropped; when the library
 * couldn't be read at all (media = null) the stored URL is kept.
 */
export function hydrateMedia(fields: Fields, v: Record<string, unknown>, media: Record<string, MediaInfo> | null, locale: Locale): Record<string, unknown> {
  const one = (fd: Field, x: unknown): unknown => {
    if (x === undefined || x === null) return x
    if (fd.kind === "image") {
      const ref = x as { id?: string; url?: string; alt?: string }
      if (!ref.id) return null
      if (!media) return { ...ref, alt: ref.alt ?? "" }
      const m = media[ref.id]
      if (!m) return null
      const alt = ref.alt || (m.alt ? pick(m.alt, locale) : "") || ""
      return { id: ref.id, url: m.url, alt, mime: m.mime, ...(m.width ? { w: m.width } : {}), ...(m.height ? { h: m.height } : {}), ...(m.focal ? { focal: m.focal } : {}), ...(m.color ? { color: m.color } : {}) }
    }
    if (fd.kind === "list") return Array.isArray(x) ? x.map((y) => one(fd.of, y)).filter((y) => !(fd.of.kind === "image" && y === null)) : x
    if (fd.kind === "group") return hydrateMedia(fd.fields, x as Record<string, unknown>, media, locale)
    return x
  }
  const out: Record<string, unknown> = { ...v }
  for (const [k, fd] of Object.entries(fields)) if (k in out) out[k] = one(fd, out[k])
  return out
}

// ---------------------------------------------------------------------------
// Translation coverage (admin): how many localised values have an Urdu version
// ---------------------------------------------------------------------------

export function coverage(fields: Fields, v: Record<string, unknown> | undefined): { total: number; done: number; ai: number } {
  const acc = { total: 0, done: 0, ai: 0 }
  const visit = (fd: Field, x: unknown) => {
    if (x === undefined || x === null) return
    if (isLocalized(fd)) {
      const l = x as Localized<unknown>
      const empty = (y: unknown) => y === undefined || y === "" || (typeof y === "object" && y !== null && (y as RichDoc).content?.length === 0)
      if (empty(l.en)) return
      acc.total++
      if (!empty(l.ur)) {
        acc.done++
        if (l.ai) acc.ai++
      }
    } else if (fd.kind === "list" && Array.isArray(x)) x.forEach((y) => visit(fd.of, y))
    else if (fd.kind === "group") Object.entries(fd.fields).forEach(([k, sub]) => visit(sub, (x as Record<string, unknown>)[k]))
  }
  Object.entries(fields).forEach(([k, fd]) => visit(fd, v?.[k]))
  return acc
}

/** Marks every AI translation in an entry as reviewed (the flag on localised { en, ur, ai } values only). */
export function approveAll(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(approveAll)
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("en" in o && "ai" in o) {
      const { ai, ...rest } = o
      return rest
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, approveAll(x)]))
  }
  return v
}
