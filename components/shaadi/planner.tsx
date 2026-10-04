"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, ArrowUp, CalendarHeart, Check, Loader2, MessageCircle, Plus, Send, Sparkles, Trash2, Users, Wand2 } from "lucide-react"
import { formatPKR } from "@/lib/catalog"
import { track } from "@/lib/site"
import { karachiNow, WINDOW_LABELS } from "@/lib/time"
import { LOOKS, PREP, ROLE_LABEL, computeSchedule, diffSchedules, emptyPlan, personMessage, to12h, uid, type Role, type Schedule, type ShaadiEvent, type ShaadiPlan } from "@/lib/shaadi"
import { cn } from "@/lib/utils"
import { EASE } from "@/components/site/primitives"
import { useCatalog, useSite } from "@/components/cms/provider"
import { Accent } from "@/components/cms/accent"
import type { ToolHero } from "@/lib/cms/types/pages/tools"

const KEY = "mjazo-shaadi"
const SHARED = "mjazo-shaadi-shared"
const EVENT_NAMES = ["Dholki", "Mayun", "Mehndi", "Baraat", "Nikkah", "Walima"]
const EXAMPLES = ["Mehndi on 12 Dec, baraat on 14 Dec with photos at 7:30 pm, walima on 15th. Bride, Ammi, 2 sisters and 6 cousins need glam.", "Nikkah 21 Nov at 4 pm, just me and my mother, soft glam for both", "Bride ki full mehndi, baraat pe bridal, 8 ladies ka soft glam"]
const INK = "#2a1416"
const GOLD = "#f4a437"
const PERSON_TINTS = ["#f6d9cf", "#f7e3b5", "#e7d9ee", "#d6e9e4", "#f3dbe2", "#dfe7f5", "#efe3d3", "#e4f0d6"]

type Msg = { role: "user" | "assistant"; text: string }

