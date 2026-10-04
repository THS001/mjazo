"use client"

import { useState } from "react"
import { ChevronDown, MapPin, Phone } from "lucide-react"
import { eligible, jobMinutes } from "@/lib/ops/logic"
import { cn } from "@/lib/utils"
import type { Pro } from "@/lib/ops/types"
import { api, Badge, Btn, clock, Empty, pkr, SAFETY, STATUS } from "../kit"
import type { OpsData, OpsJob } from "./console"
import { useCatalog } from "@/components/cms/provider"
import { WINDOW_LABELS } from "@/lib/time"

export function LiveBoard({ data, reload }: { data: OpsData; reload: () => void }) {
  const s = data.stats
  const isToday = data.date === data.today
  const cards = [
    { k: "Bookings", v: s.jobs },
    { k: "Unassigned", v: s.unassigned, warn: s.unassigned > 0 },
    { k: "In progress", v: s.live },
    { k: "Done", v: s.done },
    { k: "Booked value", v: pkr(s.revenue) },
    { k: "Visits / pro / day (7d)", v: s.perProDay || "–", hint: "target ≥ 2", warn: s.perProDay > 0 && s.perProDay < 2 },
    { k: "Unreconciled payments", v: s.unreconciled, warn: s.unreconciled > 0 },
    { k: "Open complaints", v: s.openComplaints, warn: s.openComplaints > 0 },
  ]
  const groups = WINDOW_LABELS.map((w) => ({ w, jobs: data.jobs.filter((j) => j.window === w) })).filter((g) => g.jobs.length)
  const other = data.jobs.filter((j) => !WINDOW_LABELS.includes(j.window))
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.k} className={cn("rounded-3xl bg-white border p-4 sm:p-5", c.warn ? "border-amber-300" : "border-black/[0.06]")}>
            <p className="text-xs text-zinc-500">{c.k}</p>
            <p className="font-serif text-3xl mt-1.5 leading-none truncate">{c.v}</p>
            {c.hint && <p className="text-[11px] text-zinc-400 mt-1.5">{c.hint}</p>}
          </div>
        ))}
      </div>

      {!data.jobs.length ? (
        <Empty title={isToday ? "No bookings today yet" : "No bookings on this day"} body="Bookings from the website, the Concierge and WhatsApp land here automatically." />
      ) : (
        [...groups, ...(other.length ? [{ w: "Other", jobs: other }] : [])].map((g) => (
          <section key={g.w}>
            <h3 className="text-sm font-semibold text-zinc-500 mb-3 flex items-center gap-2">
              {g.w} <span className="text-zinc-300">·</span> <span className="font-normal">{g.jobs.length}</span>
            </h3>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {g.jobs.map((j) => (
                <JobCard key={j.id} job={j} pros={data.pros} reload={reload} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function JobCard({ job: j, pros, reload }: { job: OpsJob; pros: OpsData["pros"]; reload: () => void }) {
  const cat = useCatalog()
  const { getArea } = cat
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState("")
  const pro = pros.find((p) => p.id === j.proId)
  const fits = pros.filter((p) => p.status === "active").map((p) => ({ p, ok: eligible(p as Pro, j, cat) })).sort((a, b) => Number(b.ok) - Number(a.ok))
  const locked = !["new", "assigned", "en_route", "cancelled"].includes(j.status)
  const run = async (key: string, body: unknown) => {
    setBusy(key)
    try {
      await api("/api/ops/jobs", body)
      reload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  const safety = SAFETY[j.safety.level]
  return (
    <article className={cn("min-w-0 rounded-3xl bg-white border p-5 transition-shadow hover:shadow-[0_10px_40px_-20px_rgba(0,0,0,0.25)]", j.safety.level === "ok" ? "border-black/[0.06]" : safety.cls.split(" ").find((c) => c.startsWith("border-")))}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={STATUS[j.status].cls}>{STATUS[j.status].label}</Badge>
        {j.safety.level !== "ok" && <Badge className={cn("border", safety.cls)}>{safety.label}</Badge>}
        {j.channel && j.channel !== "web" && <Badge className="bg-violet-100 text-violet-800">{j.channel === "concierge-whatsapp" ? "WhatsApp AI" : "Concierge"}</Badge>}
        <span className="ml-auto text-xs text-zinc-400 font-mono">{j.id}</span>
      </div>
      <p className="mt-3 text-lg font-semibold leading-snug">
        {j.customer.name} <span className="font-normal text-zinc-500">· {j.subArea ? `${j.subArea}, ` : ""}{getArea(j.area)?.name ?? j.area}</span>
      </p>
      <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{j.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(" · ")}</p>
      <p className="text-sm mt-2 flex items-center gap-3 text-zinc-500">
        <span className="text-black font-semibold">{pkr(j.total)}</span> {j.payment} · ~{jobMinutes(j, cat)} min{j.eta && ` · ETA ${j.eta}`}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <select
          value={j.proId ?? ""}
          disabled={locked || !!busy}
          onChange={(e) => run("assign", { action: "assign", jobId: j.id, proId: e.target.value || null })}
          className="flex-1 min-w-0 h-11 rounded-2xl border border-black/10 bg-[oklch(0.975_0.008_80)] px-3 text-sm outline-none focus:border-black disabled:opacity-60"
          aria-label="Assign pro"
        >
          <option value="">{pro ? "Unassign" : "Assign a pro…"}</option>
          {pro && !fits.some((f) => f.p.id === pro.id) && <option value={pro.id}>{pro.name} (paused)</option>}
          {fits.map(({ p, ok }) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {ok ? "" : " (skills don't match)"}
            </option>
          ))}
        </select>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Details" className="w-11 h-11 shrink-0 rounded-2xl border border-black/10 flex items-center justify-center">
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-black/[0.06] space-y-4 text-sm">
          <div className="space-y-1.5">
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-zinc-400" /> {j.address}
              {j.landmark && `, near ${j.landmark}`}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-zinc-400" />
              <a className="underline" href={`tel:${j.customer.phone}`}>
                {j.customer.phone}
              </a>
            </p>
            {j.notes && <p className="text-zinc-600">Note: {j.notes}</p>}
          </div>
          {j.events.length > 0 && (
            <ol className="space-y-1 text-xs text-zinc-500 border-l border-black/10 pl-3">
              {j.events.slice(-8).map((e, i) => (
                <li key={i}>
                  <span className="text-black font-medium">{e.type.replace("_", " ")}</span> · {clock(e.at)} · {e.by}
                  {e.note && ` · ${e.note}`}
                  {e.lat && (
                    <>
                      {" · "}
                      <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}>
                        map
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
          {j.paymentRecord && (
            <p className="text-xs">
              Payment: {pkr(j.paymentRecord.amount)} {j.paymentRecord.method} · <b>{j.paymentRecord.status}</b>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {j.status === "checked_in" && (
              <Btn size="sm" variant="light" busy={busy === "out"} onClick={() => run("out", { action: "event", jobId: j.id, type: "checked_out", note: "Checked out by ops" })}>
                Check out
              </Btn>
            )}
            {j.status === "checked_out" && (
              <Btn size="sm" variant="light" busy={busy === "done"} onClick={() => run("done", { action: "event", jobId: j.id, type: "completed", note: "Completed by ops" })}>
                Mark done
              </Btn>
            )}
            {["new", "assigned", "en_route"].includes(j.status) && (
              <Btn
                size="sm"
                variant="ghost"
                className="text-red-600"
                busy={busy === "cancel"}
                onClick={() => {
                  const note = prompt("Reason for cancelling?")
                  if (note !== null) run("cancel", { action: "event", jobId: j.id, type: "cancelled", note: note || "Cancelled by ops" })
                }}
              >
                Cancel booking
              </Btn>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
