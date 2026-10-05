import { blockFields, isLocalized, richToText, type Field, type Fields, type Localized, type RichDoc } from "./fields"

// Comparing two versions of an entry for the history panel: every field that differs, labelled
// the way the form labels it ("Blocks › Hero #1 › Title"), with English and Urdu shown separately,
// and a word-level diff to highlight what changed. Pure functions (diff.test.ts).

export type Change = { path: string; label: string; kind: "changed" | "added" | "removed"; lang?: "en" | "ur"; before?: string; after?: string }
type Data = Record<string, unknown>

const fileName = (url: unknown) => (typeof url === "string" ? decodeURIComponent(url.split("/").pop() ?? "").replace(/^[a-z0-9]+-/, "") : "")
const textOf = (fd: Field, v: unknown): string => {
  if (v === undefined || v === null || v === "") return ""
  switch (fd.kind) {
    case "richText":
      return richToText(v as RichDoc)
    case "boolean":
      return v ? "On" : "Off"
    case "price":
      return `PKR ${Number(v).toLocaleString("en-PK")}`
    case "select":
      return fd.options.find((o) => o.value === v)?.label ?? String(v)
    case "image":
      return fileName((v as { url?: string }).url) || "an image"
    default:
      return typeof v === "object" ? JSON.stringify(v) : String(v)
  }
}

/** A short name for a list item or block, from its first text. */
function itemName(fd: Field, v: unknown): string {
  if (fd.kind !== "group" || !v || typeof v !== "object") return textOf(fd, isLocalized(fd) ? (v as Localized<unknown>)?.en : v)
  for (const [k, sub] of Object.entries(fd.fields)) {
    if (sub.kind !== "text" && sub.kind !== "textarea") continue
    const x = (v as Data)[k]
    const s = typeof x === "string" ? x : (x as Localized | undefined)?.en
    if (s?.trim()) return s.trim().slice(0, 60)
  }
  return ""
}

export function diffData(fields: Fields, before: Data | null | undefined, after: Data | null | undefined): Change[] {
  const out: Change[] = []
  const visit = (fd: Field, a: unknown, b: unknown, path: string, label: string) => {
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) return
    if (isLocalized(fd)) {
      for (const lang of ["en", "ur"] as const) {
        const x = textOf(fd, (a as Localized<unknown> | undefined)?.[lang])
        const y = textOf(fd, (b as Localized<unknown> | undefined)?.[lang])
        if (x !== y) out.push({ path, label, lang, kind: !x ? "added" : !y ? "removed" : "changed", before: x || undefined, after: y || undefined })
      }
      return
    }
    if (fd.kind === "group") {
      for (const [k, sub] of Object.entries(fd.fields)) visit(sub, (a as Data | undefined)?.[k], (b as Data | undefined)?.[k], `${path}.${k}`, `${label} › ${sub.label}`)
      return
    }
    if (fd.kind === "list") {
      const xs = Array.isArray(a) ? a : []
      const ys = Array.isArray(b) ? b : []
      for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
        const name = `${label} › #${i + 1}`
        if (i >= xs.length) out.push({ path: `${path}.${i}`, label: name, kind: "added", after: itemName(fd.of, ys[i]) || undefined })
        else if (i >= ys.length) out.push({ path: `${path}.${i}`, label: name, kind: "removed", before: itemName(fd.of, xs[i]) || undefined })
        else visit(fd.of, xs[i], ys[i], `${path}.${i}`, name)
      }
      return
    }
    if (fd.kind === "blocks") {
      // Blocks keep their key when they move, so match them by key and report order separately.
      const xs = (Array.isArray(a) ? a : []) as Data[]
      const ys = (Array.isArray(b) ? b : []) as Data[]
      const name = (x: Data) => fd.blocks[String(x?._type)]?.label ?? "Block"
      const byKey = new Map(xs.map((x) => [x?._key, x]))
      ys.forEach((y, i) => {
        const x = byKey.get(y?._key)
        const at = `${label} › ${name(y)} #${i + 1}`
        if (!x || x._type !== y._type) out.push({ path: `${path}.${i}`, label: at, kind: "added", after: itemName({ kind: "group", label: "", fields: blockFields(fd, y) ?? {} }, y) || undefined })
        else Object.entries(blockFields(fd, y) ?? {}).forEach(([k, sub]) => visit(sub, x[k], y[k], `${path}.${i}.${k}`, `${at} › ${sub.label}`))
      })
      const kept = new Set(ys.map((y) => y?._key))
      xs.forEach((x, i) => {
        if (!kept.has(x?._key)) out.push({ path: `${path}.${i}`, label: `${label} › ${name(x)} #${i + 1}`, kind: "removed", before: itemName({ kind: "group", label: "", fields: blockFields(fd, x) ?? {} }, x) || undefined })
      })
      const order = (list: Data[]) => list.filter((x) => kept.has(x?._key) && byKey.has(x?._key)).map((x) => x._key)
      if (JSON.stringify(order(xs)) !== JSON.stringify(order(ys))) out.push({ path, label: `${label} › order`, kind: "changed", before: xs.map(name).join(", "), after: ys.map(name).join(", ") })
      return
    }
    const x = textOf(fd, a)
    const y = textOf(fd, b)
    if (x !== y) out.push({ path, label, kind: !x ? "added" : !y ? "removed" : "changed", before: x || undefined, after: y || undefined })
  }
  for (const [k, fd] of Object.entries(fields)) visit(fd, before?.[k], after?.[k], k, fd.label)
  return out
}

export type Piece = { text: string; kind: "same" | "del" | "ins" }

/** Word-by-word differences between two texts (longest common subsequence; whole-text swap for very long texts). */
export function wordDiff(a: string, b: string): Piece[] {
  const xs = a.split(/(\s+)/).filter(Boolean)
  const ys = b.split(/(\s+)/).filter(Boolean)
  if (xs.length * ys.length > 400_000) return [...(a ? [{ text: a, kind: "del" as const }] : []), ...(b ? [{ text: b, kind: "ins" as const }] : [])]
  const n = xs.length
  const m = ys.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = xs[i] === ys[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out: Piece[] = []
  const push = (text: string, kind: Piece["kind"]) => {
    const last = out[out.length - 1]
    if (last?.kind === kind) last.text += text
    else out.push({ text, kind })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (xs[i] === ys[j]) {
      push(xs[i], "same")
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push(xs[i++], "del")
    else push(ys[j++], "ins")
  }
  while (i < n) push(xs[i++], "del")
  while (j < m) push(ys[j++], "ins")
  return out
}
