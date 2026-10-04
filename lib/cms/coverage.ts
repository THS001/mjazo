import "server-only"
import { coverage } from "./fields"
import { storedDefaults, withDefaultUrdu } from "./defaults"
import { allTypes } from "./registry"
import { allRows } from "./store"
import { titleOf } from "./write"

// How much of the site has Urdu: per entry (built-in content, saved drafts and live entries).

export type EntryCoverage = { type: string; id: string; label: string; group: string; title: string; total: number; done: number; ai: number }

/** The data an editor would see for every entry (draft, else live, else built-in), with its Urdu coverage. */
export async function entryCoverage(): Promise<EntryCoverage[]> {
  const rows = await allRows()
  const byKey = new Map(rows.map((r) => [`${r.type}/${r.id}`, r]))
  const out: EntryCoverage[] = []
  for (const t of allTypes()) {
    const defs = storedDefaults(t)
    const ids = new Set([...defs.keys(), ...rows.filter((r) => r.type === t.type).map((r) => r.id)])
    for (const id of ids) {
      const row = byKey.get(`${t.type}/${id}`)
      if (row?.status === "archived") continue
      const def = defs.get(id)
      const data = withDefaultUrdu(t.fields, { ...(def ?? {}), ...(row?.draft ?? row?.published ?? {}) }, def)
      const c = coverage(t.fields, data)
      if (!c.total) continue
      out.push({ type: t.type, id, label: t.plural ?? t.label, group: t.group, title: titleOf(t, data, id), ...c })
    }
  }
  return out
}
