import { ApiError, Button, Card, Chip, color, currentLocation, errorText, Field, fill, formatDay, formatPKR, Line, Loading, normalisePhone, Notice, request, Row, Screen, space, Switch, Txt, useLang, validPhone, windowLabel, type Address, type Area, type PromoCheck, type Slots } from "@mjazo/shared"
import { Redirect, router } from "expo-router"
import { LocateFixed } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { Image, View } from "react-native"
import { Section } from "../src/parts"
import { rememberBooking, useAccount, useCart, useCatalog, useT } from "../src/state"
import { clearBrief, loadBrief, type Brief } from "../src/tools"

// Checkout: where (a saved address, or the area, street and an optional location), when (the real
// free windows for this cart and area), who, how they'll pay, a promo code and their credit, and a
// Ghar Scan brief for the pro when one is saved. The server checks and prices it all again; the
// app shows its reason when something's refused.

type Pay = "cash" | "jazzcash" | "easypaisa" | "raast"

/** The nearest area centre within 6 km of a point, as the website does (lib/geo.ts). */
function areaAt(areas: Area[], lat: number, lng: number) {
  const km = (a: { lat: number; lng: number }) => {
    const r = Math.PI / 180
    const x = (a.lng - lng) * r * Math.cos(((a.lat + lat) / 2) * r)
    const y = (a.lat - lat) * r
    return Math.sqrt(x * x + y * y) * 6371
  }
  const near = areas.filter((a) => a.center).map((a) => ({ a, d: km(a.center!) })).sort((p, q) => p.d - q.d)[0]
  return near && near.d <= 6 ? near.a : null
}

