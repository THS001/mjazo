"use client"

import { useState } from "react"
import { KeyRound, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, Badge, Btn, Empty } from "../kit"
import type { OpsPro } from "./console"
import { useCatalog } from "@/components/cms/provider"

const inputCls = "w-full h-11 rounded-2xl border border-black/10 bg-white px-4 text-[16px] sm:text-sm outline-none focus:border-black"

export function ProsTab({ pros, reload }: { pros: OpsPro[]; reload: () => void }) {
  const { getArea, visibleCategories } = useCatalog()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState("")
  const update = async (key: string, body: unknown) => {
    setBusy(key)
    try {
      await api("/api/ops/pros", body)
      reload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  const catName = (slug: string) => visibleCategories.find((c) => c.slug === slug)?.name ?? slug
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-3xl">Pros</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {pros.filter((p) => p.status === "active").length} active · pros log in to the pro app at <span className="font-mono">/pro</span> with their phone and PIN.
          </p>
        </div>
        <Btn onClick={() => setAdding((a) => !a)}>{adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {adding ? "Close" : "Add a pro"}</Btn>
      </div>

      {adding && (
        <AddPro
          onDone={() => {
            setAdding(false)
            reload()
          }}
        />
      )}

      {!pros.length ? (
        <Empty title="No pros yet" body="Add pros here, or hire them from the Recruiting tab after their interview and practical test." />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {pros.map((p) => (
            <article key={p.id} className={cn("min-w-0 rounded-3xl bg-white border border-black/[0.06] p-5", p.status === "paused" && "opacity-60")}>
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-full bg-[var(--brand-soft)] text-[var(--brand-ink)] flex items-center justify-center font-serif text-lg shrink-0">{p.name[0]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-zinc-500">
                    {p.phone} · {getArea(p.area)?.name ?? p.area}
                  </p>
                </div>
                <Badge className={p.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"}>{p.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {p.women && <Badge className="bg-pink-50 text-pink-700">Women pro</Badge>}
                {p.skills.map((s) => (
                  <Badge key={s} className="bg-black/[0.04] text-zinc-700 normal-case tracking-normal font-medium">
                    {catName(s)}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <Btn size="sm" variant="light" busy={busy === `${p.id}:s`} onClick={() => update(`${p.id}:s`, { action: "update", id: p.id, status: p.status === "active" ? "paused" : "active" })}>
                  {p.status === "active" ? "Pause" : "Activate"}
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  busy={busy === `${p.id}:p`}
                  onClick={() => {
                    const pin = prompt(`New 4–6 digit PIN for ${p.name}`)
                    if (pin) update(`${p.id}:p`, { action: "pin", id: p.id, pin })
                  }}
                >
                  <KeyRound className="w-3.5 h-3.5" /> Reset PIN
                </Btn>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function AddPro({ onDone }: { onDone: () => void }) {
  const { areas, visibleCategories } = useCatalog()
  const [v, setV] = useState({ name: "", phone: "", area: "", skills: [] as string[], women: true, pin: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const toggle = (s: string) => setV((x) => ({ ...x, skills: x.skills.includes(s) ? x.skills.filter((y) => y !== s) : [...x.skills, s] }))
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError("")
        try {
          await api("/api/ops/pros", { action: "create", ...v })
          onDone()
        } catch (err) {
          setError((err as Error).message)
        } finally {
          setBusy(false)
        }
      }}
      className="rounded-3xl bg-white border border-black/[0.06] p-5 sm:p-6 grid sm:grid-cols-2 gap-4"
    >
      <input className={inputCls} placeholder="Full name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      <input className={inputCls} placeholder="Mobile (03xx xxxxxxx)" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value.replace(/[\s-]/g, "") })} />
      <select className={inputCls} value={v.area} onChange={(e) => setV({ ...v, area: e.target.value })}>
        <option value="">Home area…</option>
        {areas.map((a) => (
          <option key={a.slug} value={a.slug}>
            {a.name}
          </option>
        ))}
      </select>
      <input className={inputCls} placeholder="Login PIN (4–6 digits)" inputMode="numeric" value={v.pin} onChange={(e) => setV({ ...v, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
      <div className="sm:col-span-2">
        <p className="text-sm font-medium mb-2">Can do</p>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((c) => (
            <button type="button" key={c.slug} onClick={() => toggle(c.slug)} aria-pressed={v.skills.includes(c.slug)} className={cn("h-9 px-3.5 rounded-full border text-sm transition-colors", v.skills.includes(c.slug) ? "bg-black text-white border-black" : "border-black/15 hover:border-black/40")}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <input type="checkbox" checked={v.women} onChange={(e) => setV({ ...v, women: e.target.checked })} className="w-5 h-5 accent-black" />
        Woman pro (required for women&apos;s beauty and spa services)
      </label>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Btn busy={busy}>Add pro</Btn>
      </div>
    </form>
  )
}
