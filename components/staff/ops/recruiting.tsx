"use client"

import { useState } from "react"
import { Copy, MessageCircle, Sparkles } from "lucide-react"
import { SKILLS } from "@/lib/content"
import type { Application, Scores } from "@/lib/ops/types"
import { cn } from "@/lib/utils"
import { api, ago, Badge, Btn, Empty, usePoll, waTo } from "../kit"
import { useCatalog } from "@/components/cms/provider"

type App = Application & { link: string }
type Forecast = { area: string; areaName: string; category: string; categoryName: string; bookings28d: number; needed: number; have: number; gap: number }

const STAGE: Record<Application["status"], { label: string; cls: string }> = {
  new: { label: "Applied", cls: "bg-zinc-100 text-zinc-700" },
  interviewing: { label: "Interviewing", cls: "bg-sky-100 text-sky-800" },
  interviewed: { label: "Interviewed", cls: "bg-violet-100 text-violet-800" },
  test_booked: { label: "Test booked", cls: "bg-[var(--brand-soft)] text-[var(--brand-ink)]" },
  hired: { label: "Hired", cls: "bg-emerald-100 text-emerald-800" },
  declined: { label: "Declined", cls: "bg-zinc-100 text-zinc-400" },
}
const SCORE_LABEL: Record<keyof Scores, string> = { experience: "Experience", skills: "Skills", hygiene: "Hygiene", availability: "Availability", transport: "Transport", communication: "Communication" }
const skillName = (s: string) => SKILLS.find((x) => x.id === s)?.en ?? s