export default function Checkout() {
  const t = useT()
  const { lang } = useLang()
  const cart = useCart()
  const { catalog } = useCatalog()
  const { account, api } = useAccount()
  const me = account.state === "in" ? account.me : null

  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressId, setAddressId] = useState<string | null>(null)
  const [area, setArea] = useState("")
  const [subArea, setSubArea] = useState("")
  const [line, setLine] = useState("")
  const [landmark, setLandmark] = useState("")
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [locNote, setLocNote] = useState<{ text: string; tone: "green" | "amber" } | null>(null)
  const [locating, setLocating] = useState(false)
  const [saveAddress, setSaveAddress] = useState(true)
  const [slots, setSlots] = useState<Slots | null>(null)
  const [slotsError, setSlotsError] = useState<unknown>(null)
  const [slotsTick, setSlotsTick] = useState(0)
  const [proGone, setProGone] = useState(false)
  const [date, setDate] = useState("")
  const [win, setWin] = useState("")
  const [name, setName] = useState(me?.customer.name ?? "")
  const [phone, setPhone] = useState(me?.customer.phone ?? "")
  const [pay, setPay] = useState<Pay>("cash")
  const [notes, setNotes] = useState("")
  const [code, setCode] = useState("")
  const [promo, setPromo] = useState<PromoCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [useCredit, setUseCredit] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState("")
  // A Ghar Scan diagnosis saved for this booking: it goes to the pro (photos until the visit is done).
  const [brief, setBrief] = useState<Brief | null>(null)
  const [sendBrief, setSendBrief] = useState(true)
  useEffect(() => {
    void loadBrief().then(setBrief)
  }, [])
  // Once booked, the emptied cart must not send them back to it.
  const placed = useRef(false)

  // Signed in: their saved addresses, the default one chosen.
  useEffect(() => {
    if (!me) return
    setName((n) => n || me.customer.name)
    setPhone((p) => p || me.customer.phone || "")
    api<{ addresses: Address[] }>("/api/v1/customer/addresses").then(
      (r) => {
        setAddresses(r.addresses)
        const d = r.addresses.find((a) => a.isDefault) ?? r.addresses[0]
        if (d) pickAddress(d)
      },
      () => {},
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.customer.id])

  const pickAddress = (a: Address | null) => {
    setAddressId(a?.id ?? null)
    setArea(a?.area ?? "")
    setSubArea(a?.subArea ?? "")
    setLine(a?.line ?? "")
    setLandmark(a?.landmark ?? "")
    setPin(a?.lat != null && a?.lng != null ? { lat: a.lat, lng: a.lng } : null)
    setLocNote(null)
  }

  const items = useMemo(() => cart.items.map((i) => ({ name: i.name, category: i.category, service: i.service, options: i.options, addOns: i.addOns, qty: i.qty, unitPrice: i.unitPrice })), [cart.items])
  const proId = cart.rebook && !proGone ? cart.rebook.proId : undefined

  // The free windows for this cart in this area (and with the pro they asked for).
  useEffect(() => {
    if (!area || !items.length) return setSlots(null)
    let live = true
    setSlotsError(null)
    request<Slots>("/api/v1/slots", { body: { area, items: items.map(({ category, service, qty }) => ({ category, service, qty })), ...(proId ? { proId } : {}) } }).then(
      (s) => {
        if (!live) return
        if (s.mode === "unavailable" && proId) return setProGone(true)
        setSlots(s)
        const first = s.days.find((d) => d.windows.some((w) => w.open))
        setDate((d) => (s.days.some((x) => x.date === d && x.windows.some((w) => w.open)) ? d : (first?.date ?? "")))
      },
      (e) => live && setSlotsError(e),
    )
    return () => {
      live = false
    }
  }, [area, items, proId, slotsTick])
  const day = slots?.days.find((d) => d.date === date)
  useEffect(() => {
    if (day && !day.windows.find((w) => w.label === win && w.open)) setWin("")
  }, [day, win])

  if (!catalog) return <Loading label={t.loading} />
  if (!cart.items.length) return placed.current ? <Loading /> : <Redirect href="/cart" />
  const areaObj = catalog.areas.find((a) => a.slug === area)

  const locate = async () => {
    setLocating(true)
    const here = await currentLocation()
    setLocating(false)
    if (!here) return setLocNote({ text: t.noLocation, tone: "amber" })
    const a = areaAt(catalog.areas, here.lat, here.lng)
    if (!a && catalog.areas.some((x) => x.center)) {
      setPin(null)
      return setLocNote({ text: t.outside, tone: "amber" })
    }
    setPin(here)
    setAddressId(null)
    if (a) setArea(a.slug)
    setLocNote({ text: a ? fill(t.located, { area: a.name }) : t.locatedNoArea, tone: "green" })
  }

  const applyPromo = async () => {
    if (!code.trim()) return
    setChecking(true)
    try {
      setPromo(await api<PromoCheck>("/api/v1/customer/promo", { body: { code: code.trim(), items } }))
    } catch (e) {
      setPromo(null)
      setFailed(errorText(e, t.offline))
    } finally {
      setChecking(false)
    }
  }
  const promoProblem = (p: Extract<PromoCheck, { ok: false }>) => fill(t[`promo-${p.problem}` as keyof typeof t] ?? t["promo-invalid"], { min: formatPKR(p.minOrder ?? 0) })

  // One discount per booking, as the server decides: the larger of Mjazo Plus and the code.
  const plus = me?.plus?.status === "active" ? me.plus : null
  const plusOff = plus ? Math.round((cart.subtotal * plus.discountPct) / 100) : 0
  const codeOff = promo?.ok ? Math.min(promo.discount, cart.subtotal) : 0
  const usingPlus = plusOff > codeOff
  const discount = Math.max(plusOff, codeOff)
  const total = cart.subtotal - discount
  const credit = me && useCredit ? Math.min(me.credit.available, total) : 0

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!area) e.area = t.errArea
    if (line.trim().length < 5) e.line = t.errAddress
    if (!date || !win) e.when = t.errWindow
    if (name.trim().length < 2) e.name = t.errName
    if (!validPhone(phone)) e.phone = t.errPhone
    setErrors(e)
    setFailed("")
    if (Object.keys(e).length) return setFailed(t.fixAbove)
    setBusy(true)
    try {
      const body = {
        name: name.trim(),
        phone: normalisePhone(phone),
        area,
        ...(subArea ? { subArea } : {}),
        address: line.trim(),
        ...(landmark.trim() ? { landmark: landmark.trim() } : {}),
        date,
        window: win,
        payment: pay,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        items,
        total: total - credit,
        ...(promo?.ok && !usingPlus ? { promo: promo.code } : {}),
        ...(me && credit > 0 ? { useCredit: true } : {}),
        ...(proId ? { preferredProId: proId } : {}),
        ...(pin ? { lat: pin.lat, lng: pin.lng } : {}),
        ...(addressId ? { addressId } : {}),
        ...(brief && sendBrief ? { brief: { kind: brief.kind, title: brief.title, text: brief.text, causes: brief.causes, parts: brief.parts, pins: brief.pins, hasPhotos: brief.photos.length > 0 } } : {}),
      }
      const r = await api<{ id: string; total?: number; credit?: number }>("/api/v1/bookings", { body })
      // A new address, saved to their account (best effort: the booking is made either way).
      if (me && !addressId && saveAddress) await api("/api/v1/customer/addresses", { body: { area, subArea: subArea || null, line: line.trim(), landmark: landmark.trim() || null, lat: pin?.lat ?? null, lng: pin?.lng ?? null } }).catch(() => {})
      if (brief && sendBrief) {
        if (brief.photos.length) await request("/api/booking/attach", { body: { bookingId: r.id, phone: normalisePhone(phone), photos: brief.photos.slice(0, 3).map((p) => `data:image/jpeg;base64,${p}`) } }).catch(() => {})
        await clearBrief()
      }
      await rememberBooking({ id: r.id, date, window: win, total: r.total ?? total, services: cart.items.map((i) => i.name), at: new Date().toISOString() })
      placed.current = true
      cart.clear()
      router.replace({ pathname: "/booked/[id]", params: { id: r.id, name: name.trim().split(" ")[0], date, window: win, total: String((r.total ?? total) - (r.credit ?? credit)) } })
    } catch (err) {
      const c = err instanceof ApiError ? err.code : undefined
      if (c === "slotFull") {
        setWin("")
        setSlotsTick((n) => n + 1) // re-reads the windows
      }
      setFailed(c === "slotFull" ? t.slotFull : c === "unavailable" ? t.unavailable : c?.startsWith("promo-") ? fill(t[c as keyof typeof t] ?? t["promo-invalid"], { min: formatPKR(catalog.minOrder) }) : errorText(err, t.offline))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen footer={<Button title={`${t.confirm} · ${formatPKR(total - credit)}`} variant="brand" busy={busy} onPress={submit} />}>
      <Section title={t.where} />
      {addresses.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Txt v="small" style={{ fontWeight: "600" }}>
            {t.savedAddresses}
          </Txt>
          <Row wrap>
            {addresses.map((a) => (
              <Chip key={a.id} label={a.label || catalog.areas.find((x) => x.slug === a.area)?.name || a.area} sub={a.line.slice(0, 24)} selected={addressId === a.id} onPress={() => pickAddress(a)} />
            ))}
            <Chip label={t.newAddress} selected={!addressId} onPress={() => pickAddress(null)} />
          </Row>
        </View>
      )}
      {!addressId && (
        <>
          <Button title={locating ? t.locating : t.myLocation} variant="light" small busy={locating} icon={<LocateFixed size={16} color={color.ink} />} onPress={locate} style={{ alignSelf: "flex-start" }} />
          {locNote && <Notice tone={locNote.tone} text={locNote.text} />}
          <Txt v="small" style={{ fontWeight: "600" }}>
            {t.area}
          </Txt>
          <Row wrap>
            {catalog.areas.map((a) => (
              <Chip
                key={a.slug}
                label={a.name}
                selected={area === a.slug}
                onPress={() => {
                  setArea(a.slug)
                  setSubArea("")
                }}
              />
            ))}
          </Row>
          {errors.area && <Txt v="small" style={{ color: color.red }}>{errors.area}</Txt>}
          {areaObj && areaObj.subAreas.length > 0 && (
            <>
              <Txt v="small" style={{ fontWeight: "600" }}>
                {fill(t.subArea, { area: areaObj.name })}
              </Txt>
              <Row wrap>
                {areaObj.subAreas.map((s) => (
                  <Chip key={s} label={s} selected={subArea === s} onPress={() => setSubArea(subArea === s ? "" : s)} />
                ))}
              </Row>
            </>
          )}
          <Field label={t.address} value={line} onChangeText={setLine} placeholder={t.addressHint} error={errors.line} />
          <Field label={t.landmark} value={landmark} onChangeText={setLandmark} />
          {me && (
            <Row style={{ justifyContent: "space-between" }}>
              <Txt v="small" style={{ flex: 1 }}>
                {t.saveThisAddress}
              </Txt>
              <Switch on={saveAddress} onChange={setSaveAddress} label={t.saveThisAddress} />
            </Row>
          )}
        </>
      )}

      <Section title={t.when} />
      {cart.rebook && <Notice tone={proGone ? "amber" : "sky"} text={proGone ? fill(t.proUnavailable, { name: cart.rebook.firstName }) : fill(t.withPro, { name: cart.rebook.firstName })} />}
      {!area ? (
        <Txt v="muted">{t.pickArea}</Txt>
      ) : slotsError ? (
        <Notice text={errorText(slotsError, t.offline)} onRetry={() => setSlotsTick((n) => n + 1)} retryLabel={t.retry} />
      ) : !slots ? (
        <Loading />
      ) : (
        <>
          <Row wrap>
            {slots.days.map((d) => {
              const open = d.windows.some((w) => w.open)
              return <Chip key={d.date} label={formatDay(d.date, lang)} sub={open ? undefined : t.full} disabled={!open} selected={date === d.date} onPress={() => setDate(d.date)} />
            })}
          </Row>
          {day && (
            <Row wrap>
              {day.windows.map((w) => (
                <Chip key={w.label} label={windowLabel(w.label, lang)} sub={w.open ? undefined : t.full} disabled={!w.open} selected={win === w.label} onPress={() => setWin(w.label)} />
              ))}
            </Row>
          )}
          <Txt v="muted">{fill(t.windowNote, { hours: catalog.policy.freeChangeHours })}</Txt>
        </>
      )}
      {errors.when && <Txt v="small" style={{ color: color.red }}>{errors.when}</Txt>}

      <Section title={t.who} />
      <Field label={t.name} value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
      <Field label={t.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0300 1234567" error={errors.phone} hint={t.phoneHint} editable={!me?.customer.phone} />

      <Section title={t.pay} />
      <Row wrap>
        {(["cash", "jazzcash", "easypaisa", "raast"] as const).map((p) => (
          <Chip key={p} label={p === "cash" ? t.cash : p === "jazzcash" ? "JazzCash" : p === "easypaisa" ? "Easypaisa" : "Raast"} sub={p === "cash" ? undefined : t.sendAfter} selected={pay === p} onPress={() => setPay(p)} />
        ))}
      </Row>
      <Txt v="muted">{pay === "cash" ? t.cashSub : t.nothingNow}</Txt>
      <Field label={t.notes} value={notes} onChangeText={setNotes} placeholder={t.notesHint} multiline maxLength={500} />
      {brief && (
        <Card>
          <Row style={{ alignItems: "flex-start" }}>
            {brief.photos[0] ? <Image source={{ uri: `data:image/jpeg;base64,${brief.photos[0]}` }} style={{ width: 56, height: 56, borderRadius: 12 }} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="tiny">{t.briefFor}</Txt>
              <Txt v="h3">{brief.title}</Txt>
            </View>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="small" style={{ flex: 1 }}>{t.briefSend}</Txt>
            <Switch on={sendBrief} onChange={setSendBrief} label={t.briefSend} />
          </Row>
        </Card>
      )}

      <Section title={t.promo} />
      <Row>
        <View style={{ flex: 1 }}>
          <Field value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="WELCOME10" autoCapitalize="none" maxLength={20} />
        </View>
        <Button title={t.apply} variant="light" small busy={checking} onPress={applyPromo} />
      </Row>
      {promo && (promo.ok ? <Notice tone="green" text={fill(t.promoOff, { code: promo.code, amount: formatPKR(promo.discount) })} /> : <Notice tone="amber" text={promoProblem(promo)} />)}
      {me ? (
        me.credit.available > 0 && (
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="small" style={{ flex: 1 }}>
              {fill(t.useCredit, { amount: formatPKR(me.credit.available) })}
            </Txt>
            <Switch on={useCredit} onChange={setUseCredit} label={t.useCredit} />
          </Row>
        )
      ) : (
        <Txt v="muted">{t.signInPerks}</Txt>
      )}

      <Card>
        <Txt v="h3">{t.summary}</Txt>
        {cart.items.map((i) => (
          <Line key={i.key} label={`${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`} value={i.unitPrice > 0 ? formatPKR(i.unitPrice * i.qty) : t.onRequest} />
        ))}
        {discount > 0 && <Line label={usingPlus ? fill(t.plusLine, { pct: plus!.discountPct }) : promo?.ok && promo.kind === "referral" ? fill(t.friendWelcome, { code: promo.code }) : t.discount} value={`− ${formatPKR(discount)}`} />}
        {credit > 0 && <Line label={t.creditUsed} value={`− ${formatPKR(credit)}`} />}
        <Line label={t.payAfter} value={total - credit > 0 ? formatPKR(total - credit) : t.onRequest} strong />
      </Card>
      {failed ? <Notice text={failed} /> : null}
    </Screen>
  )
}
