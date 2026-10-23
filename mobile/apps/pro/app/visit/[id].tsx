import { Badge, Button, Card, Chip, color, currentLocation, errorText, Field, fill, formatDay, Line, Loading, Notice, Row, Screen, Sheet, space, tell, Txt, useLang, windowLabel, type Visit } from "@mjazo/shared"
import { Image } from "expo-image"
import * as ImageManipulator from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import { Stack, useLocalSearchParams } from "expo-router"
import { Camera, MapPin, MessageCircle, Navigation, Phone, Wallet } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Linking, Pressable, View } from "react-native"
import { money, SosButton, StatusBadge } from "../../src/parts"
import { useSchedule } from "../../src/schedule"
import { useSession, useT } from "../../src/session"

// One visit, everything she needs on the day: the customer, the address (map, call, WhatsApp), the
// services, the customer's notes and brief, notes from earlier visits, and the next step:
// On my way → check in → (I'm safe) → finish with the payment. Her location goes with each step
// (only then), so ops can keep her safe. SOS is always on the screen.

type Action = "en_route" | "check_in" | "safe" | "check_out"

export default function VisitScreen() {
  const t = useT()
  const { lang } = useLang()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { api } = useSession()
  const { schedule, reload } = useSchedule()
  const [busy, setBusy] = useState<Action | "note" | "">("")
  const [msg, setMsg] = useState<{ text: string; tone: "green" | "red" } | null>(null)
  const [note, setNote] = useState("")
  const [paying, setPaying] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  const v = schedule?.days.flatMap((d) => d.visits).find((x) => x.id === id)
  if (!schedule) return <Loading />
  if (!v) return <Notice tone="amber" text={t.notMine} />

  const act = async (action: Action) => {
    setBusy(action)
    setMsg(null)
    try {
      const where = action === "safe" ? null : await currentLocation()
      await api(`/api/v1/pro/jobs/${encodeURIComponent(v.id)}`, { body: { action, ...(where ?? {}) } })
      await reload()
    } catch (e) {
      setMsg({ text: errorText(e, t.offline), tone: "red" })
    } finally {
      setBusy("")
    }
  }
  const saveNote = async () => {
    if (note.trim().length < 2) return
    setBusy("note")
    try {
      await api(`/api/v1/pro/jobs/${encodeURIComponent(v.id)}`, { body: { action: "note", note: note.trim() } })
      setNote("")
      setMsg({ text: t.noteSaved, tone: "green" })
    } catch (e) {
      setMsg({ text: errorText(e, t.offline), tone: "red" })
    } finally {
      setBusy("")
    }
  }

  const place = [v.address, v.landmark, v.subArea, v.area, "Karachi"].filter(Boolean).join(", ")
  const waNumber = v.customer.phone.replace(/\D/g, "").replace(/^0/, "92")
  const elapsed = v.checkedInAt ? Math.max(0, Math.round((now - Date.parse(v.checkedInAt)) / 60000)) : 0
  const open = !["completed", "cancelled", "no_show"].includes(v.status)
  const alert = open && v.safety.level !== "ok"

  return (
    <Screen>
      <Stack.Screen options={{ title: `${formatDay(v.date, lang)} · ${windowLabel(v.window, lang)}` }} />
      <Row style={{ justifyContent: "space-between" }}>
        <StatusBadge status={v.status} />
        {open && <SosButton jobId={v.id} compact />}
      </Row>
      {alert && (
        <Card tint={color.redSoft}>
          <Txt v="h3">{t.safeQ}</Txt>
          <Txt>{v.safety.message || t.safeBody}</Txt>
          <Button title={t.safe} variant="dark" busy={busy === "safe"} onPress={() => act("safe")} />
        </Card>
      )}
      {msg && <Notice tone={msg.tone} text={msg.text} />}

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt v="h2" style={{ flex: 1 }}>
            {v.customer.name}
          </Txt>
          {v.askedForYou && <Badge text={t.askedForYou} tone="violet" />}
        </Row>
        <Txt>{place}</Txt>
        <Row wrap>
          <Chip label={`📍 ${t.map}`} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`)} />
          <Chip label={`📞 ${t.call}`} onPress={() => void Linking.openURL(`tel:${v.customer.phone}`)} />
          <Chip label={`💬 ${t.whatsapp}`} onPress={() => void Linking.openURL(`https://wa.me/${waNumber}`)} />
        </Row>
      </Card>

      {open && (
        <View style={{ gap: space.sm }}>
          {v.status === "assigned" && <Button title={t.onWay} variant="brand" busy={busy === "en_route"} icon={<Navigation size={18} color={color.ink} />} onPress={() => act("en_route")} />}
          {(v.status === "assigned" || v.status === "en_route") && <Button title={t.checkIn} variant={v.status === "en_route" ? "dark" : "light"} busy={busy === "check_in"} icon={<MapPin size={18} color={v.status === "en_route" ? color.paper : color.ink} />} onPress={() => act("check_in")} />}
          {(v.status === "checked_in" || v.status === "checked_out") && <Button title={t.finish} icon={<Wallet size={18} color={color.paper} />} onPress={() => setPaying(true)} />}
          {v.status === "checked_in" && <Button title={t.checkOut} variant="light" busy={busy === "check_out"} onPress={() => act("check_out")} />}
          {v.checkedInAt && v.status === "checked_in" && (
            <View style={{ gap: 4 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: "#E5E5E5", overflow: "hidden" }}>
                <View style={{ height: 6, width: `${Math.min(100, (elapsed / Math.max(1, v.minutes)) * 100)}%`, backgroundColor: color.brand }} />
              </View>
              <Txt v="muted">{fill(t.elapsed, { done: elapsed, total: v.minutes })}</Txt>
            </View>
          )}
          <Txt v="muted">{v.status === "en_route" ? t.sharingLive : t.locationWhy}</Txt>
        </View>
      )}
      {v.status === "completed" && v.paid && <Notice tone="green" text={`${t.done} · ${money(v.paid.amount)} ${v.paid.method}${v.paid.status === "matched" ? " · ✓" : ""}`} />}

      <Card>
        <Txt v="h3">{t.services}</Txt>
        {v.items.map((i, n) => (
          <View key={n}>
            <Txt>{`${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`}</Txt>
            {[...i.options, ...i.addOns].length > 0 && <Txt v="muted">{[...i.options, ...i.addOns].join(" · ")}</Txt>}
          </View>
        ))}
        <Line label={t.youEarn} value={money(v.earn)} />
        <Line label={t.collect} value={`${money(v.due)} · ${v.payment}`} strong />
        {v.credit > 0 && <Txt v="muted">{`${money(v.credit)} ${t.creditUsed}`}</Txt>}
      </Card>

      {v.notes ? (
        <Card>
          <Txt v="h3">{t.notes}</Txt>
          <Txt>{v.notes}</Txt>
        </Card>
      ) : null}
      {v.brief && (
        <Card>
          <Txt v="h3">{`${t.customerBrief}: ${v.brief.title}`}</Txt>
          <Txt>{v.brief.text}</Txt>
          {v.brief.parts?.length ? <Txt v="muted">{v.brief.parts.join(" · ")}</Txt> : null}
          {v.photos.length > 0 && (
            <Row wrap>
              {v.photos.map((p, i) => (
                <Image key={i} source={{ uri: p }} style={{ width: 96, height: 96, borderRadius: 12 }} contentFit="cover" />
              ))}
            </Row>
          )}
        </Card>
      )}
      {v.lastNotes.length > 0 && (
        <Card>
          <Txt v="h3">{t.last}</Txt>
          {v.lastNotes.map((n, i) => (
            <Txt key={i} v="small">
              • {n}
            </Txt>
          ))}
        </Card>
      )}
      <Card>
        <Field label={t.addNote} value={note} onChangeText={setNote} placeholder={t.addNoteHint} multiline maxLength={500} />
        <Button title={t.save} variant="light" small busy={busy === "note"} disabled={note.trim().length < 2} onPress={saveNote} />
      </Card>

      <Sheet open={paying} onClose={() => setPaying(false)}>
        <PayForm
          v={v}
          onDone={async (text) => {
            setPaying(false)
            await reload()
            tell(text)
          }}
        />
      </Sheet>
    </Screen>
  )
}

