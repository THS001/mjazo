"use client"

import { useState } from "react"
import { CalendarHeart, ChevronDown, MessageCircle } from "lucide-react"
import { to12h, type Schedule, type ShaadiPlan } from "@/lib/shaadi"
import { cn } from "@/lib/utils"
import { api, ago, Badge, Btn, Empty, pkr, usePoll, waTo } from "../kit"
import { useCatalog } from "@/components/cms/provider"

type Wedding = { id: string; createdAt: string; status: "submitted" | "approved" | "declined"; plan: ShaadiPlan; total: number; note?: string; jobIds?: string[]; decidedAt?: string; schedule: Schedule }

const STATUS = { submitted: { label: "To review", cls: "bg-[var(--brand-soft)] text-[var(--brand-ink)]" }, approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" }, declined: { label: "Declined", cls: "bg-zinc-100 text-zinc-500" } }
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })

export function Weddings({ reload }: { reload: () => void }) {
  const [list, setList] = useState<Wedding[] | null>(null)
  const load = async () => setList((await api<{ weddings: Wedding[] }>("/api/ops/weddings").catch(() => null))?.weddings ?? list)
  usePoll(load, 30000)
  if (!list) return <div className="h-64 rounded-3xl bg-black/[0.04] animate-pulse" />
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm text-[var(--brand-ink)]">
          <CalendarHeart className="w-4 h-4" /> Shaadi Orchestrator
        </p>
        <h2 className="font-serif text-3xl mt-1">Wedding plans</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl">Families plan with the AI on /weddings/planner. Check pros and timings, confirm with the family, then approve: every prep visit and event-day pro becomes a job with a fixed arrival time, ready for Route Brain.</p>
      </div>
      {!list.length ? (
        <Empty title="No wedding plans yet" body="Plans sent from the Shaadi Orchestrator appear here for approval." />
      ) : (
        <div className="space-y-3">
          {list.map((w) => (
            <WeddingCard
              key={w.id}
              w={w}
              onChange={() => {
                load()
                reload()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WeddingCard({ w, onChange }: { w: Wedding; onChange: () => void }) {
  const { getArea } = useCatalog()
  const [open, setOpen] = useState(w.status === "submitted")
  const [busy, setBusy] = useState("")
  const p = w.plan
  const s = w.schedule
  const act = async (action: "approve" | "decline") => {
    const note = action === "decline" ? prompt("Reason (kept internal)?") : null
    if (action === "decline" && note === null) return
    if (action === "approve" && !confirm(`Approve ${p.title}? This creates ${s.prep.reduce((x, v) => x + v.pros, 0) + s.events.reduce((x, e) => x + e.tracks.length, 0)} visits.`)) return
    setBusy(action)
    try {
      const r = await api<{ created: number }>("/api/ops/weddings", { action, id: w.id, note: note || undefined })
      if (action === "approve") alert(`${r.created} visits created. Assign pros in Route Brain for each date.`)
      onChange()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  return (
    <article className="min-w-0 rounded-3xl bg-white border border-black/[0.06] p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={STATUS[w.status].cls}>{STATUS[w.status].label}</Badge>
            <span className="font-mono text-xs text-zinc-400">{w.id}</span>
            <span className="text-xs text-zinc-400">{ago(w.createdAt)}</span>
          </div>
          <p className="font-serif text-2xl mt-2">{p.title}</p>
          <p className="text-sm text-zinc-500">
            {p.contact.name} · {p.contact.phone} · {getArea(p.contact.area)?.name ?? p.contact.area} · {p.people.length} people
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl">{pkr(s.total)}</p>
          {s.quoted.length > 0 && <p className="text-xs text-zinc-500">+ {s.quoted.join(", ")} (quote)</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {s.events.map((e) => (
          <span key={e.eventId} className="rounded-2xl bg-[oklch(0.975_0.008_80)] px-3 py-2 text-sm">
            <b>{e.name}</b> {fmt(e.date)} · photos {to12h(e.readyBy)} · {e.pros.glam} glam{e.pros.mehndi ? ` + ${e.pros.mehndi} mehndi` : ""} from {to12h(e.start)}
          </span>
        ))}
        {s.prep.length > 0 && <span className="rounded-2xl bg-[oklch(0.975_0.008_80)] px-3 py-2 text-sm">{s.prep.length} prep visits</span>}
      </div>
      {s.warnings.length > 0 && <p className="mt-3 text-sm text-amber-700">{s.warnings.join(" ")}</p>}
      <button onClick={() => setOpen((o) => !o)} className="mt-4 text-sm flex items-center gap-1 text-zinc-600">
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} /> {open ? "Hide schedule" : "Show schedule"}
      </button>
      {open && (
        <div className="mt-3 grid lg:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            {s.events.map((e) => (
              <div key={e.eventId}>
                <p className="font-semibold">
                  {e.name}, {fmt(e.date)}
                </p>
                <ul className="mt-1 space-y-1">
                  {e.tracks.map((t, i) => (
                    <li key={t.id} className="text-zinc-700">
                      <span className="text-xs text-zinc-400">
                        {t.pool} {i + 1}, arrive {to12h(t.arrive)}:
                      </span>{" "}
                      {t.blocks.map((b) => `${b.person} ${b.label} ${to12h(b.start)}`).join(" → ")}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {s.prep.map((v) => (
              <p key={v.date}>
                <b>{fmt(v.date)}</b> {v.window} · {v.pros} pro{v.pros > 1 ? "s" : ""}: {v.items.map((i) => `${i.person} ${i.label}`).join(", ")}
              </p>
            ))}
            <div>
              <p className="font-semibold">Split by branch</p>
              {s.branches.map((b) => (
                <p key={b.branch}>
                  {b.branch}: {pkr(b.amount)} ({b.people})
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-5">
        <a href={waTo(p.contact.phone, `Assalam o Alaikum ${p.contact.name.split(" ")[0]}! This is the Mjazo wedding coordinator about your plan ${w.id} (${p.title}).`)} target="_blank" rel="noreferrer" className="h-9 px-3.5 rounded-full bg-[#25D366] text-foreground inline-flex items-center gap-1.5 text-[13px] font-medium">
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp the family
        </a>
        {w.status === "submitted" && (
          <>
            <Btn size="sm" busy={busy === "approve"} onClick={() => act("approve")}>
              Approve & create visits
            </Btn>
            <Btn size="sm" variant="ghost" className="text-red-600" busy={busy === "decline"} onClick={() => act("decline")}>
              Decline
            </Btn>
          </>
        )}
        {w.status === "approved" && <span className="text-sm text-emerald-700 self-center">{w.jobIds?.length ?? 0} visits created</span>}
      </div>
    </article>
  )
}
