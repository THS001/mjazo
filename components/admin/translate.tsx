"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Check, Languages, Loader2, Sparkles, Square, X } from "lucide-react"
import type { EntryCoverage } from "@/lib/cms/coverage"
import { coverageAction, translateNextAction } from "@/app/(staff)/admin/translate-actions"
import { Btn, Card, Notice } from "./ui"

// Site-wide Urdu coverage, and a bulk translator that works through every entry missing Urdu,
// one at a time (each step is a separate request, so nothing times out).

type Log = { key: string; text: string; tone: "ok" | "skip" | "error" }

export function TranslateTool({ canPublish, aiReady }: { canPublish: boolean; aiReady: boolean }) {
  const [rows, setRows] = useState<EntryCoverage[] | null>(null)
  const [error, setError] = useState("")
  const [running, setRunning] = useState(false)
  const [publish, setPublish] = useState(false)
  const [log, setLog] = useState<Log[]>([])
  const [left, setLeft] = useState<number | null>(null)
  const stop = useRef(false)

  const load = async () => {
    const r = await coverageAction()
    if (r.ok) setRows(r.data)
    else setError(r.error)
  }
  useEffect(() => void load(), [])

  const groups = useMemo(() => {
    const m = new Map<string, { label: string; group: string; total: number; done: number; ai: number; entries: number }>()
    for (const r of rows ?? []) {
      const g = m.get(r.label) ?? { label: r.label, group: r.group, total: 0, done: 0, ai: 0, entries: 0 }
      g.total += r.total
      g.done += r.done
      g.ai += r.ai
      g.entries++
      m.set(r.label, g)
    }
    return [...m.values()]
  }, [rows])
  const all = groups.reduce((a, g) => ({ total: a.total + g.total, done: a.done + g.done, ai: a.ai + g.ai }), { total: 0, done: 0, ai: 0 })
  const missing = (rows ?? []).filter((r) => r.done < r.total)

  const runAll = async () => {
    setRunning(true)
    stop.current = false
    const skip: string[] = []
    for (;;) {
      if (stop.current) break
      const r = await translateNextAction(skip, publish)
      if (!r.ok) {
        setLog((l) => [{ key: String(Date.now()), text: r.error, tone: "error" }, ...l])
        break
      }
      const d = r.data
      if (!d.key) break
      skip.push(d.key)
      setLeft(d.remaining)
      setLog((l) => [
        {
          key: d.key!,
          tone: "skipped" in d && d.skipped ? "skip" : "ok",
          text: "skipped" in d && d.skipped ? `${d.title}: skipped (${d.skipped})` : `${"label" in d ? d.label : ""}: ${d.title} · ${"count" in d ? d.count : 0} texts${"published" in d && d.published ? " · published" : " · saved as draft"}`,
        },
        ...l,
      ])
    }
    setRunning(false)
    await load()
  }

  return (
    <div className="space-y-6">
      {!aiReady && <Notice tone="error">AI translation needs ANTHROPIC_API_KEY in the environment. You can still translate by hand in each editor.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {!rows && !error && <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />}

      {rows && (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-500">Whole site</p>
                <p className="font-serif text-4xl">{all.total ? Math.round((all.done / all.total) * 100) : 100}% in Urdu</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {all.done.toLocaleString()} of {all.total.toLocaleString()} texts{all.ai ? ` · ${all.ai.toLocaleString()} by AI, not reviewed yet` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {canPublish && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={running} className="h-4 w-4 accent-black" />
                    Publish each one straight away
                  </label>
                )}
                {running ? (
                  <Btn onClick={() => (stop.current = true)}>
                    <Square className="h-4 w-4" /> Stop after this one
                  </Btn>
                ) : (
                  <Btn variant="primary" disabled={!aiReady || missing.length === 0} onClick={runAll}>
                    <Sparkles className="h-4 w-4" /> Translate everything missing ({missing.length})
                  </Btn>
                )}
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${all.total ? (all.done / all.total) * 100 : 100}%` }} />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Each translation is saved as a draft{canPublish ? " (or published, if you tick the box)" : ""} and flagged “AI translation, needs review” until someone reads it. Prices, phone numbers and {"{{tokens}}"} are kept as they are.
            </p>
          </Card>

          {(running || log.length > 0) && (
            <Card className="p-5">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-emerald-600" />}
                {running ? `Translating… ${left ?? ""} left` : "Done"}
              </p>
              <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
                {log.map((l) => (
                  <li key={l.key} className={l.tone === "error" ? "text-red-700" : l.tone === "skip" ? "text-amber-700" : "text-zinc-600"}>
                    {l.tone === "error" ? <X className="me-1 inline h-3 w-3" /> : <Check className="me-1 inline h-3 w-3" />}
                    {l.text}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-start text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">Section</th>
                  <th className="px-4 py-2 text-start font-medium">Entries</th>
                  <th className="px-4 py-2 text-start font-medium">Urdu</th>
                  <th className="px-4 py-2 text-start font-medium">Needs review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {groups.map((g) => (
                  <tr key={g.label}>
                    <td className="px-4 py-2">
                      {g.label} <span className="text-xs text-zinc-400">· {g.group}</span>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{g.entries}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${(g.done / g.total) * 100}%` }} />
                        </div>
                        <span className="tabular-nums text-xs text-zinc-500">{Math.round((g.done / g.total) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-xs text-violet-700">{g.ai || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {missing.length > 0 && (
            <Card className="p-5">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Languages className="h-4 w-4" /> Missing Urdu
              </p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {missing.slice(0, 60).map((m) => (
                  <li key={`${m.type}/${m.id}`} className="flex justify-between gap-2">
                    <Link href={`/admin/c/${m.type}/${encodeURIComponent(m.id)}`} className="truncate hover:underline">
                      {m.label}: {m.title}
                    </Link>
                    <span className="shrink-0 tabular-nums text-xs text-zinc-400">
                      {m.done}/{m.total}
                    </span>
                  </li>
                ))}
              </ul>
              {missing.length > 60 && <p className="mt-2 text-xs text-zinc-500">…and {missing.length - 60} more.</p>}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
