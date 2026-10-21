"use client"

import { useEffect, useState } from "react"
import { ChevronDown, KeyRound, Plus, ShieldCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { isVerified, VERIFICATION_ITEMS } from "@/lib/ops/types"
import { WINDOW_LABELS } from "@/lib/time"
import { api, Badge, Btn, Empty } from "../kit"
import type { OpsPro } from "./console"
import { inputCls, useOps } from "./context"
import { useCatalog } from "@/components/cms/provider"

export function ProsTab({ pros, reload }: { pros: OpsPro[]; reload: () => void }) {
  const { getArea, visibleCategories } = useCatalog()
  const { can } = useOps()
  const [adding, setAdding] = useState(false)
  const [profile, setProfile] = useState<string | null>(null)
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
        {can("ops.pros") && <Btn onClick={() => setAdding((a) => !a)}>{adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {adding ? "Close" : "Add a pro"}</Btn>}
      </div>

      <Zones />

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
                {isVerified(p) ? (
                  <Badge className="bg-emerald-50 text-emerald-700">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-800">
                    {VERIFICATION_ITEMS.filter((i) => p.verification?.[i.key]).length} of {VERIFICATION_ITEMS.length} checks
                  </Badge>
                )}
                {p.women && <Badge className="bg-pink-50 text-pink-700">Women pro</Badge>}
                {p.skills.map((s) => (
                  <Badge key={s} className="bg-black/[0.04] text-zinc-700 normal-case tracking-normal font-medium">
                    {catName(s)}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                Up to {p.dailyCap ?? 5} visits a day · {p.zones?.length ? `also covers ${p.zones.map((z) => getArea(z)?.name ?? z).join(", ")}` : "any area"} · {p.availability ? `works ${Object.keys(p.availability).length} days a week` : "every day, every window"}
                {p.timeOff?.length ? ` · ${p.timeOff.length} day${p.timeOff.length === 1 ? "" : "s"} off coming` : ""}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Btn size="sm" variant="dark" onClick={() => setProfile(profile === p.id ? null : p.id)} aria-expanded={profile === p.id}>
                  Profile <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", profile === p.id && "rotate-180")} />
                </Btn>
                {can("ops.pros") && (
                  <>
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
                  </>
                )}
              </div>
              {profile === p.id && <ProProfile pro={p} reload={reload} />}
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

// ---------------------------------------------------------------------------
// One pro's profile: the verification checklist, then her zones, cap, weekly windows, days off
// and commission. The CNIC is checked in person: only its last 4 digits are kept.
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function ProProfile({ pro, reload }: { pro: OpsPro; reload: () => void }) {
  const { areas, getArea } = useCatalog()
  const { can } = useOps()
  const [zones, setZones] = useState<string[]>(pro.zones ?? [])
  const [cap, setCap] = useState(String(pro.dailyCap ?? 5))
  const [commission, setCommission] = useState(String(Math.round((pro.commissionRate ?? 0.25) * 100)))
  const [avail, setAvail] = useState<Record<string, string[]> | null>(pro.availability ?? null)
  const [off, setOff] = useState("")
  const [last4, setLast4] = useState("")
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const post = async (key: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(key)
    setMsg(null)
    try {
      await api("/api/ops/pros", { id: pro.id, ...body })
      if (ok) setMsg({ tone: "ok", text: ok })
      reload()
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message })
    } finally {
      setBusy("")
    }
  }
  const toggleWindow = (day: string, w: string) =>
    setAvail((a) => {
      const base = a ?? Object.fromEntries(WEEKDAYS.map((_, i) => [String(i), [...WINDOW_LABELS]]))
      const cur = base[day] ?? []
      const next = { ...base, [day]: cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w] }
      if (!next[day].length) delete next[day]
      return next
    })
  const date = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
  return (
    <div className="mt-4 pt-4 border-t border-black/[0.06] space-y-5 text-sm">
      {msg && <p className={cn("rounded-2xl px-3 py-2", msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>{msg.text}</p>}
      <div>
        <p className="font-medium">Verification</p>
        <ul className="mt-2 space-y-2">
          {VERIFICATION_ITEMS.map((item) => {
            const done = pro.verification?.[item.key]
            return (
              <li key={item.key} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 mt-0.5 accent-black"
                  checked={Boolean(done)}
                  disabled={!can("ops.verify") || busy === item.key || (item.key === "cnic" && !done && !/^\d{4}$/.test(last4))}
                  onChange={(e) => post(item.key, { action: "verify", key: item.key, done: e.target.checked, last4: item.key === "cnic" && e.target.checked ? last4 : undefined })}
                  aria-label={item.label}
                />
                <span className="flex-1 min-w-0">
                  {item.label}
                  {done ? (
                    <span className="block text-xs text-zinc-500">
                      {done.last4 && `Card ending ${done.last4} · `}by {done.by}, {new Date(done.at).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}
                    </span>
                  ) : (
                    "hint" in item && <span className="block text-xs text-zinc-500">{item.hint}</span>
                  )}
                  {item.key === "cnic" && !done && can("ops.verify") && (
                    <input className={cn(inputCls, "h-9 mt-1.5 w-40")} inputMode="numeric" placeholder="Last 4 digits" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="CNIC last 4 digits" />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="space-y-3">
        <div>
          <p className="font-medium">Also travels to</p>
          <p className="text-xs text-zinc-500">Besides {getArea(pro.area)?.name ?? pro.area}. None picked: any area.</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {areas
              .filter((a) => a.slug !== pro.area)
              .map((a) => (
                <button key={a.slug} type="button" disabled={!can("ops.pros")} onClick={() => setZones((z) => (z.includes(a.slug) ? z.filter((x) => x !== a.slug) : [...z, a.slug]))} aria-pressed={zones.includes(a.slug)} className={cn("h-8 px-3 rounded-full border text-xs", zones.includes(a.slug) ? "bg-black text-white border-black" : "border-black/15")}>
                  {a.name}
                </button>
              ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-zinc-500">
            Visits a day (most)
            <input className={cn(inputCls, "mt-1 w-28")} inputMode="numeric" value={cap} disabled={!can("ops.pros")} onChange={(e) => setCap(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </label>
          {can("ops.money") && (
            <label className="text-xs text-zinc-500">
              Mjazo&apos;s commission (%)
              <input className={cn(inputCls, "mt-1 w-28")} inputMode="numeric" value={commission} onChange={(e) => setCommission(e.target.value.replace(/\D/g, "").slice(0, 2))} />
            </label>
          )}
        </div>
        <div>
          <p className="font-medium">Weekly windows</p>
          <p className="text-xs text-zinc-500">{avail ? "She's offered only in the ticked windows." : "Not set: every day, every window."}</p>
          <div className="mt-2 overflow-x-auto" data-lenis-prevent>
            <table className="text-xs">
              <thead>
                <tr>
                  <th />
                  {WINDOW_LABELS.map((w) => (
                    <th key={w} className="px-1 pb-1 font-normal text-zinc-500 whitespace-nowrap">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((d, i) => (
                  <tr key={d}>
                    <td className="pr-2 text-zinc-500">{d}</td>
                    {WINDOW_LABELS.map((w) => (
                      <td key={w} className="text-center px-1">
                        <input type="checkbox" className="w-4 h-4 accent-black" disabled={!can("ops.pros")} checked={avail ? Boolean(avail[String(i)]?.includes(w)) : true} onChange={() => toggleWindow(String(i), w)} aria-label={`${d} ${w}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {avail && can("ops.pros") && (
            <button type="button" className="text-xs underline mt-1" onClick={() => setAvail(null)}>
              Clear: every day, every window
            </button>
          )}
        </div>
        {can("ops.pros") && (
          <Btn
            size="sm"
            busy={busy === "profile"}
            onClick={() =>
              post(
                "profile",
                { action: "profile", zones, dailyCap: Number(cap) || 1, availability: avail, ...(can("ops.money") && Number(commission) / 100 !== (pro.commissionRate ?? 0.25) ? { commissionRate: Number(commission) / 100 } : {}) },
                "Saved. Route Brain and checkout use it from now on.",
              )
            }
          >
            Save schedule
          </Btn>
        )}
      </div>

      <div>
        <p className="font-medium">Days off</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(pro.timeOff ?? []).map((d) => (
            <span key={d} className="h-8 pl-3 pr-1 rounded-full bg-black/[0.05] text-xs inline-flex items-center gap-1">
              {date(d)}
              {can("ops.pros") && (
                <button type="button" aria-label={`Remove ${d}`} className="w-6 h-6 rounded-full hover:bg-black/10 flex items-center justify-center" onClick={() => post(`off-${d}`, { action: "profile", timeOff: { remove: [d] } })}>
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {!pro.timeOff?.length && <span className="text-xs text-zinc-500">None coming up.</span>}
        </div>
        {can("ops.pros") && (
          <div className="flex gap-2 mt-2">
            <input type="date" className={cn(inputCls, "h-9 w-44")} value={off} onChange={(e) => setOff(e.target.value)} aria-label="Day off" />
            <Btn size="sm" variant="light" disabled={!off} busy={busy === "off"} onClick={() => post("off", { action: "profile", timeOff: { add: [off] } }).then(() => setOff(""))}>
              Add day off
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zones and capacity: each area's daily cap, the pros who cover it, and today's and tomorrow's load.
// ---------------------------------------------------------------------------

type ZoneRow = { slug: string; name: string; dailyCap: number | null; homePros: number; coverPros: number; today: number; tomorrow: number }

function Zones() {
  const { can } = useOps()
  const [open, setOpen] = useState(false)
  const [zones, setZones] = useState<ZoneRow[] | null>(null)
  const [caps, setCaps] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  useEffect(() => {
    if (open && !zones) api<{ zones: ZoneRow[] }>("/api/ops/pros?zones=1").then((r) => setZones(r.zones), (e) => setError((e as Error).message))
  }, [open, zones])
  const save = async (slug: string) => {
    setBusy(slug)
    setError("")
    try {
      const v = caps[slug]?.trim()
      setZones((await api<{ zones: ZoneRow[] }>("/api/ops/pros", { action: "zone_cap", slug, cap: v ? Number(v) : null })).zones)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }
  return (
    <section className="rounded-3xl bg-white border border-black/[0.06]">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full p-5 flex items-center gap-3 text-left">
        <span className="flex-1">
          <span className="font-semibold">Zones and capacity</span>
          <span className="block text-xs text-zinc-500">Daily caps per area (checkout and Route Brain respect them), and who covers each area.</span>
        </span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          {!zones ? (
            <div className="h-24 rounded-2xl bg-black/[0.04] animate-pulse" />
          ) : (
            <div className="overflow-x-auto" data-lenis-prevent>
              <table className="w-full text-sm min-w-[560px]">
                <thead className="text-xs text-zinc-500 text-left">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Area</th>
                    <th className="py-2 pr-3 font-medium text-right">Pros based here</th>
                    <th className="py-2 pr-3 font-medium text-right">Pros covering</th>
                    <th className="py-2 pr-3 font-medium text-right">Today</th>
                    <th className="py-2 pr-3 font-medium text-right">Tomorrow</th>
                    <th className="py-2 font-medium">Daily cap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {zones.map((z) => (
                    <tr key={z.slug}>
                      <td className="py-2 pr-3">{z.name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{z.homePros}</td>
                      <td className={cn("py-2 pr-3 text-right tabular-nums", !z.coverPros && "text-red-600 font-medium")}>{z.coverPros}</td>
                      <td className={cn("py-2 pr-3 text-right tabular-nums", z.dailyCap !== null && z.today >= z.dailyCap && "text-amber-700 font-medium")}>{z.today}</td>
                      <td className={cn("py-2 pr-3 text-right tabular-nums", z.dailyCap !== null && z.tomorrow >= z.dailyCap && "text-amber-700 font-medium")}>{z.tomorrow}</td>
                      <td className="py-2">
                        <div className="flex gap-1.5">
                          <input className={cn(inputCls, "h-9 w-24 px-3")} inputMode="numeric" placeholder="No cap" disabled={!can("ops.pros")} value={caps[z.slug] ?? (z.dailyCap === null ? "" : String(z.dailyCap))} onChange={(e) => setCaps({ ...caps, [z.slug]: e.target.value.replace(/\D/g, "").slice(0, 3) })} aria-label={`Daily cap for ${z.name}`} />
                          {can("ops.pros") && caps[z.slug] !== undefined && caps[z.slug] !== (z.dailyCap === null ? "" : String(z.dailyCap)) && (
                            <Btn size="sm" variant="light" busy={busy === z.slug} onClick={() => save(z.slug)}>
                              Save
                            </Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