const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "jazzcash", label: "JazzCash" },
  { id: "easypaisa", label: "Easypaisa" },
  { id: "raast", label: "Raast / Bank" },
] as const
type Method = (typeof METHODS)[number]["id"]

/** Finish: how they paid, the amount, and for a digital payment its screenshot (AI reads and checks it). */
function PayForm({ v, onDone }: { v: Visit; onDone: (message: string) => void }) {
  const t = useT()
  const { api } = useSession()
  const [method, setMethod] = useState<Method>(METHODS.find((m) => m.id === v.payment)?.id ?? "cash")
  const [amount, setAmount] = useState(String(v.due))
  const [shot, setShot] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 })
    if (r.canceled || !r.assets[0]) return
    // Small enough to send (the server takes up to about 1 MB): 1200 px wide, JPEG.
    const out = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 1200 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true })
    setShot(out.base64 ? `data:image/jpeg;base64,${out.base64}` : null)
  }
  const save = async () => {
    setBusy(true)
    setError("")
    try {
      const where = await currentLocation()
      const r = await api<{ message: string | null }>(`/api/v1/pro/jobs/${encodeURIComponent(v.id)}`, { body: { action: "complete", ...(where ?? {}), payment: { method, amount: Number(amount) || 0, ...(method !== "cash" && shot ? { screenshot: shot } : {}) } } })
      onDone(r.message ?? t.done)
    } catch (e) {
      setError(errorText(e, t.offline))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Txt v="h2">{t.pay}</Txt>
      <Txt v="muted">{fill(t.toCollect, { amount: money(v.due) })}</Txt>
      <Txt v="small" style={{ fontWeight: "600" }}>
        {t.method}
      </Txt>
      <Row wrap>
        {METHODS.map((m) => (
          <Chip key={m.id} label={m.label} selected={method === m.id} onPress={() => setMethod(m.id)} />
        ))}
      </Row>
      <Field label={t.amount} value={amount} onChangeText={(x) => setAmount(x.replace(/\D/g, ""))} keyboardType="number-pad" />
      {method !== "cash" && (
        <Pressable onPress={pick} style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: color.field }}>
          {shot ? <Image source={{ uri: shot }} style={{ width: 56, height: 80, borderRadius: 8 }} contentFit="cover" /> : <Camera size={28} color={color.ink} />}
          <View style={{ flex: 1 }}>
            <Txt v="h3">{shot ? t.changePhoto : t.shot}</Txt>
            <Txt v="muted">{t.shotHint}</Txt>
          </View>
        </Pressable>
      )}
      {error ? <Notice text={error} /> : null}
      <Button title={t.saveFinish} variant="brand" busy={busy} disabled={method !== "cash" && !shot} onPress={save} />
    </>
  )
}
