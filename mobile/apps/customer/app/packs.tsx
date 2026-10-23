import { Button, Card, color, errorText, fill, formatDay, formatPKR, karachiNow, Loading, Notice, Row, Screen, space, Txt, useLang, type MyPack, type PackOffer, type Packs } from "@mjazo/shared"
import { router, useFocusEffect } from "expo-router"
import { CalendarCheck, Check, Repeat } from "lucide-react-native"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { Section } from "../src/parts"
import { useAccount, useCart, useT } from "../src/state"

// Packs (prepaid visits), as on the website's Account → Packs: theirs, with "Book your next visit"
// (the visit goes in the cart and checkout uses the pack), and the packs on offer to ask for. Ops
// take the money and activate a pack in mission control.

export default function PacksScreen() {
  const t = useT()
  const { lang } = useLang()
  const { account, api } = useAccount()
  const cart = useCart()
  const [data, setData] = useState<Packs | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState("")
  const [asked, setAsked] = useState("")
  const signedIn = account.state === "in"
  const load = useCallback(async () => {
    try {
      setData(await api<Packs>(`/api/v1/customer/packs?lang=${lang}`))
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [api, lang])
  useFocusEffect(
    useCallback(() => {
      if (signedIn) void load()
    }, [signedIn, load]),
  )
  const ask = async (o: PackOffer) => {
    setBusy(o.slug)
    setError(null)
    try {
      setData(await api<Packs>(`/api/v1/customer/packs?lang=${lang}`, { body: { slug: o.slug } }))
      setAsked(o.slug)
    } catch (e) {
      setError(e)
    } finally {
      setBusy("")
    }
  }
  const book = (k: MyPack) => {
    const l = k.line!
    // One visit in the cart (unless it's there already), then checkout with the pack.
    const has = cart.items.some((i) => i.service === l.service && (l.service.startsWith("bundle-") || (i.category === l.category && i.options.join("|") === l.options.join("|"))))
    if (!has) cart.add({ name: k.itemName, category: l.category, service: l.service, options: l.options, optionLabels: l.options, addOns: [], addOnNames: [], qty: 1, unitPrice: l.unitPrice, duration: l.duration })
    router.push({ pathname: "/checkout", params: { pack: k.id } })
  }

  if (account.state === "loading") return <Loading />
  if (!signedIn)
    return (
      <Screen>
        <Txt v="muted">{t.packsIntro}</Txt>
        <Card>
          <Txt v="h3">{t.packSignIn}</Txt>
          <Button title={account.state === "phone" ? t.continue : t.signIn} onPress={() => router.push(account.state === "phone" ? "/phone" : "/login")} />
        </Card>
      </Screen>
    )
  if (!data) return error ? <Notice text={errorText(error, t.offline)} onRetry={load} retryLabel={t.retry} /> : <Loading />
  const waiting = new Set(data.mine.filter((k) => k.status === "requested").map((k) => k.slug))
  return (
    <Screen>
      <Txt v="muted">{t.packsIntro}</Txt>
      {error ? <Notice text={errorText(error, t.offline)} /> : null}
      {data.mine.length > 0 && (
        <>
          <Section title={t.packsYours} />
          {data.mine.map((k) => (
            <Mine key={k.id} k={k} onBook={() => book(k)} />
          ))}
        </>
      )}
      <Section title={t.packsOnOffer} />
      {!data.offers.length && <Txt v="muted">{t.packsNone}</Txt>}
      {data.offers.map((o) => (
        <Card key={o.slug}>
          <Row>
            <Repeat size={20} color={color.ink} />
            <Txt v="h3" style={{ flex: 1 }}>
              {o.name}
            </Txt>
          </Row>
          <Txt v="small">{fill(t.packVisitsEvery, { visits: o.visits, days: o.everyDays })}</Txt>
          <Txt v="muted">{o.note || o.itemName}</Txt>
          <View style={{ gap: 2 }}>
            <Txt v="h3">{fill(t.packAVisit, { price: formatPKR(o.visitPrice) })}</Txt>
            {o.listPrice > o.visitPrice && <Txt v="muted" style={{ textDecorationLine: "line-through" }}>{fill(t.packInsteadOf, { price: formatPKR(o.listPrice) })}</Txt>}
            <Txt v="small">{fill(t.packUpfront, { total: formatPKR(o.total), saving: formatPKR(o.saving) })}</Txt>
            <Txt v="muted">{fill(t.packUseWithin, { days: o.validDays })}</Txt>
          </View>
          {waiting.has(o.slug) ? (
            <Notice tone="green" text={asked === o.slug ? fill(t.packAsked, { total: formatPKR(o.total) }) : fill(t.packWaiting, { total: formatPKR(o.total) })} />
          ) : (
            <Button title={t.packGet} variant="brand" busy={busy === o.slug} disabled={Boolean(busy)} onPress={() => void ask(o)} />
          )}
        </Card>
      ))}
    </Screen>
  )
}

/** One of their packs: visits left, by when, the next one due, and booking it. */
function Mine({ k, onBook }: { k: MyPack; onBook: () => void }) {
  const t = useT()
  const { lang } = useLang()
  const canBook = k.status === "active" && !k.expired && k.left > 0 && Boolean(k.line)
  const status =
    k.status === "requested"
      ? fill(t.packWaiting, { total: formatPKR(k.total) })
      : k.expired
        ? t.packEnded
        : k.left === 0 && k.booked === 0
          ? t.packAllUsed
          : [fill(t.packLeft, { left: k.left, visits: k.visits }), k.booked ? fill(t.packBooked, { count: k.booked }) : ""].filter(Boolean).join(" · ")
  return (
    <Card tint={canBook ? color.brandSoft : undefined}>
      <Row>
        {k.status === "requested" ? <Check size={20} color={color.ink} /> : <Repeat size={20} color={color.ink} />}
        <View style={{ flex: 1 }}>
          <Txt v="h3">{k.name}</Txt>
          <Txt v="muted">{k.itemName}</Txt>
        </View>
      </Row>
      <Txt style={{ fontWeight: "600" }}>{status}</Txt>
      {k.status === "active" && !k.expired && k.endsAt && <Txt v="small">{fill(t.packUntil, { date: formatDay(karachiNow(new Date(k.endsAt)).date, lang) })}</Txt>}
      {canBook && k.nextDue && (
        <Row gap={space.xs}>
          <CalendarCheck size={16} color={color.ink} />
          <Txt v="small">{fill(t.packNextDue, { date: formatDay(k.nextDue, lang) })}</Txt>
        </Row>
      )}
      {canBook && <Button title={t.packBookNext} onPress={onBook} />}
    </Card>
  )
}
