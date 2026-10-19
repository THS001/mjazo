import { f, type Field, type Fields } from "../fields"

// Interface text (buttons, labels, messages) is declared as a plain object of English defaults, with
// hand-written Urdu in the same shape. The admin fields are generated from the defaults: a group per
// nested object, a text field per string, each showing the original English and the {{tokens}} to
// keep. Used by "Buttons & labels" (ui.ts) and the "Tool text" groups on the AI tool pages.

type Strings = { [k: string]: string | string[] | Record<string, string>[] | Strings }

const label = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())

function stringField(key: string, v: unknown): Field {
  if (Array.isArray(v)) {
    if (typeof v[0] === "string") return f.list(label(key), f.text("Item"))
    const first = v[0] as Record<string, string>
    return f.list(label(key), f.group("Item", Object.fromEntries(Object.keys(first).map((k) => [k, f.text(label(k))]))), { itemLabel: Object.keys(first)[0] })
  }
  if (v && typeof v === "object") return f.group(label(key), Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stringField(k, x)])))
  const s = String(v)
  const tokens = s.match(/\{\{\w+\}\}/g)
  return f.text(label(key), { help: [`“${s}”`, tokens ? `Keep ${[...new Set(tokens)].join(", ")}.` : "", s.includes("*") ? "*Stars* make words bold." : ""].filter(Boolean).join(" ") })
}

/** One field group per top-level key of `defaults`, titled from `groups` (or from the key). */
export function stringFields<D extends Strings>(defaults: D, groups: Partial<Record<keyof D, string>> = {}): Fields {
  return Object.fromEntries(
    Object.entries(defaults).map(([g, v]) => {
      const fd = stringField(g, v)
      return [g, fd.kind === "group" ? { ...fd, label: groups[g as keyof D] ?? fd.label } : fd]
    }),
  )
}

/** A "Tool text" group for a page type: its strings, grouped by part of the tool. */
export const toolText = <D extends Strings>(defaults: D, groups: Partial<Record<keyof D, string>> = {}) =>
  f.group("Tool text", stringFields(defaults, groups), { help: "Buttons, labels and messages inside the tool. Each field shows the original English under its name." })
