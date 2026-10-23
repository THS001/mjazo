import { Badge, Button, Card, Chip, color, errorText, Field, fill, formatDay, formatPKR, Loading, normalisePhone, Notice, prefs, request, Row, Screen, space, Switch, Txt, useLang, validPhone } from "@mjazo/shared"
import { router } from "expo-router"
import { Minus, Plus, Sparkles, X } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { Pressable, View } from "react-native"
import { Stepper } from "../src/parts"
import { useAccount, useT } from "../src/state"

// Home Pulse in the app: their home and routine (kept on the phone) → the next 90 days of care,
// worked out by the website's engine (/api/v1/pulse: Karachi's seasons, the week's heat, Eid,
// family events and, when signed in, their finished visits), worded by Mjazo AI where it's on
// (/api/pulse/copy). Each item books in one tap; "done" hides it. WhatsApp reminders are opt-in.

type Profile = { acs: number; tankUnderground: boolean; tankOverhead: boolean; solar: boolean; geyser: "gas" | "electric" | "none"; pets: boolean; waxWeeks: number; threadWeeks: number; facialWeeks: number; maniWeeks: number; events: { name: string; date: string }[] }
type Item = { id: string; date: string; title: string; why: string; kind: "beauty" | "home" | "season" | "weather" | "event" | "eid"; category: string; service: string; priority: 1 | 2 | 3; approx?: boolean; name: string; price: number }
type Text = {
  profile: Record<"title" | "sub" | "acs" | "fewerAcs" | "moreAcs" | "tankUnderground" | "tankOverhead" | "solar" | "pets" | "geyser" | "gas" | "electric" | "none" | "rhythm" | "notForMe" | "every" | "events" | "remove" | "eventName" | "eventPlaceholder" | "eventDate" | "addEvent", string>
  plan: Record<"title" | "nextTomorrow" | "nextIn" | "planned" | "soonCount" | "heat" | "caughtUp" | "byAi", string>
  kinds: Record<Item["kind"], string>
  item: Record<"soon" | "approx" | "bookPrice" | "book" | "done", string>
  remind: Record<"title" | "sub" | "done" | "nextItem" | "name" | "phone" | "send" | "errName" | "errPhone", string>
  groups: Record<"wax" | "thread" | "facial" | "mani", string>
}
type Plan = { today: string; items: Item[]; heat: number | null; text: Text }

const DEFAULT: Profile = { acs: 2, tankUnderground: true, tankOverhead: true, solar: false, geyser: "gas", pets: false, waxWeeks: 4, threadWeeks: 3, facialWeeks: 6, maniWeeks: 0, events: [] }
const RHYTHMS = [
  ["waxWeeks", "wax", [3, 4, 5, 6]],
  ["threadWeeks", "thread", [2, 3, 4]],
  ["facialWeeks", "facial", [4, 6, 8]],
  ["maniWeeks", "mani", [3, 4, 6]],
] as const
const PROFILE_KEY = "mjazo.pulse"
const DONE_KEY = "mjazo.pulse-done"

