import "server-only"
import { aiEnabled, MODELS } from "@/lib/ai/anthropic"
import { structured } from "@/lib/ai/structured"
import { ValidationError } from "./action"
import { isLocalized, type Field, type Fields, type Localized, type RichDoc, type RichNode } from "./fields"

// Machine translation of CMS content into Urdu. Every translated value is flagged `ai: true`, so the
// admin shows "AI translation, needs review" until a person edits or approves it.

type Path = (string | number)[]
type Item = { path: Path; text: string }
type Data = Record<string, unknown>

/** English strings that need Urdu: every localised value (mode "all") or only those without Urdu. */
export function collect(fields: Fields, data: Data, mode: "missing" | "all"): Item[] {
  const out: Item[] = []
  const visit = (fd: Field, v: unknown, path: Path) => {
    if (v === undefined || v === null) return
    if (isLocalized(fd)) {
      const l = v as Localized<unknown>
      if (fd.kind === "richText") {
        const en = l.en as RichDoc | undefined
        const hasUr = (l.ur as RichDoc | undefined)?.content?.length
        if (!en?.content?.length || (mode === "missing" && hasUr)) return
        const walk = (n: RichNode, p: Path) => {
          if (typeof n.text === "string" && n.text.trim()) out.push({ path: [...path, "#rich", ...p], text: n.text })
          n.content?.forEach((c, i) => walk(c, [...p, "content", i]))
        }
        en.content.forEach((n, i) => walk(n, ["content", i]))
        return
      }
      const en = typeof l.en === "string" ? l.en : ""
      if (!en.trim() || (mode === "missing" && typeof l.ur === "string" && l.ur.trim())) return
      out.push({ path, text: en })
    } else if (fd.kind === "list" && Array.isArray(v)) v.forEach((x, i) => visit(fd.of, x, [...path, i]))
    else if (fd.kind === "group") Object.entries(fd.fields).forEach(([k, sub]) => visit(sub, (v as Data)[k], [...path, k]))
  }
  Object.entries(fields).forEach(([k, fd]) => visit(fd, data[k], [k]))
  return out
}

/** Writes translations back: plain values get { ur, ai: true }; rich text gets an Urdu copy of the document. */
export function apply(data: Data, items: Item[], ur: string[]): Data {
  const next = structuredClone(data)
  const docs = new Map<string, RichDoc>() // rich field -> its Urdu document being filled in
  items.forEach((it, i) => {
    const t = ur[i]?.trim()
    if (!t) return
    const rich = it.path.indexOf("#rich")
    const fieldPath = rich >= 0 ? it.path.slice(0, rich) : it.path
    let parent = next as Record<string | number, unknown>
    for (const k of fieldPath.slice(0, -1)) parent = parent[k] as Record<string | number, unknown>
    const key = fieldPath[fieldPath.length - 1]
    const l = parent[key] as Localized<unknown>
    if (rich < 0) {
      parent[key] = { ...l, ur: t, ai: true }
      return
    }
    const id = JSON.stringify(fieldPath)
    let doc = docs.get(id)
    if (!doc) {
      // Same structure as the English document; the texts are swapped in one by one.
      doc = structuredClone(l.en) as RichDoc
      docs.set(id, doc)
      parent[key] = { ...l, ur: doc, ai: true }
    }
    let node: unknown = doc
    for (const k of it.path.slice(rich + 1)) node = (node as Record<string | number, unknown>)[k]
    ;(node as RichNode).text = t
  })
  return next
}

const SYSTEM = `You translate website copy for Mjazo, a home-services company in Karachi (salon and beauty at home, cleaning, AC repair, health visits and more), from English into Urdu.
Write natural, warm, modern Urdu in Nastaliq script, the way a Karachi brand would speak to its customers. Keep it as short as the English; short labels stay short.
Rules:
- Keep {{tokens}} exactly as they are, including the braces.
- Keep *asterisks* around the same words (they mark emphasis).
- Mjazo is مجازو. WhatsApp is واٹس ایپ. Keep JazzCash, Easypaisa, Raast, CNIC, AC, PKR and brand or product names readable (Urdu spelling or as is).
- Keep numbers, prices, phone numbers, emails, URLs and times as digits and Latin characters.
- Common English loanwords Pakistanis use (booking, facial, waxing, AC, service) may stay as Urdu-script loanwords.
- Never add notes, quotes or explanations. Return one translation per input, in the same order.`

/** Urdu for a list of English strings, in batches. */
export async function translateTexts(texts: string[]): Promise<string[]> {
  if (!aiEnabled()) throw new ValidationError(["AI translation needs ANTHROPIC_API_KEY in the environment."])
  const out: string[] = []
  for (let i = 0; i < texts.length; i += 60) {
    const batch = texts.slice(i, i + 60)
    const res = await structured<{ translations: { i: number; ur: string }[] }>({
      model: MODELS.concierge,
      maxTokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content: `Translate each item into Urdu.\n\n${JSON.stringify(batch.map((text, n) => ({ i: n, en: text })))}` }],
      tool: {
        name: "urdu",
        description: "The Urdu translations, one per input item",
        input_schema: {
          type: "object",
          properties: { translations: { type: "array", items: { type: "object", properties: { i: { type: "integer" }, ur: { type: "string" } }, required: ["i", "ur"] } } },
          required: ["translations"],
        },
      },
    })
    const byIndex = new Map((res?.translations ?? []).map((t) => [t.i, t.ur]))
    batch.forEach((en, n) => {
      const ur = byIndex.get(n) ?? ""
      // A translation that lost a {{token}} would break the page: keep it empty so it's retried.
      const tokens = en.match(/\{\{[^}]+\}\}/g) ?? []
      out.push(tokens.every((t) => ur.includes(t)) ? ur : "")
    })
  }
  return out
}

/** Translates an entry's data; returns the new data and how many values were filled. */
export async function translateData(fields: Fields, data: Data, mode: "missing" | "all") {
  const items = collect(fields, data, mode)
  if (!items.length) return { data, count: 0 }
  const ur = await translateTexts(items.map((x) => x.text))
  return { data: apply(data, items, ur), count: ur.filter(Boolean).length }
}

export { approveAll } from "./fields"