export function ShaadiPlanner({ hero }: { hero: ToolHero }) {
  const { whatsappLink } = useSite()
  const cat = useCatalog()
  const today = useMemo(() => karachiNow().date, [])
  const [plan, setPlan] = useState<ShaadiPlan>(emptyPlan)
  const [loaded, setLoaded] = useState(false)
  const [shared, setShared] = useState<Schedule | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [aiError, setAiError] = useState("")
  const [eventTab, setEventTab] = useState<string>("")
  const [sent, setSent] = useState<string | null>(null)

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(KEY) ?? "null")
      if (p?.events) setPlan(p)
      const s = JSON.parse(localStorage.getItem(SHARED) ?? "null")
      if (s?.events) setShared(s)
    } catch {}
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(KEY, JSON.stringify(plan))
    } catch {}
  }, [plan, loaded])

  const schedule = useMemo(() => computeSchedule(plan, today, cat), [plan, today, cat])
  const changes = useMemo(() => (shared ? diffSchedules(shared, schedule) : []), [shared, schedule])
  const sortedEvents = [...plan.events].sort((a, b) => a.date.localeCompare(b.date))
  const activeEvent = sortedEvents.find((e) => e.id === eventTab) ?? sortedEvents[0]
  const update = (fn: (p: ShaadiPlan) => void) =>
    setPlan((p) => {
      const n = structuredClone(p)
      fn(n)
      return n
    })

  const ask = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    setInput("")
    setAiError("")
    setMsgs((m) => [...m, { role: "user", text: t }])
    setBusy(true)
    track("shaadi_assist", { people: plan.people.length })
    try {
      const res = await fetch("/api/shaadi/assist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan, message: t, history: msgs.slice(-8) }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error === "ai_unavailable" ? "The AI planner is offline right now. You can build the plan below by hand, or WhatsApp us." : data.error ?? "Something went wrong")
      setPlan(data.plan)
      setMsgs((m) => [...m, { role: "assistant", text: data.reply }])
    } catch (e) {
      setAiError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const markShared = () => {
    setShared(schedule)
    try {
      localStorage.setItem(SHARED, JSON.stringify(schedule))
    } catch {}
  }

  return (
    <>
      {/* Hero + AI composer */}
      <section className="relative overflow-hidden text-white" style={{ background: `radial-gradient(120% 90% at 80% 0%, #5a2a2e 0%, ${INK} 55%)` }}>
        <div aria-hidden className="absolute -end-24 top-24 w-[28rem] h-[28rem] rounded-full blur-[110px] opacity-30" style={{ background: GOLD }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-32 sm:pt-40 pb-14">
          <p className="text-sm tracking-[0.2em] uppercase" style={{ color: GOLD }}>
            {hero.eyebrow}
          </p>
          <h1 className="font-serif text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95] mt-4 max-w-4xl">
            <Accent text={hero.title} style={{ color: GOLD }} />
          </h1>
          <p className="text-white/70 text-lg mt-6 max-w-2xl">{hero.sub}</p>

          <div className="mt-10 rounded-[28px] bg-white/[0.06] border border-white/15 backdrop-blur p-3 sm:p-4 max-w-3xl">
            {msgs.length > 0 && (
              <div className="max-h-72 overflow-y-auto space-y-2 p-2 mb-2" data-lenis-prevent>
                {msgs.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <p dir="auto" className={cn("max-w-[85%] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap", m.role === "user" ? "text-black rounded-ee-lg" : "bg-white/10 rounded-es-lg")} style={m.role === "user" ? { background: GOLD } : undefined}>
                      {m.text}
                    </p>
                  </div>
                ))}
                {busy && (
                  <p className="flex items-center gap-2 text-sm text-white/60 px-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Planning…
                  </p>
                )}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask(input)
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    ask(input)
                  }
                }}
                rows={2}
                dir="auto"
                placeholder={msgs.length ? "Change anything: “move baraat to the 15th”, “add 3 cousins for walima”…" : "Describe your shaadi in your own words, in English, Urdu or Roman Urdu…"}
                className="flex-1 min-h-14 max-h-40 resize-none bg-transparent px-3 py-2 text-[16px] outline-none placeholder:text-white/40"
              />
              <button disabled={busy || !input.trim()} aria-label="Send" className="w-12 h-12 shrink-0 rounded-full text-black flex items-center justify-center disabled:opacity-40" style={{ background: GOLD }}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
              </button>
            </form>
          </div>
          {aiError && (
            <p className="mt-3 text-sm text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {aiError}
            </p>
          )}
          {!msgs.length && (
            <div className="flex flex-wrap gap-2 mt-4 max-w-3xl">
              {EXAMPLES.map((x) => (
                <button key={x} onClick={() => ask(x)} className="text-start text-sm rounded-2xl border border-white/20 px-4 py-2 text-white/80 hover:border-white/60" dir="auto">
                  {x}
                </button>
              ))}
            </div>
          )}
          <p className="mt-6 text-xs text-white/45 max-w-2xl">AI assistant. A Mjazo wedding coordinator checks every plan before anything is booked. Prices come from the Mjazo menu; bridal is quoted.</p>
        </div>
      </section>

      {/* Workspace */}
      <section className="bg-[#fdf7f1]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid lg:grid-cols-[1fr_1.1fr] gap-6 items-start">
          {/* Editor */}
          <div className="space-y-4 min-w-0">
            <Card title="The plan" icon={CalendarHeart}>
              <input value={plan.title} onChange={(e) => update((p) => void (p.title = e.target.value.slice(0, 80)))} className={inputCls} aria-label="Plan name" />
            </Card>

            <Card title="Events" icon={CalendarHeart} action={<SmallBtn onClick={() => update((p) => void p.events.push({ id: uid("ev-"), name: EVENT_NAMES[p.events.length % EVENT_NAMES.length], date: "", readyBy: "19:00" }))}><Plus className="w-3.5 h-3.5" /> Add event</SmallBtn>}>
              {!plan.events.length && <p className="text-sm text-zinc-500">Add your events, from dholki to walima.</p>}
              <div className="space-y-3">
                {sortedEvents.map((e) => (
                  <EventRow key={e.id} e={e} today={today} onChange={(fn) => update((p) => fn(p.events.find((x) => x.id === e.id)!))} onRemove={() => update((p) => void (p.events = p.events.filter((x) => x.id !== e.id)))} />
                ))}
              </div>
              <datalist id="event-names">
                {EVENT_NAMES.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Card>

            <Card
              title={`Who needs glam (${plan.people.length})`}
              icon={Users}
              action={
                <div className="flex gap-2">
                  <SmallBtn onClick={() => update((p) => void p.people.push({ id: uid("p-"), name: p.people.some((x) => x.role === "bride") ? `Person ${p.people.length + 1}` : "Bride", role: p.people.some((x) => x.role === "bride") ? "family" : "bride", branch: "Family", looks: {}, prep: [] }))}>
                    <Plus className="w-3.5 h-3.5" /> Person
                  </SmallBtn>
                  <SmallBtn onClick={() => update((p) => { const n = p.people.filter((x) => x.role === "guest").length; for (let i = 1; i <= 5; i++) p.people.push({ id: uid("p-"), name: `Guest ${n + i}`, role: "guest", branch: "Family", looks: {}, prep: [] }) })}>
                    <Plus className="w-3.5 h-3.5" /> 5 guests
                  </SmallBtn>
                </div>
              }
            >
              <datalist id="branches">
                {[...new Set(["Bride's family", "Groom's family", ...plan.people.map((p) => p.branch)])].map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
              {!plan.people.length && <p className="text-sm text-zinc-500">Add the bride, family and guests. Family branches split the bill.</p>}
              <div className="space-y-2">
                {plan.people.map((p, i) => (
                  <div key={p.id} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1.2fr_0.8fr_1fr_auto] gap-2 items-center">
                    <span className="w-3 h-3 rounded-full" style={{ background: PERSON_TINTS[i % PERSON_TINTS.length] }} />
                    <input value={p.name} onChange={(e) => update((x) => void (x.people[i].name = e.target.value.slice(0, 60)))} className={cn(inputCls, "h-10")} aria-label="Name" />
                    <select value={p.role} onChange={(e) => update((x) => void (x.people[i].role = e.target.value as Role))} className={cn(inputCls, "h-10 col-start-2 sm:col-start-auto")} aria-label="Role">
                      {Object.entries(ROLE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <input value={p.branch} list="branches" onChange={(e) => update((x) => void (x.people[i].branch = e.target.value.slice(0, 40)))} className={cn(inputCls, "h-10 col-start-2 sm:col-start-auto")} aria-label="Family branch (who pays)" placeholder="Family branch" />
                    <button onClick={() => update((x) => void (x.people = x.people.filter((y) => y.id !== p.id)))} aria-label={`Remove ${p.name}`} className="w-10 h-10 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            {plan.events.length > 0 && plan.people.length > 0 && activeEvent && (
              <Card title="Looks for each event" icon={Wand2}>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 mb-4" data-lenis-prevent>
                  {sortedEvents.map((e) => (
                    <button key={e.id} onClick={() => setEventTab(e.id)} className={cn("h-9 px-4 rounded-full text-sm whitespace-nowrap", activeEvent.id === e.id ? "text-white" : "bg-white border border-black/10")} style={activeEvent.id === e.id ? { background: INK } : undefined}>
                      {e.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mb-4 text-xs">
                  <span className="text-zinc-500 self-center">Quick:</span>
                  {[
                    { label: "All guests: soft glam + hair", sel: "guest", set: ["soft-glam", "hair"] },
                    { label: "Family: party makeup + hair", sel: "family", set: ["party-makeup", "hair"] },
                    { label: "Bride: bridal + draping", sel: "bride", set: ["bridal", "draping"] },
                  ].map((q) => (
                    <button key={q.label} onClick={() => update((p) => p.people.filter((x) => x.role === q.sel).forEach((x) => (x.looks[activeEvent.id] = q.set)))} className="rounded-full border border-black/10 bg-white px-3 py-1.5 hover:border-black/40">
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {plan.people.map((p, i) => (
                    <div key={p.id}>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: PERSON_TINTS[i % PERSON_TINTS.length] }} />
                        {p.name}
                      </p>
                      <Chips options={LOOKS} value={p.looks[activeEvent.id] ?? []} onToggle={(k) => update((x) => void (x.people[i].looks[activeEvent.id] = toggleLook(x.people[i].looks[activeEvent.id] ?? [], k)))} />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {plan.people.length > 0 && (
              <Card title="Pre-wedding glow" icon={Sparkles} action={<select value={plan.prepWindow} onChange={(e) => update((p) => void (p.prepWindow = e.target.value))} className="h-9 rounded-full border border-black/10 bg-white px-3 text-[16px] sm:text-sm" aria-label="Prep visit time">{WINDOW_LABELS.map((w) => <option key={w}>{w}</option>)}</select>}>
                <p className="text-xs text-zinc-500 -mt-1 mb-3">Each service is booked in its ideal window before that person&apos;s first event, grouped into as few home visits as possible.</p>
                <div className="space-y-3">
                  {plan.people.map((p, i) => (
                    <div key={p.id}>
                      <p className="text-sm font-medium">{p.name}</p>
                      <Chips options={PREP} value={p.prep} onToggle={(k) => update((x) => void (x.people[i].prep = x.people[i].prep.includes(k) ? x.people[i].prep.filter((y) => y !== k) : [...x.people[i].prep, k]))} />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Live plan */}
          <div className="space-y-4 min-w-0 lg:sticky lg:top-24">
            <PlanView plan={plan} schedule={schedule} today={today} />
            {changes.length > 0 && (
              <div className="rounded-[28px] border-2 p-5" style={{ borderColor: GOLD, background: "#fff8e8" }}>
                <p className="font-semibold">What changed since you last shared</p>
                <ul className="mt-2 space-y-1 text-sm max-h-40 overflow-y-auto" data-lenis-prevent>
                  {changes.slice(0, 20).map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
                <p className="text-xs text-zinc-600 mt-3">Send each person their updated times below, then mark it as shared.</p>
              </div>
            )}
            {plan.people.length > 0 && schedule.events.length > 0 && (
              <div className="rounded-[28px] bg-white border border-black/[0.06] p-5">
                <p className="font-semibold">Send everyone their own times</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {plan.people.map((p) => (
                    <a key={p.id} href={p.phone ? `https://wa.me/${p.phone.replace(/\D/g, "").replace(/^0/, "92")}?text=${encodeURIComponent(personMessage(plan, schedule, p.id))}` : `https://wa.me/?text=${encodeURIComponent(personMessage(plan, schedule, p.id))}`} target="_blank" rel="noopener noreferrer" className="h-9 px-3.5 rounded-full bg-[#25D366] text-foreground text-[13px] inline-flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" /> {p.name}
                    </a>
                  ))}
                </div>
                <button onClick={markShared} className="mt-3 text-sm underline underline-offset-4 text-zinc-600">
                  {changes.length || !shared ? "Mark as shared with everyone" : "Everyone is up to date"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Send to coordinator */}
      <section className="text-white" style={{ background: INK }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <span className="w-16 h-16 rounded-full inline-flex items-center justify-center text-black" style={{ background: GOLD }}>
                  <Check className="w-8 h-8" />
                </span>
                <p className="font-serif text-4xl mt-6">Your plan is with our wedding coordinator</p>
                <p className="text-white/70 mt-3">
                  Reference <b className="font-mono">{sent}</b>. They&apos;ll check pros and timings and WhatsApp you to confirm before anything is booked. You can keep editing here and send it again.
                </p>
                <a href={whatsappLink(`Hi Mjazo! About my wedding plan ${sent}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex mt-6 h-12 px-6 rounded-full bg-[#25D366] text-foreground items-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Message the coordinator
                </a>
              </motion.div>
            ) : (
              <motion.div key="form" initial={false}>
                <SubmitForm plan={plan} setPlan={setPlan} schedule={schedule} onSent={setSent} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </>
  )
}

function toggleLook(cur: string[], k: string) {
  if (cur.includes(k)) return cur.filter((x) => x !== k)
  let next = [...cur, k]
  if (k === "combo") next = next.filter((x) => !["party-makeup", "soft-glam", "hair", "bridal"].includes(x))
  if (k === "bridal") next = next.filter((x) => !["party-makeup", "soft-glam", "hair", "combo"].includes(x))
  if (["party-makeup", "soft-glam", "hair"].includes(k)) next = next.filter((x) => x !== "combo" && x !== "bridal")
  if (k === "party-makeup") next = next.filter((x) => x !== "soft-glam")
  if (k === "soft-glam") next = next.filter((x) => x !== "party-makeup")
  return next
}

const inputCls = "w-full h-11 rounded-2xl border border-black/10 bg-white px-4 text-[16px] sm:text-sm outline-none focus:border-black"

function Card({ title, icon: Icon, action, children }: { title: string; icon: React.ComponentType<{ className?: string }>; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] bg-white border border-black/[0.06] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="font-serif text-2xl flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#b07a1c]" /> {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  )
}
function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="h-9 px-3.5 rounded-full border border-black/15 text-[13px] inline-flex items-center gap-1.5 hover:border-black/40 bg-white">
      {children}
    </button>
  )
}
function Chips({ options, value, onToggle }: { options: Record<string, { label: string }>; value: string[]; onToggle: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {Object.entries(options).map(([k, o]) => (
        <button key={k} onClick={() => onToggle(k)} aria-pressed={value.includes(k)} className={cn("h-8 px-3 rounded-full text-[13px] border transition-colors", value.includes(k) ? "text-white border-transparent" : "bg-white border-black/10 hover:border-black/30")} style={value.includes(k) ? { background: INK } : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function EventRow({ e, today, onChange, onRemove }: { e: ShaadiEvent; today: string; onChange: (fn: (x: ShaadiEvent) => void) => void; onRemove: () => void }) {
  return (
    <div className="rounded-2xl bg-[#fdf7f1] p-3 grid grid-cols-2 sm:grid-cols-[1fr_1fr_0.8fr_auto] gap-2 items-end">
      <label className="block col-span-2 sm:col-span-1">
        <span className="text-[11px] text-zinc-500">Event</span>
        <input value={e.name} list="event-names" onChange={(x) => onChange((v) => void (v.name = x.target.value.slice(0, 40)))} className={cn(inputCls, "h-10")} />
      </label>
      <label className="block">
        <span className="text-[11px] text-zinc-500">Date</span>
        <input type="date" min={today} value={e.date} onChange={(x) => onChange((v) => void (v.date = x.target.value))} className={cn(inputCls, "h-10 px-3")} />
      </label>
      <label className="block">
        <span className="text-[11px] text-zinc-500">Photos at</span>
        <input type="time" value={e.readyBy} onChange={(x) => x.target.value && onChange((v) => void (v.readyBy = x.target.value))} className={cn(inputCls, "h-10 px-3")} />
      </label>
      <button onClick={onRemove} aria-label={`Remove ${e.name}`} className="w-10 h-10 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center justify-self-end">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

function PlanView({ plan, schedule: s, today }: { plan: ShaadiPlan; schedule: Schedule; today: string }) {
  const tint = (personId: string) => PERSON_TINTS[Math.max(0, plan.people.findIndex((p) => p.id === personId)) % PERSON_TINTS.length]
  const valid = s.events.filter((e) => e.date)
  if (!plan.events.length || !plan.people.length)
    return (
      <div className="rounded-[28px] border-2 border-dashed border-black/10 p-10 text-center">
        <p className="font-serif text-3xl">Your plan appears here</p>
        <p className="text-zinc-500 mt-2">Describe your shaadi above, or add events and people on the left.</p>
      </div>
    )
  const bigDay = [...s.events].sort((a, b) => b.pros.glam + b.pros.mehndi - (a.pros.glam + a.pros.mehndi))[0]
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {[
          { k: "People", v: plan.people.length },
          { k: "Pros on the busiest day", v: bigDay ? bigDay.pros.glam + bigDay.pros.mehndi : 0 },
          { k: "Estimated total", v: formatPKR(s.total).replace("On request", "–") },
        ].map((x) => (
          <div key={x.k} className="rounded-3xl bg-white border border-black/[0.06] p-4 min-w-0">
            <p className="text-[11px] text-zinc-500 leading-tight">{x.k}</p>
            <p className="font-serif text-2xl mt-1 truncate">{x.v}</p>
          </div>
        ))}
      </div>

      {s.warnings.length > 0 && (
        <div className="rounded-3xl bg-amber-50 border border-amber-200 p-4 text-sm space-y-1">
          {s.warnings.map((w) => (
            <p key={w} className="flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" /> {w}
            </p>
          ))}
        </div>
      )}

      {valid.map((e) => {
        const first = Math.min(...e.tracks.map((t) => hm(t.arrive)), hm(e.readyBy) - 60)
        const last = hm(e.readyBy)
        const span = Math.max(60, last - first)
        return (
          <motion.div key={e.eventId} layout className="rounded-[28px] text-white p-5 sm:p-6 overflow-hidden" style={{ background: INK }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-serif text-3xl">{e.name}</p>
              <p className="text-sm text-white/60">
                {fmtDate(e.date)} · photos <span style={{ color: GOLD }}>{to12h(e.readyBy)}</span>
              </p>
            </div>
            <p className="text-sm text-white/60 mt-1">
              {e.tracks.length ? `${e.pros.glam ? `${e.pros.glam} glam` : ""}${e.pros.glam && e.pros.mehndi ? " + " : ""}${e.pros.mehndi ? `${e.pros.mehndi} mehndi` : ""} pro${e.pros.glam + e.pros.mehndi > 1 ? "s" : ""}, first start ${to12h(e.start)}` : "No looks chosen for this event yet."}
            </p>
            <div className="mt-4 space-y-2">
              {e.tracks.map((t, ti) => (
                <div key={t.id} className="grid grid-cols-[4.5rem_1fr] gap-2 items-center">
                  <p className="text-[11px] text-white/50 leading-tight">
                    {t.pool === "glam" ? "Glam" : "Mehndi"} {ti + 1}
                    <br />
                    arrives {to12h(t.arrive)}
                  </p>
                  <div className="relative h-11 rounded-xl bg-white/[0.06]">
                    {t.blocks.map((b, bi) => (
                      <motion.div
                        key={bi}
                        initial={{ opacity: 0, scaleX: 0.6 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{ duration: 0.4, ease: EASE, delay: bi * 0.04 }}
                        className="absolute top-1 bottom-1 rounded-lg text-black px-1.5 overflow-hidden origin-left"
                        style={{ left: `${((hm(b.start) - first) / span) * 100}%`, width: `${((hm(b.end) - hm(b.start)) / span) * 100}%`, background: tint(b.personId) }}
                        title={`${b.person}: ${b.label}, ${to12h(b.start)}–${to12h(b.end)}`}
                      >
                        <p className="text-[10px] font-semibold truncate leading-tight mt-0.5">{b.person}</p>
                        <p className="text-[9px] truncate opacity-70 leading-tight">{to12h(b.start)}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )
      })}

      {s.prep.length > 0 && (
        <div className="rounded-[28px] bg-white border border-black/[0.06] p-5 sm:p-6">
          <p className="font-serif text-2xl">Pre-wedding visits</p>
          <ol className="mt-4 space-y-3">
            {s.prep.map((v) => (
              <li key={v.date} className="grid grid-cols-[3.5rem_1fr] gap-3">
                <div className="rounded-2xl text-center py-2" style={{ background: "#fbeee6" }}>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">{new Date(`${v.date}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</p>
                  <p className="font-serif text-2xl leading-none mt-0.5">{new Date(`${v.date}T12:00:00Z`).getUTCDate()}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-500">
                    {new Date(`${v.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })} · {v.window} · {v.pros} pro{v.pros > 1 ? "s" : ""} · {formatPKR(v.total)}
                  </p>
                  <p className="text-sm mt-0.5">
                    {Object.entries(group(v.items)).map(([person, items], i) => (
                      <span key={person}>
                        {i > 0 && " · "}
                        <b>{person}</b>: {items.join(", ")}
                      </span>
                    ))}
                  </p>
                  {v.warning && <p className="text-xs text-amber-700 mt-1">{v.warning}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {s.total > 0 && (
        <div className="rounded-[28px] bg-white border border-black/[0.06] p-5 sm:p-6">
          <p className="font-serif text-2xl">Who pays what</p>
          <ul className="mt-3 divide-y divide-black/[0.06]">
            {s.branches.map((b) => (
              <li key={b.branch} className="py-2.5 flex items-center justify-between text-sm">
                <span>
                  {b.branch} <span className="text-zinc-400">· {b.people} {b.people === 1 ? "person" : "people"}</span>
                </span>
                <span className="font-semibold">{formatPKR(b.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500 mt-2">From the Mjazo menu, paid after each visit.{s.quoted.length ? ` ${s.quoted.join(", ")} is quoted by the coordinator.` : ""} Final amounts are confirmed with you before booking.</p>
        </div>
      )}
      <p className="text-xs text-zinc-400 text-center">Planned on {fmtDate(today)} · times are a plan until our coordinator confirms them.</p>
    </>
  )
}

function SubmitForm({ plan, setPlan, schedule, onSent }: { plan: ShaadiPlan; setPlan: (fn: (p: ShaadiPlan) => ShaadiPlan) => void; schedule: Schedule; onSent: (id: string) => void }) {
  const { liveAreas } = useCatalog()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const c = plan.contact
  const set = (k: keyof ShaadiPlan["contact"], v: string) => setPlan((p) => ({ ...p, contact: { ...p.contact, [k]: v } }))
  const ready = plan.events.length > 0 && plan.people.length > 0 && schedule.events.some((e) => e.tracks.length)
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/shaadi/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      track("shaadi_submitted", { people: plan.people.length, events: plan.events.length, total: schedule.total })
      onSent(data.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const dark = "w-full h-12 rounded-2xl bg-white/[0.07] border border-white/15 px-4 text-[16px] sm:text-sm outline-none focus:border-[#f4a437] placeholder:text-white/35"
  return (
    <form onSubmit={send}>
      <p className="font-serif text-4xl">Send it to our wedding coordinator</p>
      <p className="text-white/65 mt-2">They check pros and timings, then confirm with you on WhatsApp. Nothing is booked until you agree.</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-8">
        <input className={dark} placeholder="Your name" value={c.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
        <input className={dark} placeholder="WhatsApp number" inputMode="tel" value={c.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
        <select className={dark} value={c.area} onChange={(e) => set("area", e.target.value)} aria-label="Area">
          <option value="">Area…</option>
          {liveAreas.map((a) => (
            <option key={a.slug} value={a.slug} className="text-black">
              {a.name}
            </option>
          ))}
        </select>
        <input className={dark} placeholder="Address where the glam happens" value={c.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" />
      </div>
      {error && <p className="text-sm text-red-200 mt-3">{error}</p>}
      <button disabled={busy || !ready} className="mt-6 h-14 px-8 rounded-full text-black font-medium inline-flex items-center gap-2 disabled:opacity-40" style={{ background: GOLD }}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        Send my plan
      </button>
      {!ready && <p className="text-xs text-white/45 mt-3">Add at least one event with a date and choose looks first.</p>}
    </form>
  )
}

const hm = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5)
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
function group(items: { person: string; label: string }[]) {
  const out: Record<string, string[]> = {}
  for (const i of items) (out[i.person] ??= []).push(i.label)
  return out
}
