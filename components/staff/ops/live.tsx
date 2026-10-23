"use client"

import { useState } from "react"
import { ChevronDown, ExternalLink, MapPin, Phone } from "lucide-react"
import { eligible, jobMinutes, unavailableReason } from "@/lib/ops/logic"
import { cn } from "@/lib/utils"
import { isVerified, type Job, type Pro } from "@/lib/ops/types"
import { api, Badge, Btn, clock, Empty, pkr, SAFETY, STATUS } from "../kit"
import type { OpsData, OpsJob, OpsOffer, OpsPro } from "./console"
import { useOps } from "./context"
import { useCatalog } from "@/components/cms/provider"
import { WINDOW_LABELS } from "@/lib/time"

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unassigned", label: "Unassigned" },
  { id: "alerts", label: "Late or overdue" },
  { id: "live", label: "In progress" },
  { id: "done", label: "Done" },
] as const
type Filter = (typeof FILTERS)[number]["id"]
const matches = (j: OpsJob, f: Filter) =>
  f === "all" || (f === "unassigned" && j.status === "new") || (f === "alerts" && j.safety.level !== "ok") || (f === "live" && ["assigned", "en_route", "checked_in", "checked_out"].includes(j.status)) || (f === "done" && ["completed", "cancelled", "no_show"].includes(j.status))

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
  const { getArea } = useCatalog()
  const [filter, setFilter] = useState<Filter>("all")
  const [zone, setZone] = useState("")
  const zones = [...new Set(data.jobs.map((j) => j.area))].sort()
  const shown = data.jobs.filter((j) => matches(j, filter) && (!zone || j.area === zone))
  const groups = WINDOW_LABELS.map((w) => ({ w, jobs: shown.filter((j) => j.window === w) })).filter((g) => g.jobs.length)
  const other = shown.filter((j) => !WINDOW_LABELS.includes(j.window))
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

      {data.jobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const n = data.jobs.filter((j) => matches(j, f.id)).length
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn("h-9 px-3.5 rounded-full border text-sm transition-colors", filter === f.id ? "bg-black text-white border-black" : "border-black/15 bg-white hover:border-black/40", f.id === "unassigned" && n > 0 && filter !== f.id && "border-amber-400")}>
                {f.label} <span className="opacity-60">· {n}</span>
              </button>
            )
          })}
          {zones.length > 1 && (
            <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone" className="h-9 rounded-full border border-black/15 bg-white px-3 text-sm">
              <option value="">Every area</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {getArea(z)?.name ?? z}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {!data.jobs.length ? (
        <Empty title={isToday ? "No bookings today yet" : "No bookings on this day"} body="Bookings from the website, the Concierge and WhatsApp land here automatically." />
      ) : !shown.length ? (
        <Empty title="Nothing matches" body="Try another filter." />
      ) : (
        [...groups, ...(other.length ? [{ w: "Other", jobs: other }] : [])].map((g) => (
          <section key={g.w}>
            <h3 className="text-sm font-semibold text-zinc-500 mb-3 flex items-center gap-2">
              {g.w} <span className="text-zinc-300">·</span> <span className="font-normal">{g.jobs.length}</span>
            </h3>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {g.jobs.map((j) => (
                <JobCard key={j.id} job={j} pros={data.pros} offer={data.offers?.find((o) => o.jobId === j.id)} suggestion={data.suggestions?.[j.id]} live={data.live?.[j.id]} reload={reload} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function JobCard({ job: j, pros, offer, suggestion, live, reload }: { job: OpsJob; pros: OpsData["pros"]; offer?: OpsOffer; suggestion?: { proId: string; reasons: string[] }; live?: NonNullable<OpsData["live"]>[string]; reload: () => void }) {
  const cat = useCatalog()
  const { getArea } = cat
  const { can, openBooking } = useOps()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState("")
  const pro = pros.find((p) => p.id === j.proId)
  const fits = pros
    .filter((p) => p.status === "active")
    .map((p) => {
      const why = !eligible(p as Pro, j, cat) ? "skills don't match" : unavailableReason(p as Pro, j)
      return { p, ok: !why, why: [p.id === j.preferredProId ? "asked for" : null, why, isVerified(p) ? null : "not verified"].filter(Boolean).join(", ") }
    })
    .sort((a, b) => Number(b.p.id === j.preferredProId) - Number(a.p.id === j.preferredProId) || Number(b.ok) - Number(a.ok))
  const locked = !["new", "assigned", "en_route", "cancelled"].includes(j.status) || !can("ops.dispatch")
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
        {j.channel && j.channel !== "web" && <Badge className="bg-violet-100 text-violet-800">{j.channel === "concierge-whatsapp" ? "WhatsApp AI" : j.channel === "concierge-app" ? "App AI" : j.channel === "app" ? "App" : "Concierge"}</Badge>}
        {j.preferredProId && <Badge className="bg-sky-100 text-sky-900">Asked for {pros.find((p) => p.id === j.preferredProId)?.name.split(" ")[0] ?? j.preferredProId}</Badge>}
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
        <ProPicker job={j} pro={pro} fits={fits} disabled={locked || !!busy} onPick={(action, proId) => run(action, { action, jobId: j.id, proId })} />
        <button onClick={() => openBooking(j.id)} aria-label="Open the booking page" title="Open the booking page" className="w-11 h-11 shrink-0 rounded-2xl border border-black/10 flex items-center justify-center hover:border-black/30">
          <ExternalLink className="w-4 h-4" />
        </button>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Details" className="w-11 h-11 shrink-0 rounded-2xl border border-black/10 flex items-center justify-center">
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {live && j.status === "en_route" && (
        <a href={`https://www.google.com/maps/search/?api=1&query=${live.lat},${live.lng}`} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 text-xs rounded-2xl bg-amber-50 text-amber-900 px-3 py-2 hover:underline">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>
            Live: {live.km !== null ? `${live.km} km away, about ${live.minutes} min` : "on the map"} · seen at {clock(live.at)}
          </span>
        </a>
      )}
      {offer && <OfferLine offer={offer} pros={pros} busy={busy === "withdraw_offer"} canWithdraw={can("ops.dispatch")} onWithdraw={() => run("withdraw_offer", { action: "withdraw_offer", jobId: j.id })} />}
      {!offer && suggestion && j.status === "new" && (
        <p className="mt-2 flex items-center gap-2 text-xs rounded-2xl bg-violet-50 text-violet-900 px-3 py-2">
          <span className="flex-1 min-w-0">
            Suggested: <b>{pros.find((p) => p.id === suggestion.proId)?.name ?? suggestion.proId}</b> · {suggestion.reasons.join(" · ")}
          </span>
          {can("ops.dispatch") && (
            <button onClick={() => run("offer", { action: "offer", jobId: j.id, proId: suggestion.proId })} disabled={!!busy} className="underline disabled:opacity-50">
              Offer
            </button>
          )}
        </p>
      )}

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
                  <span className="text-black font-medium">{e.type.replace("_", " ")}</span> · {clock(e.at)} · {e.actor ?? e.by}
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
            <Btn size="sm" variant="dark" onClick={() => openBooking(j.id)}>
              Booking page
            </Btn>
            {can("ops.dispatch") && j.status === "checked_in" && (
              <Btn size="sm" variant="light" busy={busy === "out"} onClick={() => run("out", { action: "event", jobId: j.id, type: "checked_out", note: "Checked out by ops" })}>
                Check out
              </Btn>
            )}
            {can("ops.dispatch") && j.status === "checked_out" && (
              <Btn size="sm" variant="light" busy={busy === "done"} onClick={() => run("done", { action: "event", jobId: j.id, type: "completed", note: "Completed by ops" })}>
                Mark done
              </Btn>
            )}
            {can("ops.dispatch", "ops.bookings") && ["new", "assigned", "en_route"].includes(j.status) && (
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

type Fit = { p: OpsPro; why: string }

/**
 * Assign a pro, or (for an unassigned visit) offer it to one: she accepts or declines in the pro
 * app. One menu, two groups. Used on the board and on the booking page.
 */
export function ProPicker({ job, pro, fits, disabled, onPick, className }: { job: OpsJob | Job; pro?: OpsPro; fits: Fit[]; disabled?: boolean; onPick: (action: "assign" | "offer", proId: string | null) => void; className?: string }) {
  const canOffer = job.status === "new" && !job.proId
  const label = (f: Fit) => `${f.p.name}${f.why ? ` (${f.why})` : ""}`
  return (
    <select
      value={job.proId ? `assign:${job.proId}` : ""}
      disabled={disabled}
      onChange={(e) => {
        const [action, proId] = e.target.value.split(":") as ["assign" | "offer" | "", string]
        onPick(action === "offer" ? "offer" : "assign", proId || null)
      }}
      className={cn("flex-1 min-w-0 h-11 rounded-2xl border border-black/10 bg-[oklch(0.975_0.008_80)] px-3 text-sm outline-none focus:border-black disabled:opacity-60", className)}
      aria-label="Assign or offer to a pro"
    >
      <option value="">{pro ? "Unassign" : "Assign or offer…"}</option>
      <optgroup label="Assign to">
        {pro && !fits.some((f) => f.p.id === pro.id) && <option value={`assign:${pro.id}`}>{pro.name} (paused)</option>}
        {fits.map((f) => (
          <option key={f.p.id} value={`assign:${f.p.id}`}>
            {label(f)}
          </option>
        ))}
      </optgroup>
      {canOffer && (
        <optgroup label="Offer to (she accepts in the pro app)">
          {fits.map((f) => (
            <option key={f.p.id} value={`offer:${f.p.id}`}>
              {label(f)}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

/** "Offered to Sana · until 3:40 pm", with Withdraw. */
export function OfferLine({ offer, pros, busy, canWithdraw, onWithdraw }: { offer: OpsOffer; pros: OpsPro[]; busy: boolean; canWithdraw: boolean; onWithdraw: () => void }) {
  const name = pros.find((p) => p.id === offer.proId)?.name ?? offer.proId
  return (
    <p className="mt-2 flex items-center gap-2 text-xs rounded-2xl bg-sky-50 text-sky-900 px-3 py-2">
      <span className="flex-1 min-w-0">
        Offered to <b>{name}</b> · waiting for her answer until {clock(offer.expiresAt)}
      </span>
      {canWithdraw && (
        <button onClick={onWithdraw} disabled={busy} className="underline disabled:opacity-50">
          Withdraw
        </button>
      )}
    </p>
  )
}
