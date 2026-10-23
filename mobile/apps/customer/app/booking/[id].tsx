import { ApiError, Button, Card, Chip, color, errorText, Field, fill, formatDay, formatPKR, formatTime, formatWhen, Line, Loading, Notice, request, Row, Screen, Sheet, space, Txt, useLang, whatsappLink, windowLabel, type CustomerBooking, type Slots } from "@mjazo/shared"
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router"
import { Star } from "lucide-react-native"
import { useCallback, useEffect, useState } from "react"
import { Linking, Pressable, View } from "react-native"
import { Steps, StatusBadge } from "../../src/parts"
import { useAccount, useCart, useCatalog, useT } from "../../src/state"

// One booking, live: its steps, the pro's first name and ETA, what's paid and due; moving or
// cancelling it within the free-change time; rating it once it's done; booking it (and her) again.

export default function BookingScreen() {
  const t = useT()
  const { lang } = useLang()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { api, account } = useAccount()
  const { catalog } = useCatalog()
  const cart = useCart()
  const [b, setB] = useState<CustomerBooking | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [sheet, setSheet] = useState<"cancel" | "move" | null>(null)
  const [done, setDone] = useState("")

  const load = useCallback(async () => {
    try {
      setB(await api<CustomerBooking>(`/api/v1/customer/bookings/${encodeURIComponent(id)}`))
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [api, id])
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )
  // While the visit is under way, keep it fresh (every 30 seconds).
  const active = b && ["assigned", "en_route", "checked_in", "checked_out"].includes(b.status)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => void load(), 30_000)
    return () => clearInterval(timer)
  }, [active, load])

  if (!b) return error ? <Notice text={errorText(error, t.offline)} onRetry={load} retryLabel={t.retry} /> : <Loading />
  const open = ["new", "assigned"].includes(b.status)

  const again = (withPro: boolean) => {
    cart.clear()
    for (const i of b.items) {
      const svc = catalog?.categories.find((c) => c.slug === i.category)?.services.find((s) => s.slug === i.service)
      cart.add({ name: i.name, category: i.category, service: i.service, options: i.options, optionLabels: i.options, addOns: i.addOns, addOnNames: i.addOns, qty: i.qty, unitPrice: i.unitPrice, duration: svc?.duration ?? 60 })
    }
    cart.setRebook(withPro && b.rebookWith ? { proId: b.rebookWith.id, firstName: b.rebookWith.firstName } : null)
    router.push("/cart")
  }

  return (
    <Screen refreshing={false} onRefresh={load}>
      <Stack.Screen options={{ title: b.id }} />
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h2" style={{ flex: 1 }}>{`${formatDay(b.date, lang)}, ${windowLabel(b.window, lang)}`}</Txt>
        <StatusBadge status={b.status} />
      </Row>
      {!["cancelled", "no_show"].includes(b.status) && <Steps b={b} />}
      {done ? <Notice tone="green" text={done} /> : null}
      {b.pro && <Txt v="h3">{fill(t.yourPro, { name: b.pro.firstName })}</Txt>}
      {b.status === "en_route" && b.live && b.live.minutes !== null ? (
        <Card tint={color.brandSoft}>
          <Txt v="h3">{fill(t.liveAway, { name: b.pro?.firstName ?? "", minutes: b.live.minutes, km: b.live.km ?? "" })}</Txt>
          <Button title={t.liveMap} variant="light" small onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${b.live!.lat},${b.live!.lng}`)} style={{ alignSelf: "flex-start" }} />
        </Card>
      ) : b.status === "en_route" && b.eta ? (
        <Notice tone="brand" text={fill(t.eta, { time: formatTime(b.eta) })} />
      ) : null}
      {!b.pro && b.askedFor && <Txt v="muted">{fill(t.askedFor, { name: b.askedFor.firstName })}</Txt>}

      <Card>
        {b.items.map((i, n) => (
          <Line key={n} label={`${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}${[...i.options, ...i.addOns].length ? ` (${[...i.options, ...i.addOns].join(", ")})` : ""}`} value={i.unitPrice > 0 ? formatPKR(i.unitPrice * i.qty) : t.onRequest} />
        ))}
        {b.discount > 0 && <Line label={t.discount} value={`− ${formatPKR(b.discount)}`} />}
        {b.credit > 0 && <Line label={t.creditUsed} value={`− ${formatPKR(b.credit)}`} />}
        <Line label={t.payAfter} value={formatPKR(b.due)} strong />
      </Card>
      <Card>
        <Txt v="tiny">{t.where2}</Txt>
        <Txt>{[b.address, b.subArea, b.areaName].filter(Boolean).join(", ")}</Txt>
        {b.landmark && <Txt v="muted">{b.landmark}</Txt>}
      </Card>

      {open && (b.canChange && b.changeUntil ? <Txt v="muted">{fill(t.changeUntil, { time: formatWhen(b.changeUntil, lang) })}</Txt> : <Notice tone="amber" text={t.tooLate} />)}
      {open && b.canChange && (
        <Row>
          <Button title={t.changeTime} variant="light" onPress={() => setSheet("move")} style={{ flex: 1 }} />
          <Button title={t.cancelVisit} variant="light" onPress={() => setSheet("cancel")} style={{ flex: 1 }} />
        </Row>
      )}

      {b.status === "completed" && (b.rating ? <Txt v="muted">{fill(t.yourRating, { stars: b.rating.stars })}</Txt> : account.state === "in" && account.me.customer.phone ? <RateCard id={b.id} phone={account.me.customer.phone} onDone={load} /> : null)}
      {b.rebookWith && <Button title={fill(t.bookAgainWith, { name: b.rebookWith.firstName })} variant="brand" onPress={() => again(true)} />}
      {!b.rebookWith && ["completed", "cancelled"].includes(b.status) && <Button title={t.bookAgain} variant="light" onPress={() => again(false)} />}

      {catalog && (
        <Pressable onPress={() => void Linking.openURL(whatsappLink(catalog.contact.whatsapp, `${t.help} ${b.id}`))}>
          <Txt v="small" center style={{ textDecorationLine: "underline", marginTop: space.md }}>
            {t.help} {t.whatsappUs}
          </Txt>
        </Pressable>
      )}

      <Sheet open={sheet === "cancel"} onClose={() => setSheet(null)}>
        <CancelForm
          b={b}
          onDone={(next) => {
            setB(next)
            setSheet(null)
            setDone(t.cancelledDone)
          }}
        />
      </Sheet>
      <Sheet open={sheet === "move"} onClose={() => setSheet(null)}>
        <MoveForm
          b={b}
          onDone={(next) => {
            setB(next)
            setSheet(null)
            setDone(fill(t.movedDone, { date: formatDay(next.date, lang), window: windowLabel(next.window, lang) }))
          }}
        />
      </Sheet>
    </Screen>
  )
}

function CancelForm({ b, onDone }: { b: CustomerBooking; onDone: (b: CustomerBooking) => void }) {
  const t = useT()
  const { api } = useAccount()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const go = async () => {
    setBusy(true)
    try {
      onDone((await api<{ booking: CustomerBooking }>(`/api/v1/customer/bookings/${encodeURIComponent(b.id)}`, { body: { action: "cancel", reason: reason.trim() || undefined } })).booking)
    } catch (e) {
      setError(errorText(e, t.offline))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Txt v="h2">{t.cancelTitle}</Txt>
      <Field label={t.cancelReason} value={reason} onChangeText={setReason} multiline maxLength={200} />
      {error ? <Notice text={error} /> : null}
      <Button title={t.cancelYes} variant="danger" busy={busy} onPress={go} />
    </>
  )
}

function MoveForm({ b, onDone }: { b: CustomerBooking; onDone: (b: CustomerBooking) => void }) {
  const t = useT()
  const { lang } = useLang()
  const { api } = useAccount()
  const [slots, setSlots] = useState<Slots | null>(null)
  const [date, setDate] = useState("")
  const [win, setWin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)
  useEffect(() => {
    request<Slots>("/api/v1/slots", { body: { area: b.area, items: b.items.map((i) => ({ category: i.category, service: i.service, qty: i.qty })) } }).then(setSlots, (e) => setError(errorText(e, t.offline)))
  }, [b, tick, t.offline])
  const day = slots?.days.find((d) => d.date === date)
  const go = async () => {
    setBusy(true)
    setError("")
    try {
      onDone((await api<{ booking: CustomerBooking }>(`/api/v1/customer/bookings/${encodeURIComponent(b.id)}`, { body: { action: "reschedule", date, window: win } })).booking)
    } catch (e) {
      setError(e instanceof ApiError && e.code === "slotFull" ? t.slotFull : errorText(e, t.offline))
      if (e instanceof ApiError && e.code === "slotFull") {
        setWin("")
        setTick((n) => n + 1)
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Txt v="h2">{t.pickTime}</Txt>
      {!slots && !error && <Loading />}
      {slots && (
        <Row wrap>
          {slots.days.map((d) => {
            const open = d.windows.some((w) => w.open)
            return (
              <Chip
                key={d.date}
                label={formatDay(d.date, lang)}
                sub={open ? undefined : t.full}
                disabled={!open}
                selected={date === d.date}
                onPress={() => {
                  setDate(d.date)
                  setWin("")
                }}
              />
            )
          })}
        </Row>
      )}
      {day && (
        <Row wrap>
          {day.windows.map((w) => (
            <Chip key={w.label} label={windowLabel(w.label, lang)} disabled={!w.open || (b.date === date && w.label === b.window)} selected={win === w.label} onPress={() => setWin(w.label)} />
          ))}
        </Row>
      )}
      {error ? <Notice text={error} /> : null}
      <Button title={t.moveIt} busy={busy} disabled={!date || !win} onPress={go} />
    </>
  )
}

function RateCard({ id, phone, onDone }: { id: string; phone: string; onDone: () => void }) {
  const t = useT()
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; tone: "green" | "amber" | "red" } | null>(null)
  const send = async () => {
    setBusy(true)
    try {
      const r = await request<{ ok: boolean; low?: boolean }>("/api/rate", { body: { bookingId: id, phone, stars, comment: comment.trim() || undefined } })
      setMsg({ text: r.low ? t.ratedLow : t.rated, tone: r.low ? "amber" : "green" })
      onDone()
    } catch (e) {
      setMsg({ text: errorText(e, t.offline), tone: "red" })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <Txt v="h3">{t.rate}</Txt>
      <Txt v="muted">{t.rateSub}</Txt>
      <Row gap={space.md} style={{ justifyContent: "center", paddingVertical: space.sm }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n}`} onPress={() => setStars(n)} hitSlop={6}>
            <Star size={34} color={color.brand} fill={n <= stars ? color.brand : "transparent"} />
          </Pressable>
        ))}
      </Row>
      {stars > 0 && <Field label={t.rateComment} value={comment} onChangeText={setComment} multiline maxLength={500} />}
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      <Button title={t.rateSend} disabled={!stars} busy={busy} onPress={send} />
      <View />
    </Card>
  )
}
