"use client"

import { useEffect, useState } from "react"
import { Eye, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, Badge, Btn, Empty } from "../kit"
import { inputCls } from "./context"

// Mission control → Automations: switch each rule on or off, the auto-assign mode, the WhatsApp
// template each message uses, a preview of every message in English and Urdu, and the send log.
// Until a WhatsApp or email provider is set, messages are only written to the log (test mode).

type Mode = "off" | "suggest" | "auto"
type Rule = { key: string; label: string; description: string; enabled: boolean; marketing?: boolean; messages?: string[]; params?: Record<string, string[]>; config: { mode?: Mode; waTemplates?: Record<string, string> }; updatedBy: string | null; updatedAt: string | null }
type Msg = { id: number; rule: string; channel: string; recipient: string; template: string; subject?: string; body: string; lang: string; bookingId: string | null; status: string; attempts: number; error: string | null; createdAt: string; sentAt: string | null }
type Preview = { subject: string; text: string }
type Data = { rules: Rule[]; channels: { whatsapp: boolean; email: boolean; push: number }; testMode: boolean; log: Msg[]; previews: Record<string, { en: Preview; ur: Preview }> }
type Summary = { events: number; scheduled: Record<string, number | string>; sent: number; logged: number; failed: number; testMode: boolean }

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })
const STATUS_CLS: Record<string, string> = { sent: "bg-emerald-100 text-emerald-800", logged: "bg-sky-100 text-sky-800", queued: "bg-amber-100 text-amber-800", sending: "bg-amber-100 text-amber-800", failed: "bg-red-100 text-red-700", skipped: "bg-zinc-100 text-zinc-500" }

