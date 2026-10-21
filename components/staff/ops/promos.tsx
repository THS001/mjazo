"use client"

import { useEffect, useState } from "react"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, Badge, Btn, Empty, pkr } from "../kit"
import { inputCls } from "./context"

// Promo codes. Checkout starts taking them with the client account (platform stage 4); until then
// they can be set up and switched on or off here.

type Promo = { code: string; kind: "percent" | "fixed"; value: number; minOrder: number; maxDiscount: number | null; maxUses: number | null; perCustomer: number; startsAt: string | null; endsAt: string | null; active: boolean; note: string; createdBy: string | null; updatedBy: string | null; updatedAt: string; uses: number; given: number }
type Draft = { code: string; kind: "percent" | "fixed"; value: string; minOrder: string; maxDiscount: string; maxUses: string; perCustomer: string; startsAt: string; endsAt: string; active: boolean; note: string }

const blank: Draft = { code: "", kind: "percent", value: "", minOrder: "", maxDiscount: "", maxUses: "", perCustomer: "1", startsAt: "", endsAt: "", active: true, note: "" }
const toDraft = (p: Promo): Draft => ({ code: p.code, kind: p.kind, value: String(p.value), minOrder: p.minOrder ? String(p.minOrder) : "", maxDiscount: p.maxDiscount ? String(p.maxDiscount) : "", maxUses: p.maxUses ? String(p.maxUses) : "", perCustomer: String(p.perCustomer), startsAt: p.startsAt?.slice(0, 10) ?? "", endsAt: p.endsAt?.slice(0, 10) ?? "", active: p.active, note: p.note })
const num = (s: string) => (s.trim() ? Number(s) : null)
/** Dates are whole Karachi days: a code runs from the start of its first day to the end of its last. */
const toBody = (d: Draft) => ({
  code: d.code,
  kind: d.kind,
  value: Number(d.value),
  minOrder: num(d.minOrder) ?? 0,
  maxDiscount: num(d.maxDiscount),
  maxUses: num(d.maxUses),
  perCustomer: num(d.perCustomer) ?? 1,
  startsAt: d.startsAt ? `${d.startsAt}T00:00:00+05:00` : null,
  endsAt: d.endsAt ? new Date(Date.parse(`${d.endsAt}T00:00:00+05:00`) + 86400000).toISOString() : null,
  active: d.active,
  note: d.note,
})

