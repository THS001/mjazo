import { Card, Empty, errorText, fill, formatDay, Loading, Notice, Row, Screen, space, Txt, useLang } from "@mjazo/shared"
import { router } from "expo-router"
import { useState } from "react"
import { View } from "react-native"
import { money, SosButton, VisitCard } from "../../src/parts"
import { useSchedule } from "../../src/schedule"
import { useSession, useT } from "../../src/session"

// Today: her visits in route order (with any safety prompt), her week's earnings, new offers
// waiting, the coming days, and SOS always at hand.

export default function Today() {
  const t = useT()
  const { lang } = useLang()
  const { session } = useSession()
  const { schedule, error, reload } = useSchedule()
  const [refreshing, setRefreshing] = useState(false)
  const refresh = async () => {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }
  if (session.state !== "in") return null
  const first = session.pro.name.split(" ")[0]
  if (!schedule) return error ? <Notice text={errorText(error, t.offline)} onRetry={refresh} retryLabel={t.retry} /> : <Loading />
  const today = schedule.days[0]?.visits ?? []
  const left = today.filter((v) => !["completed", "cancelled", "no_show"].includes(v.status)).length
  const coming = schedule.days.slice(1).filter((d) => d.visits.length)

  return (
    <Screen top refreshing={refreshing} onRefresh={refresh}>
      <Row style={{ justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Txt v="title">{fill(t.salaamName, { name: first })}</Txt>
          <Txt v="muted">{formatDay(schedule.today, lang)}</Txt>
        </View>
        <SosButton compact />
      </Row>
      <Row gap={space.sm}>
        <Card style={{ flex: 1 }}>
          <Txt v="tiny">{t.tabToday}</Txt>
          <Txt v="h2">{`${left} / ${today.length}`}</Txt>
          <Txt v="muted">{t.stillToGo}</Txt>
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt v="tiny">{t.week}</Txt>
          <Txt v="h2">{money(schedule.week.earned)}</Txt>
          <Txt v="muted">{fill(t.visitsN, { n: schedule.week.visits })}</Txt>
        </Card>
      </Row>
      {schedule.openOffers > 0 && (
        <Card tint="#FDF1DE" onPress={() => router.push("/offers")}>
          <Txt v="h3">{fill(t.offersWaiting, { n: schedule.openOffers })}</Txt>
        </Card>
      )}
      {today.length ? today.map((v) => <VisitCard key={v.id} v={v} />) : <Empty title={t.noVisits} body={t.noJobs} />}
      {coming.length > 0 && <Txt v="h2">{t.comingDays}</Txt>}
      {coming.map((d, i) => (
        <View key={d.date} style={{ gap: space.sm }}>
          <Txt v="h3">{d.date === schedule.days[1]?.date && i === 0 ? `${t.tomorrow} · ${formatDay(d.date, lang)}` : formatDay(d.date, lang)}</Txt>
          {d.visits.map((v) => (
            <VisitCard key={v.id} v={v} />
          ))}
        </View>
      ))}
    </Screen>
  )
}
