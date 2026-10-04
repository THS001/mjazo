import { blockFields, isLocalized, richToText, type Field, type Fields, type Localized, type RichDoc } from "./fields"

// Click-to-edit in the live preview: from what was clicked on the page (the nearest data-cms path,
// if any, and the element's text), find the field that holds that text. Pages built from blocks mark
// every block (and their main texts); designed pages are matched on the text alone.

export type Leaf = { path: string; text: string }

/** Every text an editor can change in an entry, with its path ("blocks.2.title"), as the site shows it in `lang`. */
export function textLeaves(fields: Fields, data: Record<string, unknown> | undefined, lang: "en" | "ur"): Leaf[] {
  const out: Leaf[] = []
  const pick = (v: unknown): unknown => {
    const l = v as Localized<unknown>
    const ur = l?.ur
    const hasUr = typeof ur === "string" ? ur.trim() !== "" : Boolean((ur as RichDoc | undefined)?.content?.length)
    return lang === "ur" && hasUr ? ur : l?.en
  }
  const visit = (fd: Field, v: unknown, path: string) => {
    if (v === undefined || v === null) return
    if (isLocalized(fd)) {
      const x = pick(v)
      const text = fd.kind === "richText" ? richToText(x as RichDoc) : typeof x === "string" ? x : ""
      if (text.trim()) out.push({ path, text })
    } else if (fd.kind === "group") Object.entries(fd.fields).forEach(([k, sub]) => visit(sub, (v as Record<string, unknown>)[k], `${path}.${k}`))
    else if (fd.kind === "list" && Array.isArray(v)) v.forEach((x, i) => visit(fd.of, x, `${path}.${i}`))
    else if (fd.kind === "blocks" && Array.isArray(v)) v.forEach((x, i) => Object.entries(blockFields(fd, x) ?? {}).forEach(([k, sub]) => visit(sub, (x as Record<string, unknown>)[k], `${path}.${i}.${k}`)))
  }
  Object.entries(fields).forEach(([k, fd]) => visit(fd, data?.[k], k))
  return out
}

/** Text as it reads on the page: no accent marks, single spaces, any case. */
const norm = (s: string) => s.replace(/\*([^*]+)\*/g, "$1").replace(/\s+/g, " ").trim().toLowerCase()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** How well a stored value matches the clicked text (0 = not at all). {{tokens}} match whatever the page filled in. */
export function matchScore(value: string, clicked: string): number {
  const v = norm(value)
  const c = norm(clicked)
  if (!v || !c) return 0
  if (v.includes("{{")) {
    const re = v
      .split(/\{\{\s*[a-z0-9_.]+\s*\}\}/i)
      .map(escape)
      .join(".{0,80}?")
    if (new RegExp(`^${re}$`).test(c)) return 100
    if (c.length >= 4 && new RegExp(re).test(c)) return 55
    const literal = v.replace(/\{\{[^}]*\}\}/g, " ").replace(/\s+/g, " ").trim()
    return literal.length >= 6 && c.length >= 4 && literal.includes(c) ? 65 : 0
  }
  if (v === c) return 100
  // The click landed on part of a longer value (one paragraph of a text block, one line of an answer).
  if (c.length >= 4 && v.includes(c)) return 70 + Math.min(20, (c.length / v.length) * 20)
  // The clicked element holds the value and more (a card around its title).
  if (v.length >= 3 && c.includes(v)) return 40 + Math.min(20, (v.length / c.length) * 20)
  return 0
}

/**
 * The field to open for a click in the preview. A data-cms path that is itself a field wins; inside a
 * marked block, the best text match within that block; otherwise the best match anywhere. Falls back
 * to the marked block itself, or null when nothing matches.
 */
export function findField(fields: Fields, data: Record<string, unknown> | undefined, clicked: { path?: string | null; text: string }, lang: "en" | "ur" = "en"): string | null {
  const leaves = textLeaves(fields, data, lang)
  const at = clicked.path || null
  if (at && leaves.some((l) => l.path === at)) return at
  const within = at ? leaves.filter((l) => l.path.startsWith(`${at}.`)) : leaves
  let best: { path: string; score: number } | null = null
  for (const l of within) {
    const score = matchScore(l.text, clicked.text)
    if (score > (best?.score ?? 0)) best = { path: l.path, score }
  }
  return best?.path ?? at
}
