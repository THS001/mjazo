import { Badge, Button, Card, Empty, errorText, Field, fill, formatDay, formatTime, Loading, Notice, Row, Screen, Sheet, space, Txt, useLang, windowLabel, type Offer } from "@mjazo/shared"
import { useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { money } from "../../src/parts"
import { useSchedule } from "../../src/schedule"
import { useSession, useT } from "../../src/session"

// Offers: visits ops (or auto-assign) offered her, open ones first with the time to answer by.
// Before she accepts she sees where and what and what she'd earn; who comes once it's hers.

export default function Offers() {
  const t = useT()
  const { lang } = useLang()
  const { api } = useSession()
  const { reload: reloadSchedule } = useSchedule()
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState("")
  const [declining, setDeclining] = useState<Offer | null>(null)
  const [reason, setReason] = useState("")
  const [msg, setMsg] = useState<{ text: string; tone: "green" | "red" } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setOffers((await api<{ offers: Offer[] }>("/api/v1/pro/offers")).offers)
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [api])
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )
  const answer = async (o: Offer, accept: boolean) => {
    setBusy(o.id)
    setMsg(null)
    try {
      await api(`/api/v1/pro/offers/${o.id}`, { body: { accept, ...(accept || !reason.trim() ? {} : { reason: reason.trim() }) } })
      setMsg({ text: accept ? t.accepted : t.declined, tone: "green" })
      setDeclining(null)
      setReason("")
      await Promise.all([load(), reloadSchedule()])
    } catch (e) {
      setMsg({ text: errorText(e, t.offline), tone: "red" })
      await load()
    } finally {
      setBusy("")
    }
  }
  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (!offers) return error ? <Notice text={errorText(error, t.offline)} onRetry={refresh} retryLabel={t.retry} /> : <Loading />
  const open = offers.filter((o) => o.status === "pending")
  const earlier = offers.filter((o) => o.status !== "pending")
  const label = { accepted: [t.acceptedShort, "green"], declined: [t.declined, "neutral"], expired: [t.expired, "amber"], withdrawn: [t.withdrawn, "neutral"] } as const

  return (
    <Screen top refreshing={refreshing} onRefresh={refresh}>
      <Txt v="title">{t.tabOffers}</Txt>
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      {!offers.length && <Empty title={t.noOffers} />}
      {open.length > 0 && <Txt v="h2">{t.newOffers}</Txt>}
      {open.map((o) => (
        <Card key={o.id}>
          <OfferBody o={o} lang={lang} />
          <Txt v="small" style={{ fontWeight: "700" }}>{`${t.answerBy} ${formatTime(o.expiresAt)}`}</Txt>
          <Txt v="muted">{t.whoLater}</Txt>
          <Row>
            <Button title={t.accept} variant="brand" busy={busy === o.id} onPress={() => answer(o, true)} style={{ flex: 1 }} />
            <Button title={t.decline} variant="light" disabled={busy === o.id} onPress={() => setDeclining(o)} style={{ flex: 1 }} />
          </Row>
        </Card>
      ))}
      {earlier.length > 0 && <Txt v="h2">{t.earlier}</Txt>}
      {earlier.map((o) => (
        <Card key={o.id} style={{ opacity: 0.8 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="h3" style={{ flex: 1 }}>{`${formatDay(o.visit.date, lang)}, ${windowLabel(o.visit.window, lang)}`}</Txt>
            {o.status in label && <Badge text={label[o.status as keyof typeof label][0]} tone={label[o.status as keyof typeof label][1]} />}
          </Row>
          <Txt v="muted">{o.visit.services.map((s) => s.name).join(", ")}</Txt>
        </Card>
      ))}
      <Sheet open={Boolean(declining)} onClose={() => setDeclining(null)}>
        {declining && (
          <View style={{ gap: space.md }}>
            <Txt v="h2">{t.decline}</Txt>
            <OfferBody o={declining} lang={lang} />
            <Field label={t.declineWhy} value={reason} onChangeText={setReason} multiline maxLength={300} />
            <Button title={t.sendDecline} variant="danger" busy={busy === declining.id} onPress={() => answer(declining, false)} />
          </View>
        )}
      </Sheet>
    </Screen>
  )
}

function OfferBody({ o, lang }: { o: Offer; lang: string }) {
  const t = useT()
  return (
    <>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h3" style={{ flex: 1 }}>
          {[o.visit.subArea, o.visit.area].filter(Boolean).join(", ")}
        </Txt>
        <Txt v="h3">{money(o.visit.earn)}</Txt>
      </Row>
      <Txt>{fill(t.offerTime, { date: formatDay(o.visit.date, lang), window: windowLabel(o.visit.window, lang), min: o.visit.minutes })}</Txt>
      <Txt v="muted">{o.visit.services.map((s) => `${s.name}${s.qty > 1 ? ` ×${s.qty}` : ""}`).join(", ")}</Txt>
      {o.visit.askedForYou && <Badge text={t.askedForYou} tone="violet" />}
    </>
  )
}
