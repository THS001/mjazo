"use client"

import { useEffect, useState } from "react"
import { MessageCircle, Phone } from "lucide-react"
import { cn } from "@/lib/utils"
import { ago, api, Badge, Btn, Empty, waTo } from "../kit"
import { inputCls } from "./context"

// The requests inbox: Plus, gift card, referral and Home Pulse enquiries (and the website's other
// enquiries and WhatsApp requests) that used to reach only the ops email.

type Item = { id: string; createdAt: string; kind: string; name: string; phone: string; email?: string; message?: string; details?: Record<string, unknown>; status: "new" | "contacted" | "done" | "declined"; note: string | null; handledBy: string | null; updatedAt: string | null }

const KINDS: Record<string, { label: string; cls: string }> = {
  plus: { label: "Plus", cls: "bg-[var(--brand-soft)] text-[var(--brand-ink)]" },
  gift: { label: "Gift card", cls: "bg-pink-100 text-pink-800" },
  referral: { label: "Referral", cls: "bg-violet-100 text-violet-800" },
  pulse: { label: "Home Pulse", cls: "bg-emerald-100 text-emerald-800" },
  wedding: { label: "Wedding", cls: "bg-rose-100 text-rose-800" },
  business: { label: "Business", cls: "bg-sky-100 text-sky-800" },
  request: { label: "WhatsApp request", cls: "bg-indigo-100 text-indigo-800" },
}
const FILTERS = [
  { id: "main", label: "Plus, gifts, referrals, Home Pulse", kinds: ["plus", "gift", "referral", "pulse"] },
  { id: "plus", label: "Plus", kinds: ["plus"] },
  { id: "gift", label: "Gift cards", kinds: ["gift"] },
  { id: "referral", label: "Referrals", kinds: ["referral"] },
  { id: "pulse", label: "Home Pulse", kinds: ["pulse"] },
  { id: "other", label: "Everything else", kinds: null },
] as const
const OPEN = ["new", "contacted"]

/** A short, readable line for each detail the form sent (lists joined, objects summarised). */
const detailLines = (d?: Record<string, unknown>) =>
  Object.entries(d ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => [k.replace(/([A-Z])/g, " $1").toLowerCase(), Array.isArray(v) ? v.join(" · ") : typeof v === "object" ? Object.entries(v as object).map(([a, b]) => `${a}: ${String(b)}`).join(", ") : String(v)] as const)

export function RequestsInbox() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("main")
  const [open, setOpen] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    api<{ items: Item[] }>("/api/ops/requests").then((r) => setItems(r.items), (e) => setError((e as Error).message))
  }, [])
  const f = FILTERS.find((x) => x.id === filter)!
  const main = FILTERS[0].kinds as readonly string[]
  const inFilter = (i: Item) => (f.kinds ? (f.kinds as readonly string[]).includes(i.kind) : !main.includes(i.kind))
  const shown = (items ?? []).filter((i) => inFilter(i) && (!open || OPEN.includes(i.status)))
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl">Requests</h2>
        <p className="text-sm text-zinc-500 mt-1">Enquiries from the website in the last 90 days. Reply on WhatsApp or by phone, then mark how far you got.</p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS.map((x) => {
          const n = (items ?? []).filter((i) => (x.kinds ? (x.kinds as readonly string[]).includes(i.kind) : !main.includes(i.kind)) && OPEN.includes(i.status)).length
          return (
            <button key={x.id} onClick={() => setFilter(x.id)} aria-pressed={filter === x.id} className={cn("h-9 px-3.5 rounded-full border text-sm", filter === x.id ? "bg-black text-white border-black" : "border-black/15 bg-white hover:border-black/40")}>
              {x.label} <span className="opacity-60">· {n}</span>
            </button>
          )
        })}
        <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="w-4 h-4 accent-black" /> Open only
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!items ? (
        <div className="h-40 rounded-3xl bg-black/[0.04] animate-pulse" />
      ) : !shown.length ? (
        <Empty title={open ? "Nothing open here" : "No requests here"} body="Plus, gift card, referral and Home Pulse enquiries from the website land here." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {shown.map((i) => (
            <RequestCard key={i.id} item={i} onSaved={setItems} />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestCard({ item: i, onSaved }: { item: Item; onSaved: (items: Item[]) => void }) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const kind = KINDS[i.kind] ?? { label: i.kind, cls: "bg-zinc-100 text-zinc-700" }
  const save = async (status: Item["status"]) => {
    setBusy(status)
    setError("")
    try {
      onSaved((await api<{ items: Item[] }>("/api/ops/requests", { id: i.id, status, note: note.trim() || undefined })).items)
      setNote("")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  return (
    <article className={cn("rounded-3xl bg-white border p-5 min-w-0", i.status === "new" ? "border-amber-200" : "border-black/[0.06]")}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={kind.cls}>{kind.label}</Badge>
        <Badge className={i.status === "new" ? "bg-amber-100 text-amber-900" : i.status === "contacted" ? "bg-sky-100 text-sky-800" : "bg-zinc-100 text-zinc-500"}>{i.status}</Badge>
        <span className="ml-auto text-xs text-zinc-400">
          {ago(i.createdAt)} · <span className="font-mono">{i.id}</span>
        </span>
      </div>
      <p className="mt-3 font-semibold">{i.name}</p>
      <p className="mt-1 flex flex-wrap gap-3 text-sm">
        <a className="inline-flex items-center gap-1.5 underline" href={`tel:${i.phone}`}>
          <Phone className="w-4 h-4 text-zinc-400" /> {i.phone}
        </a>
        <a className="inline-flex items-center gap-1.5 underline" target="_blank" rel="noreferrer" href={waTo(i.phone, `Assalam o Alaikum ${i.name.split(" ")[0]}, this is Mjazo about your ${kind.label.toLowerCase()} request.`)}>
          <MessageCircle className="w-4 h-4 text-zinc-400" /> WhatsApp
        </a>
        {i.email && <a className="underline" href={`mailto:${i.email}`}>{i.email}</a>}
      </p>
      {i.message && <p className="mt-2 text-sm text-zinc-700 whitespace-pre-line">{i.message}</p>}
      {detailLines(i.details).length > 0 && (
        <dl className="mt-2 space-y-0.5 text-xs text-zinc-500">
          {detailLines(i.details).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="shrink-0 capitalize">{k}:</dt>
              <dd className="min-w-0 break-words text-zinc-700">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {i.handledBy && (
        <p className="mt-3 text-xs text-zinc-500">
          {i.status} by {i.handledBy}
          {i.updatedAt && ` · ${ago(i.updatedAt)}`}
          {i.note && ` · “${i.note}”`}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <input className={cn(inputCls, "h-9 flex-1 min-w-[10rem]")} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
        {i.status !== "contacted" && (
          <Btn size="sm" variant="light" busy={busy === "contacted"} onClick={() => save("contacted")}>
            Contacted
          </Btn>
        )}
        {i.status !== "done" && (
          <Btn size="sm" busy={busy === "done"} onClick={() => save("done")}>
            Done
          </Btn>
        )}
        {OPEN.includes(i.status) ? (
          <Btn size="sm" variant="ghost" busy={busy === "declined"} onClick={() => save("declined")}>
            Decline
          </Btn>
        ) : (
          <Btn size="sm" variant="ghost" busy={busy === "new"} onClick={() => save("new")}>
            Reopen
          </Btn>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </article>
  )
}
