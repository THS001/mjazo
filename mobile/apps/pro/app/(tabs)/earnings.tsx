import { Badge, Card, Empty, errorText, fill, formatDay, Line, Loading, Notice, Row, Screen, Txt, useLang, karachiNow, type Earnings as E } from "@mjazo/shared"
import { useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { money } from "../../src/parts"
import { useSession, useT } from "../../src/session"

// Earnings, from the money ledger: what Mjazo owes her, the cash she holds, what the next payout
// comes to, her week and month, her payouts and her statement.

export default function Earnings() {
  const t = useT()
  const { lang } = useLang()
  const { api } = useSession()
  const [e, setE] = useState<E | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [refreshing, setRefreshing] = useState(false)
  const load = useCallback(async () => {
    try {
      setE(await api<E>("/api/v1/pro/earnings"))
      setError(null)
    } catch (x) {
      setError(x)
    }
  }, [api])
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
  if (!e) return error ? <Notice text={errorText(error, t.offline)} onRetry={refresh} retryLabel={t.retry} /> : <Loading />
  const net = e.balances.net
  const day = (iso: string) => formatDay(karachiNow(new Date(iso)).date, lang)
  return (
    <Screen top refreshing={refreshing} onRefresh={refresh}>
      <Txt v="title">{t.tabMoney}</Txt>
      <Card>
        <Line label={t.owed} value={money(e.balances.owed)} />
        <Line label={t.cashHeld} value={money(e.balances.cashHeld)} />
        <Txt v="h3">{net > 0 ? fill(t.owesNet, { amount: money(net) }) : net < 0 ? fill(t.handInNet, { amount: money(net) }) : t.settled}</Txt>
      </Card>
      <Row>
        <Card style={{ flex: 1 }}>
          <Txt v="tiny">{t.thisWeek}</Txt>
          <Txt v="h2">{money(e.week.earned)}</Txt>
          <Txt v="muted">{fill(t.visitsN, { n: e.week.visits })}</Txt>
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt v="tiny">{t.last30}</Txt>
          <Txt v="h2">{money(e.month.earned)}</Txt>
          <Txt v="muted">{fill(t.visitsN, { n: e.month.visits })}</Txt>
        </Card>
      </Row>

      <Txt v="h2">{t.payouts}</Txt>
      {!e.payouts.length && <Txt v="muted">{t.noPayouts}</Txt>}
      {e.payouts.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="h3">{`${formatDay(p.periodStart, lang)} – ${formatDay(p.periodEnd, lang)}`}</Txt>
            <Badge text={p.status === "paid" ? t.paid : p.status === "approved" ? t.approved : p.status === "draft" ? t.draft : p.status} tone={p.status === "paid" ? "green" : p.status === "approved" ? "sky" : "neutral"} />
          </Row>
          <Line label={p.amount >= 0 ? (p.status === "paid" ? t.paidYou : t.payYou) : p.status === "paid" ? t.handedIn : t.handIn} value={money(p.amount)} strong />
          <Txt v="muted">{`${t.earnedCol} ${money(p.earned)} · ${t.cashCol} ${money(p.cashHeld)}`}</Txt>
        </Card>
      ))}

      <Txt v="h2">{t.statement}</Txt>
      {!e.statement.length && <Empty title={t.noStatement} />}
      {e.statement.length > 0 && (
        <Card>
          {e.statement.map((s) => (
            <View key={s.entryId} style={{ paddingVertical: 4 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt v="small" style={{ flex: 1 }}>
                  {`${day(s.at)} · ${s.bookingId ?? s.kind}`}
                </Txt>
                <Txt v="small" style={{ fontWeight: "600" }}>
                  {s.earned ? `${s.earned > 0 ? "+" : "−"}${money(s.earned)}` : ""}
                  {s.cash ? `  ${t.cashCol} ${s.cash > 0 ? "+" : "−"}${money(s.cash)}` : ""}
                </Txt>
              </Row>
              {s.memo ? <Txt v="muted">{s.memo}</Txt> : null}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  )
}