export function Recruiting() {
  const [data, setData] = useState<{ applications: App[]; forecast: Forecast[] } | null>(null)
  const [filter, setFilter] = useState<"open" | "all">("open")
  const load = async () => setData(await api<{ applications: App[]; forecast: Forecast[] }>("/api/ops/recruiting").catch(() => data))
  usePoll(load, 30000)
  if (!data) return <div className="h-64 rounded-3xl bg-black/[0.04] animate-pulse" />
  const apps = data.applications.filter((a) => filter === "all" || !["hired", "declined"].includes(a.status))
  return (
    <div className="space-y-10">
      <section>
        <p className="flex items-center gap-2 text-sm text-[var(--brand-ink)]">
          <Sparkles className="w-4 h-4" /> Recruiter Agent · demand forecast
        </p>
        <h2 className="font-serif text-3xl mt-1">Where we need pros</h2>
        <p className="text-sm text-zinc-500 mt-1">From the last 28 days of bookings, assuming about 3 visits per pro per day with 25% headroom.</p>
        {!data.forecast.length ? (
          <Empty className="mt-4" title="Not enough bookings yet" body="The forecast fills in as bookings arrive." />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-3xl bg-white border border-black/[0.06]" data-lenis-prevent>
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-left text-xs text-zinc-500">
                <tr className="border-b border-black/[0.06]">
                  <th className="font-medium px-5 py-3">Area</th>
                  <th className="font-medium px-3 py-3">Service</th>
                  <th className="font-medium px-3 py-3 text-right">Bookings (28d)</th>
                  <th className="font-medium px-3 py-3 text-right">Pros needed</th>
                  <th className="font-medium px-3 py-3 text-right">Have</th>
                  <th className="font-medium px-5 py-3 text-right">Gap</th>
                </tr>
              </thead>
              <tbody>
                {data.forecast.map((f) => (
                  <tr key={`${f.area}${f.category}`} className="border-b border-black/[0.04] last:border-0">
                    <td className="px-5 py-3 font-medium">{f.areaName}</td>
                    <td className="px-3 py-3">{f.categoryName}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{f.bookings28d}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{f.needed}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{f.have}</td>
                    <td className="px-5 py-3 text-right">{f.gap > 0 ? <Badge className="bg-red-100 text-red-700">hire {f.gap}</Badge> : <span className="text-emerald-600">✓</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-serif text-3xl">Applicants</h2>
            <p className="text-sm text-zinc-500 mt-1">Each applicant gets an AI interview link straight after applying. A person reviews every interview and decides.</p>
          </div>
          <div className="inline-flex rounded-full bg-black/[0.05] p-1 text-sm">
            {(["open", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("h-9 px-4 rounded-full", filter === f ? "bg-black text-white" : "text-zinc-600")}>
                {f === "open" ? "In progress" : "All"}
              </button>
            ))}
          </div>
        </div>
        {!apps.length ? (
          <Empty className="mt-4" title="No applicants here" body="Applications from /partner/apply appear here." />
        ) : (
          <div className="grid lg:grid-cols-2 gap-3 mt-4">
            {apps.map((a) => (
              <Applicant key={a.id} app={a} reload={load} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Applicant({ app: a, reload }: { app: App; reload: () => void }) {
  const { getArea } = useCatalog()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState("")
  const [copied, setCopied] = useState(false)
  const avg = a.scores ? Object.values(a.scores).reduce((s, n) => s + n, 0) / 6 : null
  const act = async (key: string, body: Record<string, unknown>) => {
    setBusy(key)
    try {
      await api("/api/ops/recruiting", { id: a.id, ...body })
      reload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  const invite = `Assalam o Alaikum ${a.name.split(" ")[0]}! Thank you for applying to Mjazo. Please take your short interview (about 10 minutes) here: ${a.link}`
  return (
    <article className="min-w-0 rounded-3xl bg-white border border-black/[0.06] p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg leading-tight">{a.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {getArea(a.area)?.name ?? a.area} · {a.phone} · {a.experience} yrs · applied {ago(a.createdAt)}
          </p>
        </div>
        {avg !== null && (
          <div className="text-right shrink-0">
            <p className="font-serif text-3xl leading-none">{avg.toFixed(1)}</p>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1">AI score / 5</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <Badge className={STAGE[a.status].cls}>{STAGE[a.status].label}</Badge>
        {a.skills.map((s) => (
          <Badge key={s} className="bg-black/[0.04] text-zinc-700 normal-case tracking-normal font-medium">
            {skillName(s)}
          </Badge>
        ))}
      </div>

      {a.scores && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-4">
          {(Object.keys(SCORE_LABEL) as (keyof Scores)[]).map((k) => (
            <div key={k}>
              <p className="text-[11px] text-zinc-500 flex justify-between">
                {SCORE_LABEL[k]} <span className="text-black font-medium">{a.scores![k]}</span>
              </p>
              <div className="h-1.5 rounded-full bg-black/[0.06] mt-1 overflow-hidden">
                <div className={cn("h-full rounded-full", a.scores![k] >= 4 ? "bg-emerald-500" : a.scores![k] >= 3 ? "bg-[var(--brand)]" : "bg-red-400")} style={{ width: `${(a.scores![k] / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {a.summary && <p className="text-sm text-zinc-700 mt-4 leading-relaxed">{a.summary}</p>}
      {(a.strengths?.length || a.concerns?.length) && (
        <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
          {!!a.strengths?.length && (
            <ul className="space-y-1">
              {a.strengths.map((s) => (
                <li key={s} className="text-emerald-800">
                  + {s}
                </li>
              ))}
            </ul>
          )}
          {!!a.concerns?.length && (
            <ul className="space-y-1">
              {a.concerns.map((s) => (
                <li key={s} className="text-red-700">
                  – {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {a.testSlot && <p className="mt-3 text-sm font-medium">Practical test: {a.testSlot}</p>}

      {open && a.interview?.length ? (
        <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl bg-[oklch(0.975_0.008_80)] p-4 space-y-2 text-sm" data-lenis-prevent>
          {a.interview.map((t, i) => (
            <p key={i} dir="auto" className={cn(t.role === "assistant" ? "text-zinc-500" : "text-black")}>
              <b>{t.role === "assistant" ? "AI" : a.name.split(" ")[0]}:</b> {t.text}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mt-5">
        {["new", "interviewing"].includes(a.status) && (
          <>
            <a href={waTo(a.phone, invite)} target="_blank" rel="noreferrer" className="h-9 px-3.5 rounded-full bg-[#25D366] text-foreground inline-flex items-center gap-1.5 text-[13px] font-medium">
              <MessageCircle className="w-3.5 h-3.5" /> Send interview link
            </a>
            <Btn
              size="sm"
              variant="light"
              onClick={async () => {
                await navigator.clipboard.writeText(a.link).catch(() => {})
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy link"}
            </Btn>
          </>
        )}
        {!!a.interview?.length && (
          <Btn size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide transcript" : "Transcript"}
          </Btn>
        )}
        {!["hired", "declined"].includes(a.status) && (
          <>
            <Btn
              size="sm"
              busy={busy === "hire"}
              onClick={() => {
                const pin = prompt(`Hire ${a.name}? Set their 4–6 digit pro app PIN:`)
                if (pin) act("hire", { action: "hire", pin })
              }}
            >
              Hire
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              className="text-red-600"
              busy={busy === "decline"}
              onClick={() => {
                const note = prompt("Reason (kept internal)?")
                if (note !== null) act("decline", { action: "status", status: "declined", note })
              }}
            >
              Decline
            </Btn>
          </>
        )}
      </div>
    </article>
  )
}