export default function Pulse() {
  const t = useT()
  const { lang } = useLang()
  const l = lang === "ur" ? "ur" : "en"
  const { api, account } = useAccount()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [ai, setAi] = useState<{ intro: string; lines: Record<string, string> } | null>(null)
  const [edit, setEdit] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    void Promise.all([prefs.get<Profile>(PROFILE_KEY, DEFAULT), prefs.get<string[]>(DONE_KEY, [])]).then(([p, d]) => {
      setProfile({ ...DEFAULT, ...p })
      setDone(d)
    })
  }, [])
  // The plan follows every change (a moment after the last one).
  useEffect(() => {
    if (!profile) return
    void prefs.set(PROFILE_KEY, profile)
    void prefs.set(DONE_KEY, done)
    let live = true
    const timer = setTimeout(() => {
      api<Plan>("/api/v1/pulse", { body: { lang: l, profile, done } }).then(
        (p) => {
          if (!live) return
          setPlan(p)
          setError(null)
        },
        (e) => live && setError(e),
      )
    }, 350)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [profile, done, l, api, tick, account.state])
  // Mjazo AI rewrites the plan's lines in their language; the rule wording shows until then (or if it's off).
  const ids = plan?.items.map((i) => i.id).join(",") ?? ""
  useEffect(() => {
    setAi(null)
    if (!plan?.items.length) return
    let live = true
    const name = account.state === "in" ? account.me.customer.name.split(" ")[0] : undefined
    request<{ intro: string; lines: Record<string, string> }>("/api/pulse/copy", { body: { lang: l, name, items: plan.items.slice(0, 18).map(({ id, date, title, why }) => ({ id, date, title, why })) } }).then(
      (r) => live && setAi({ intro: r.intro, lines: r.lines ?? {} }),
      () => {},
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, l])

  if (!profile || (!plan && !error)) return <Loading label={t.loading} />
  if (!plan) return <Screen><Notice text={errorText(error, t.offline)} onRetry={() => setTick((n) => n + 1)} retryLabel={t.retry} /></Screen>
  const x = plan.text
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile((p) => (p ? { ...p, [k]: v } : p))
  const next = plan.items[0]
  const soon = plan.items.filter((i) => i.priority === 1).length
  const gap = next ? Math.round((Date.parse(`${next.date}T00:00:00Z`) - Date.parse(`${plan.today}T00:00:00Z`)) / 86400_000) : 0

  return (
    <Screen>
      <Card tint={color.ink}>
        <Txt v="tiny" style={{ color: color.brand }}>{x.plan.title}</Txt>
        <Txt v="h2" style={{ color: color.paper }}>
          {next ? (gap <= 1 ? fill(x.plan.nextTomorrow, { title: next.title }) : fill(x.plan.nextIn, { title: next.title, days: gap })) : x.plan.caughtUp}
        </Txt>
        <Txt v="small" style={{ color: "rgba(255,255,255,0.7)" }}>
          {[fill(x.plan.planned, { count: plan.items.length }), soon ? fill(x.plan.soonCount, { count: soon }) : "", plan.heat ? fill(x.plan.heat, { temp: plan.heat }) : ""].filter(Boolean).join(" · ")}
        </Txt>
        {ai?.intro ? (
          <Row style={{ alignItems: "flex-start" }}>
            <Sparkles size={14} color={color.brand} />
            <Txt v="small" style={{ color: color.paper, flex: 1 }}>{ai.intro}</Txt>
          </Row>
        ) : null}
      </Card>

      <Card>
        <Pressable onPress={() => setEdit((e) => !e)}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="h3">{x.profile.title}</Txt>
            <Txt v="small" style={{ textDecorationLine: "underline" }}>{edit ? t.done : t.edit}</Txt>
          </Row>
          <Txt v="muted">{x.profile.sub}</Txt>
        </Pressable>
        {edit && <ProfileForm profile={profile} set={set} x={x} today={plan.today} />}
      </Card>

      {plan.items.map((it) => (
        <Card key={it.id}>
          <Row wrap>
            <Txt v="small" style={{ fontWeight: "700" }}>{formatDay(it.date, l)}</Txt>
            <Badge text={x.kinds[it.kind]} tone="green" />
            {it.priority === 1 && <Badge text={x.item.soon} tone="brand" />}
            {it.approx && <Txt v="muted">{x.item.approx}</Txt>}
          </Row>
          <Txt v="h3">{it.title}</Txt>
          <Txt v="small">{ai?.lines[it.id] || it.why}</Txt>
          <Row>
            <Button title={it.price > 0 ? fill(x.item.bookPrice, { price: formatPKR(it.price) }) : x.item.book} small onPress={() => router.push(`/service/${it.category}/${it.service}`)} />
            <Button title={x.item.done} small variant="light" onPress={() => setDone((d) => [...d, it.id])} />
          </Row>
        </Card>
      ))}
      {ai ? <Txt v="muted">{x.plan.byAi}</Txt> : null}
      <Remind x={x} profile={profile} items={plan.items} lang={l} />
    </Screen>
  )
}

function ProfileForm({ profile, set, x, today }: { profile: Profile; set: <K extends keyof Profile>(k: K, v: Profile[K]) => void; x: Text; today: string }) {
  const t = useT()
  const [evName, setEvName] = useState("")
  const [evDate, setEvDate] = useState("")
  const [evError, setEvError] = useState("")
  const addEvent = () => {
    const date = evDate.trim()
    if (!evName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date < today) return setEvError(t.eventDateHint)
    set("events", [...profile.events, { name: evName.trim(), date }].slice(0, 6))
    setEvName("")
    setEvDate("")
    setEvError("")
  }
  return (
    <View style={{ gap: space.md }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt>{x.profile.acs}</Txt>
        <Row>
          <Stepper icon={<Minus size={16} color={color.ink} />} label={x.profile.fewerAcs} onPress={() => set("acs", Math.max(0, profile.acs - 1))} />
          <Txt style={{ minWidth: 24, fontWeight: "700" }} center>{profile.acs}</Txt>
          <Stepper icon={<Plus size={16} color={color.ink} />} label={x.profile.moreAcs} onPress={() => set("acs", Math.min(10, profile.acs + 1))} />
        </Row>
      </Row>
      {(["tankUnderground", "tankOverhead", "solar", "pets"] as const).map((k) => (
        <Row key={k} style={{ justifyContent: "space-between" }}>
          <Txt style={{ flex: 1 }}>{x.profile[k]}</Txt>
          <Switch on={profile[k]} onChange={(v) => set(k, v)} label={x.profile[k]} />
        </Row>
      ))}
      <Txt v="small" style={{ fontWeight: "600" }}>{x.profile.geyser}</Txt>
      <Row wrap>
        {(["gas", "electric", "none"] as const).map((g) => (
          <Chip key={g} label={x.profile[g]} selected={profile.geyser === g} onPress={() => set("geyser", g)} />
        ))}
      </Row>
      <Txt v="tiny">{x.profile.rhythm}</Txt>
      {RHYTHMS.map(([key, group, options]) => (
        <View key={key} style={{ gap: 6 }}>
          <Txt v="small">{x.groups[group]}</Txt>
          <Row wrap>
            {[0, ...options].map((w) => (
              <Chip key={w} label={w ? fill(x.profile.every, { weeks: w }) : x.profile.notForMe} selected={profile[key] === w} onPress={() => set(key, w)} />
            ))}
          </Row>
        </View>
      ))}
      <Txt v="tiny">{x.profile.events}</Txt>
      {profile.events.map((ev, i) => (
        <Row key={`${ev.name}${ev.date}`} style={{ justifyContent: "space-between" }}>
          <Txt v="small">{`${ev.name} · ${ev.date}`}</Txt>
          <Pressable onPress={() => set("events", profile.events.filter((_, j) => j !== i))} accessibilityLabel={fill(x.profile.remove, { name: ev.name })} hitSlop={8}>
            <X size={16} color={color.ink} />
          </Pressable>
        </Row>
      ))}
      <Field label={x.profile.eventName} value={evName} onChangeText={setEvName} placeholder={x.profile.eventPlaceholder} maxLength={60} />
      <Field label={x.profile.eventDate} value={evDate} onChangeText={setEvDate} placeholder="2026-12-20" keyboardType="numbers-and-punctuation" maxLength={10} error={evError || null} />
      <Button title={x.profile.addEvent} small variant="light" onPress={addEvent} style={{ alignSelf: "flex-start" }} />
    </View>
  )
}

/** Opt-in WhatsApp reminders (the team and the automation's Home Pulse rule use them). */
function Remind({ x, profile, items, lang }: { x: Text; profile: Profile; items: Item[]; lang: string }) {
  const { account } = useAccount()
  const me = account.state === "in" ? account.me.customer : null
  const [name, setName] = useState(me?.name ?? "")
  const [phone, setPhone] = useState(me?.phone ?? "")
  const [state, setState] = useState<"idle" | "busy" | "done">("idle")
  const [error, setError] = useState("")
  const first = useRef(items[0]?.title)
  const t = useT()
  const send = async () => {
    if (name.trim().length < 2) return setError(x.remind.errName)
    if (!validPhone(phone)) return setError(x.remind.errPhone)
    setState("busy")
    setError("")
    try {
      await request("/api/submit", { body: { type: "enquiry", data: { kind: "pulse", name: name.trim(), phone: normalisePhone(phone), message: `Home Pulse reminders (${lang}, app)`, details: { lang, plan: items.map((i) => `${i.date} · ${i.title}`), profile } } } })
      setState("done")
    } catch (e) {
      setError(errorText(e, t.offline))
      setState("idle")
    }
  }
  return (
    <Card tint={color.brandSoft}>
      <Txt v="h3">{x.remind.title}</Txt>
      {state === "done" ? (
        <Notice tone="green" text={fill(x.remind.done, { title: first.current ?? x.remind.nextItem })} />
      ) : (
        <>
          <Txt v="small">{x.remind.sub}</Txt>
          <Field label={x.remind.name} value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label={x.remind.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0300 1234567" />
          {error ? <Notice text={error} /> : null}
          <Button title={x.remind.send} variant="whatsapp" busy={state === "busy"} onPress={() => void send()} />
        </>
      )}
    </Card>
  )
}
