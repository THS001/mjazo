"use server"

import { run } from "@/lib/cms/action"
import { CmsAuthError } from "@/lib/cms/auth"
import { entryCoverage } from "@/lib/cms/coverage"
import { getType } from "@/lib/cms/registry"
import { can } from "@/lib/cms/roles"
import type { Data } from "@/lib/cms/store"
import { translateData } from "@/lib/cms/translate"
import * as w from "@/lib/cms/write"

// AI translation into Urdu. Results are flagged "AI translation, needs review" until a person
// edits or approves them.

/** Translates one entry as it is on screen; the editor saves the result as a draft. */
export async function translateEntryAction(type: string, data: Data, mode: "missing" | "all") {
  return run("edit", async () => {
    const t = getType(type)
    if (!t) throw new Error("Unknown type")
    return translateData(t.fields, data, mode)
  })
}

export async function coverageAction() {
  return run("view", () => entryCoverage())
}

/**
 * The bulk translator's step: translates the next entry that is missing Urdu (skipping `skip`),
 * saves it as a draft, and publishes it when asked (and allowed). The browser calls it repeatedly.
 */
export async function translateNextAction(skip: string[], publish: boolean) {
  return run("edit", async (u) => {
    const pending = (await entryCoverage()).filter((e) => e.done < e.total && !skip.includes(`${e.type}/${e.id}`))
    const next = pending[0]
    if (!next) return { key: null, remaining: 0 }
    const key = `${next.type}/${next.id}`
    try {
      const t = getType(next.type)!
      const loaded = await w.loadEntry(next.type, next.id)
      if (!loaded) return { key, title: next.title, skipped: "It no longer exists.", remaining: pending.length - 1 }
      const { data, count } = await translateData(t.fields, loaded.data, "missing")
      const saved = await w.saveDraft(u, next.type, next.id, data, loaded.version, { manual: true })
      let published = false
      if (publish && can(u.role, "publish")) {
        await w.publish(u, next.type, next.id, saved.version)
        published = true
      }
      return { key, title: next.title, label: next.label, count, published, remaining: pending.length - 1 }
    } catch (e) {
      if (e instanceof CmsAuthError || e instanceof w.ValidationError) return { key, title: next.title, skipped: e.message, remaining: pending.length - 1 }
      throw e
    }
  })
}
