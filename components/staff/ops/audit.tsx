"use client"

import { useEffect, useState } from "react"
import { api, Btn, Empty } from "../kit"
import { inputCls } from "./context"
import { cn } from "@/lib/utils"

// The audit log: who did what in mission control, newest first.

type Row = { id: number; at: string; actor: string; action: string; target: string | null; detail: string | null }
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })

export function AuditTab() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [actor, setActor] = useState("")
  const [q, setQ] = useState("")
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [actors, setActors] = useState<string[]>([])
  const fetchRows = async (before?: number) => {
    const sp = new URLSearchParams()
    if (actor) sp.set("actor", actor)
    if (q.trim()) sp.set("q", q.trim())
    if (before) sp.set("before", String(before))
    return (await api<{ rows: Row[] }>(`/api/ops/audit?${sp}`)).rows
  }
  useEffect(() => {
    const t = setTimeout(() => {
      fetchRows().then(
        (r) => {
          setRows(r)
          setMore(r.length === 100)
          setActors((a) => [...new Set([...a, ...r.map((x) => x.actor)])].sort())
        },
        (e) => setError((e as Error).message),
      )
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, q])
  const older = async () => {
    if (!rows?.length) return
    setBusy(true)
    const r = await fetchRows(rows[rows.length - 1].id).catch(() => [])
    setRows([...rows, ...r])
    setMore(r.length === 100)
    setBusy(false)
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl">Audit log</h2>
        <p className="text-sm text-zinc-500 mt-1">Every staff action in mission control, with the person&apos;s email. Nothing here can be edited or deleted.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className={cn(inputCls, "w-auto min-w-[14rem]")} value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Person">
          <option value="">Everyone</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input className={cn(inputCls, "w-auto flex-1 min-w-[12rem]")} placeholder="Search actions, bookings, pros…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows ? (
        <div className="h-40 rounded-3xl bg-black/[0.04] animate-pulse" />
      ) : !rows.length ? (
        <Empty title="Nothing logged yet" />
      ) : (
        <ol className="rounded-3xl bg-white border border-black/[0.06] divide-y divide-black/[0.06]">
          {rows.map((r) => (
            <li key={r.id} className="p-3 sm:p-4 text-sm grid sm:grid-cols-[9rem_14rem_1fr] gap-x-4 gap-y-0.5">
              <span className="text-xs text-zinc-500 tabular-nums">{when(r.at)}</span>
              <span className="truncate font-medium" title={r.actor}>
                {r.actor}
              </span>
              <span className="min-w-0">
                {r.action}
                {r.target && <span className="font-mono text-xs text-zinc-500"> · {r.target}</span>}
                {r.detail && <span className="block text-xs text-zinc-500 break-words">{r.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {more && (
        <Btn variant="light" busy={busy} onClick={older}>
          Older entries
        </Btn>
      )}
    </div>
  )
}