export function AutomationsTab() {
  const [data, setData] = useState<Data | null>(null)
  const [filter, setFilter] = useState({ status: "", rule: "" })
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [ran, setRan] = useState<Summary | null>(null)
  const load = () => {
    const sp = new URLSearchParams(Object.entries(filter).filter(([, v]) => v))
    return api<Data>(`/api/ops/automations?${sp}`).then(setData, (e) => setError((e as Error).message))
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])
  const save = async (r: Rule, change: { enabled: boolean; mode?: Mode; waTemplates?: Record<string, string> }) => {
    setBusy(r.key)
    setError("")
    try {
      const { rules } = await api<{ rules: Rule[] }>("/api/ops/automations", { action: "save", key: r.key, ...change })
      setData((d) => d && { ...d, rules })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  const runNow = async () => {
    setBusy("run")
    setError("")
    try {
      setRan((await api<{ result: Summary }>("/api/ops/automations", { action: "run" })).result)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-3xl">Automations</h2>
          <p className="text-sm text-zinc-500 mt-1">Messages to customers and pros, auto-assign and the weekly payout draft. People still approve every payout and every money move.</p>
        </div>
        <Btn busy={busy === "run"} onClick={runNow}>
          <Play className="w-4 h-4" /> Run now
        </Btn>
      </div>
      {error && <p className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>}
      {ran && (
        <p className="rounded-2xl bg-emerald-50 text-emerald-900 px-4 py-3 text-sm">
          Done: {ran.events} event{ran.events === 1 ? "" : "s"} handled, {ran.sent} sent, {ran.logged} logged{ran.failed ? `, ${ran.failed} failed` : ""}.
          {Object.entries(ran.scheduled).length > 0 && <span className="block text-xs mt-0.5">{Object.entries(ran.scheduled).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>}
        </p>
      )}
      {!data ? (
        <div className="h-40 rounded-3xl bg-black/[0.04] animate-pulse" />
      ) : (
        <>
          <Channels data={data} />
          <div className="grid lg:grid-cols-2 gap-3">
            {data.rules.map((r) => (
              <RuleCard key={r.key} rule={r} previews={data.previews} busy={busy === r.key} onSave={(c) => save(r, c)} />
            ))}
          </div>
          <Log data={data} filter={filter} setFilter={setFilter} />
        </>
      )}
    </div>
  )
}

function Channels({ data }: { data: Data }) {
  const c = data.channels
  const items = [
    { name: "WhatsApp", on: c.whatsapp, note: c.whatsapp ? "Template messages from the business number" : "Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID" },
    { name: "Email", on: c.email, note: c.email ? "Through Resend" : "Set RESEND_API_KEY and MESSAGES_FROM" },
    { name: "Push", on: c.push > 0, note: c.push ? `${c.push} phone${c.push === 1 ? "" : "s"} signed up (the apps)` : "When the Mjazo apps are out" },
  ]
  return (
    <section className="space-y-3">
      {data.testMode && (
        <p className="rounded-2xl bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          <b>Test mode.</b> No WhatsApp or email provider is set, so messages are only written to the log below. Nothing reaches customers.
        </p>
      )}
      <div className="grid sm:grid-cols-3 gap-3">
        {items.map((i) => (
          <div key={i.name} className="rounded-3xl bg-white border border-black/[0.06] p-4">
            <p className="flex items-center gap-2 font-medium">
              <span className={cn("w-2 h-2 rounded-full", i.on ? "bg-emerald-500" : "bg-zinc-300")} /> {i.name}
            </p>
            <p className="text-xs text-zinc-500 mt-1">{i.note}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Switch({ on, busy, onChange, label }: { on: boolean; busy?: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={cn("relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50", on ? "bg-emerald-500" : "bg-zinc-300")}
    >
      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  )
}

function RuleCard({ rule: r, previews, busy, onSave }: { rule: Rule; previews: Data["previews"]; busy: boolean; onSave: (c: { enabled: boolean; mode?: Mode; waTemplates?: Record<string, string> }) => void }) {
  const [open, setOpen] = useState<{ key: string; lang: "en" | "ur" } | null>(null)
  const [templates, setTemplates] = useState<Record<string, string>>(r.config.waTemplates ?? {})
  const dirty = (r.messages ?? []).some((m) => (templates[m] ?? "") !== (r.config.waTemplates?.[m] ?? ""))
  const mode: Mode = r.enabled ? (r.config.mode ?? "suggest") : "off"
  const p = open && previews[open.key]?.[open.lang]
  return (
    <article className={cn("rounded-3xl bg-white border border-black/[0.06] p-5", !r.enabled && "opacity-80")}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium flex items-center gap-2 flex-wrap">
            {r.label}
            {r.marketing && <Badge className="bg-violet-100 text-violet-800">opt-in</Badge>}
          </p>
          <p className="text-sm text-zinc-500 mt-0.5">{r.description}</p>
        </div>
        {r.key !== "autoAssign" && <Switch on={r.enabled} busy={busy} label={r.label} onChange={(on) => onSave({ enabled: on })} />}
      </div>
      {r.key === "autoAssign" && (
        <div className="mt-3 inline-flex rounded-full bg-black/[0.05] p-1 text-sm" role="radiogroup" aria-label="Auto-assign">
          {(["off", "suggest", "auto"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              disabled={busy}
              onClick={() => onSave(m === "off" ? { enabled: false } : { enabled: true, mode: m })}
              className={cn("px-4 h-8 rounded-full capitalize disabled:opacity-50", mode === m ? "bg-black text-white" : "text-zinc-600")}
            >
              {m === "auto" ? "Offer by itself" : m}
            </button>
          ))}
        </div>
      )}
      {(r.messages ?? []).map((m) => (
        <div key={m} className="mt-4 rounded-2xl bg-black/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-mono text-xs text-zinc-500 flex-1 min-w-0 truncate">{m}</span>
            {(["en", "ur"] as const).map((lang) => (
              <button key={lang} type="button" onClick={() => setOpen(open?.key === m && open.lang === lang ? null : { key: m, lang })} className={cn("inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-xs", open?.key === m && open.lang === lang ? "bg-black text-white" : "bg-white border border-black/10")}>
                <Eye className="w-3.5 h-3.5" /> {lang === "en" ? "English" : "اردو"}
              </button>
            ))}
          </div>
          {open?.key === m && p && (
            <div dir={open.lang === "ur" ? "rtl" : undefined} className="rounded-xl bg-white border border-black/[0.06] p-3 text-sm whitespace-pre-line">
              {p.subject && <p className="font-medium mb-1">{p.subject}</p>}
              {p.text}
            </div>
          )}
          <label className="block text-xs text-zinc-500">
            WhatsApp template name
            <input className={cn(inputCls, "h-9 mt-1 font-mono")} placeholder="e.g. booking_confirmed (blank: email or log only)" value={templates[m] ?? ""} onChange={(e) => setTemplates({ ...templates, [m]: e.target.value.trim().toLowerCase() })} />
          </label>
          {r.params?.[m] && (
            <p className="text-xs text-zinc-500">
              Parameters in order: {r.params[m].map((x, i) => `{{${i + 1}}} ${x}`).join(", ")}
            </p>
          )}
        </div>
      ))}
      {dirty && (
        <div className="mt-3 flex gap-2">
          <Btn size="sm" busy={busy} onClick={() => onSave({ enabled: r.enabled, waTemplates: templates })}>
            Save template names
          </Btn>
          <Btn size="sm" variant="light" onClick={() => setTemplates(r.config.waTemplates ?? {})}>
            Cancel
          </Btn>
        </div>
      )}
      {r.updatedBy && r.updatedAt && (
        <p className="text-xs text-zinc-400 mt-3">
          Changed by {r.updatedBy}, {when(r.updatedAt)}
        </p>
      )}
    </article>
  )
}

function Log({ data, filter, setFilter }: { data: Data; filter: { status: string; rule: string }; setFilter: (f: { status: string; rule: string }) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h3 className="font-serif text-2xl">Send log</h3>
        <div className="flex gap-2 flex-wrap">
          <select className={cn(inputCls, "w-auto h-9")} value={filter.rule} onChange={(e) => setFilter({ ...filter, rule: e.target.value })} aria-label="Rule">
            <option value="">Every rule</option>
            {data.rules.filter((r) => r.messages).map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <select className={cn(inputCls, "w-auto h-9")} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} aria-label="Status">
            <option value="">Any status</option>
            {Object.keys(STATUS_CLS).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!data.log.length ? (
        <Empty title="No messages yet" body="Booking confirmations, reminders and offers show up here as they go out (or are logged, in test mode)." />
      ) : (
        <ol className="rounded-3xl bg-white border border-black/[0.06] divide-y divide-black/[0.06]">
          {data.log.map((m) => (
            <li key={m.id} className="p-3 sm:p-4 text-sm grid sm:grid-cols-[9rem_8rem_1fr] gap-x-4 gap-y-1">
              <span className="text-xs text-zinc-500 tabular-nums">{when(m.createdAt)}</span>
              <span className="flex items-start gap-1.5 flex-wrap">
                <Badge className={STATUS_CLS[m.status] ?? "bg-zinc-100 text-zinc-600"}>{m.status}</Badge>
                <span className="text-xs text-zinc-500">{m.channel}</span>
              </span>
              <span className="min-w-0">
                <span className="font-medium">{m.rule || m.template}</span>
                <span className="text-xs text-zinc-500"> · {m.recipient}</span>
                {m.bookingId && <span className="font-mono text-xs text-zinc-500"> · {m.bookingId}</span>}
                <span dir={m.lang === "ur" ? "rtl" : undefined} className="block text-xs text-zinc-600 whitespace-pre-line break-words mt-0.5 line-clamp-3">
                  {m.body}
                </span>
                {m.error && <span className="block text-xs text-red-600 mt-0.5">{m.error}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
