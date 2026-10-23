import { Button, Card, Empty, errorText, fill, formatAmount, formatDay, formatPKR, formatTime, Loading, Notice, Row, Screen, space, Txt, useLang, windowLabel, type CustomerBooking } from "@mjazo/shared"
import { router, useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { Steps, StatusBadge } from "../../src/parts"
import { deviceBookings, useAccount, useT, type DeviceBooking } from "../../src/state"

// Bookings: signed in, every visit live (coming up first, then past ones); signed out, the ones
// made on this phone, and a nudge to sign in to follow them.

export default function Bookings() {
  const t = useT()
  const { lang } = useLang()
  const { account, api } = useAccount()
  const [list, setList] = useState<{ upcoming: CustomerBooking[]; past: CustomerBooking[] } | null>(null)
  const [local, setLocal] = useState<DeviceBooking[]>([])
  const [error, setError] = useState<unknown>(null)
  const [refreshing, setRefreshing] = useState(false)
  const signedIn = account.state === "in"

  const load = useCallback(async () => {
    setLocal(await deviceBookings())
    if (!signedIn) return
    try {
      setList(await api("/api/v1/customer/bookings"))
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [api, signedIn])
  // Fresh every time the tab is opened, so a pro on the way shows at once.
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )
  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (account.state === "loading") return <Loading />
  return (
    <Screen top refreshing={refreshing} onRefresh={refresh}>
      <Txt v="title">{t.bookings}</Txt>
      {!signedIn && (
        <>
          <Notice tone="sky" text={t.signInToSee} />
          <Button title={account.state === "phone" ? t.continue : t.signIn} onPress={() => router.push(account.state === "phone" ? "/phone" : "/login")} />
          {local.length > 0 && <Txt v="h2">{t.onThisPhone}</Txt>}
          {local.map((b) => (
            <Card key={b.id}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt v="h3">{`${formatDay(b.date, lang)}, ${windowLabel(b.window, lang)}`}</Txt>
                <Txt v="small" selectable>
                  {b.id}
                </Txt>
              </Row>
              <Txt v="muted">{b.services.join(", ")}</Txt>
            </Card>
          ))}
          {!local.length && <Empty title={t.noBookings} body={t.noBookingsBody} />}
        </>
      )}
      {signedIn && error && !list ? <Notice text={errorText(error, t.offline)} onRetry={refresh} retryLabel={t.retry} /> : null}
      {signedIn && !list && !error ? <Loading /> : null}
      {signedIn && list && (
        <>
          {!list.upcoming.length && !list.past.length && <Empty title={t.noBookings} body={t.noBookingsBody} action={<Button title={t.browse} onPress={() => router.navigate("/")} />} />}
          {list.upcoming.length > 0 && <Txt v="h2">{t.upcomingTitle}</Txt>}
          {list.upcoming.map((b) => (
            <BookingCard key={b.id} b={b} />
          ))}
          {list.past.length > 0 && <Txt v="h2">{t.pastTitle}</Txt>}
          {list.past.map((b) => (
            <BookingCard key={b.id} b={b} />
          ))}
        </>
      )}
    </Screen>
  )
}

function BookingCard({ b }: { b: CustomerBooking }) {
  const t = useT()
  const { lang } = useLang()
  const open = !["completed", "cancelled", "no_show"].includes(b.status)
  return (
    <Card onPress={() => router.push({ pathname: "/booking/[id]", params: { id: b.id } })}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h3" style={{ flex: 1 }}>{`${formatDay(b.date, lang)}, ${windowLabel(b.window, lang)}`}</Txt>
        <StatusBadge status={b.status} />
      </Row>
      <Txt v="muted" numberOfLines={2}>
        {b.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")}
      </Txt>
      {open && b.status !== "new" && <Steps b={b} />}
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="small">{b.pro ? fill(t.yourPro, { name: b.pro.firstName }) : b.areaName}</Txt>
        <Txt v="small" style={{ fontWeight: "700" }}>
          {b.credit > 0 || b.pack ? formatAmount(b.due) : formatPKR(b.due)}
        </Txt>
      </Row>
      {b.status === "en_route" && b.live && b.live.minutes !== null && (
        <Txt v="small" style={{ fontWeight: "600" }}>
          {fill(t.liveAway, { name: b.pro?.firstName ?? "", minutes: b.live.minutes, km: b.live.km ?? "" })}
        </Txt>
      )}
      {b.status === "en_route" && !b.live && b.eta && (
        <View>
          <Txt v="small" style={{ fontWeight: "600" }}>
            {fill(t.eta, { time: formatTime(b.eta) })}
          </Txt>
        </View>
      )}
      {b.status === "completed" && !b.rating && <Txt v="small" style={{ fontWeight: "600", marginTop: space.xs }}>★ {t.rate}</Txt>}
    </Card>
  )
}