export function PromosTab() {
  const [list, setList] = useState<Promo[] | null>(null)
  const [editing, setEditing] = useState<{ draft: Draft; create: boolean } | null>(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  useEffect(() => {
    api<{ promos: Promo[] }>("/api/ops/promos").then((r) => setList(r.promos), (e) => setError((e as Error).message))
  }, [])
  const save = async (action: "create" | "update", d: Draft, key = "save") => {
    setBusy(key)
    setError("")
    try {
      setList((await api<{ promos: Promo[] }>("/api/ops/promos", { action, promo: toBody(d) })).promos)
      setEditing(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  const now = Date.now()
  const state = (p: Promo) => (!p.active ? "off" : p.endsAt && Date.parse(p.endsAt) <= now ? "ended" : p.startsAt && Date.parse(p.startsAt) > now ? "scheduled" : p.maxUses !== null && p.uses >= p.maxUses ? "used up" : "live")
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-3xl">Promo codes</h2>
          <p className="text-sm text-zinc-500 mt-1">Mjazo funds every discount: pros are paid on the full price. Checkout takes codes from the client-account release.</p>
        </div>
        <Btn onClick={() => setEditing(editing?.create ? null : { draft: blank, create: true })}>
          {editing?.create ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editing?.create ? "Close" : "New code"}
        </Btn>
      </div>
      {error && <p className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>}
      {editing && <PromoForm draft={editing.draft} create={editing.create} busy={busy === "save"} onCancel={() => setEditing(null)} onSave={(d) => save(editing.create ? "create" : "update", d)} />}
      {!list ? (
        <div className="h-32 rounded-3xl bg-black/[0.04] animate-pulse" />
      ) : !list.length ? (
        <Empty title="No promo codes yet" body="Make one for a launch, a festival or a partner." />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((p) => {
            const st = state(p)
            return (
              <article key={p.code} className={cn("rounded-3xl bg-white border border-black/[0.06] p-5", st !== "live" && "opacity-75")}>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-semibold text-lg">{p.code}</p>
                  <Badge className={st === "live" ? "bg-emerald-100 text-emerald-800" : st === "scheduled" ? "bg-sky-100 text-sky-800" : "bg-zinc-100 text-zinc-500"}>{st}</Badge>
                </div>
                <p className="mt-1 text-sm">
                  {p.kind === "percent" ? `${p.value}% off` : `${pkr(p.value)} off`}
                  {p.maxDiscount ? `, up to ${pkr(p.maxDiscount)}` : ""}
                  {p.minOrder ? ` on ${pkr(p.minOrder)}+` : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Used {p.uses}
                  {p.maxUses !== null ? ` of ${p.maxUses}` : ""} times · {pkr(p.given)} given · {p.perCustomer} per customer
                  {(p.startsAt || p.endsAt) && ` · ${p.startsAt ? new Date(p.startsAt).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }) : "now"} to ${p.endsAt ? new Date(Date.parse(p.endsAt) - 1).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }) : "no end"}`}
                </p>
                {p.note && <p className="mt-2 text-sm text-zinc-600">{p.note}</p>}
                <p className="mt-2 text-[11px] text-zinc-400">{p.updatedBy ? `Last changed by ${p.updatedBy}` : p.createdBy ? `Made by ${p.createdBy}` : ""}</p>
                <div className="mt-3 flex gap-2">
                  <Btn size="sm" variant="light" busy={busy === p.code} onClick={() => save("update", { ...toDraft(p), active: !p.active }, p.code)}>
                    {p.active ? "Switch off" : "Switch on"}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEditing({ draft: toDraft(p), create: false })}>
                    Edit
                  </Btn>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PromoForm({ draft, create, busy, onSave, onCancel }: { draft: Draft; create: boolean; busy: boolean; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState(draft)
  const set = (k: keyof Draft, v: string | boolean) => setD((x) => ({ ...x, [k]: v }))
  const digits = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value.replace(/\D/g, ""))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(d)
      }}
      className="rounded-3xl bg-white border border-black/[0.06] p-5 grid sm:grid-cols-3 gap-3"
    >
      <Label t="Code">
        <input className={cn(inputCls, "font-mono uppercase")} value={d.code} disabled={!create} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder="EID25" maxLength={20} />
      </Label>
      <Label t="Discount">
        <div className="flex gap-2">
          <select className={cn(inputCls, "w-28")} value={d.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="percent">%</option>
            <option value="fixed">PKR</option>
          </select>
          <input className={inputCls} inputMode="numeric" value={d.value} onChange={digits("value")} placeholder={d.kind === "percent" ? "10" : "500"} />
        </div>
      </Label>
      <Label t="Largest discount (PKR, optional)">
        <input className={inputCls} inputMode="numeric" value={d.maxDiscount} onChange={digits("maxDiscount")} />
      </Label>
      <Label t="Minimum order (PKR)">
        <input className={inputCls} inputMode="numeric" value={d.minOrder} onChange={digits("minOrder")} placeholder="0" />
      </Label>
      <Label t="Most uses in all (optional)">
        <input className={inputCls} inputMode="numeric" value={d.maxUses} onChange={digits("maxUses")} />
      </Label>
      <Label t="Uses per customer">
        <input className={inputCls} inputMode="numeric" value={d.perCustomer} onChange={digits("perCustomer")} />
      </Label>
      <Label t="First day (optional)">
        <input type="date" className={inputCls} value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
      </Label>
      <Label t="Last day (optional)">
        <input type="date" className={inputCls} value={d.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
      </Label>
      <Label t="Note (who it's for)">
        <input className={inputCls} value={d.note} onChange={(e) => set("note", e.target.value)} maxLength={300} />
      </Label>
      <label className="flex items-center gap-3 text-sm sm:col-span-3">
        <input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} className="w-5 h-5 accent-black" /> Switched on
      </label>
      <div className="sm:col-span-3 flex gap-2">
        <Btn busy={busy} disabled={!d.code || !d.value}>
          {create ? "Create code" : "Save changes"}
        </Btn>
        <Btn type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </form>
  )
}

const Label = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <label className="block text-xs text-zinc-500 space-y-1">
    <span>{t}</span>
    {children}
  </label>
)
