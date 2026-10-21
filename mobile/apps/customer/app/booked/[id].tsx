import { Button, Card, color, fill, formatDay, formatPKR, Line, Row, Screen, space, Txt, useLang, whatsappLink, windowLabel } from "@mjazo/shared"
import { router, useLocalSearchParams } from "expo-router"
import { CircleCheck } from "lucide-react-native"
import { Linking, View } from "react-native"
import { useAccount, useCatalog, useT } from "../../src/state"

// "You're booked": the booking number, when, what's left to pay, and what happens next.

export default function Booked() {
  const t = useT()
  const { lang } = useLang()
  const { catalog } = useCatalog()
  const { account } = useAccount()
  const p = useLocalSearchParams<{ id: string; name?: string; date?: string; window?: string; total?: string }>()
  const total = Number(p.total ?? 0)
  return (
    <Screen top>
      <View style={{ alignItems: "center", gap: space.sm, paddingVertical: space.xl }}>
        <CircleCheck size={56} color={color.green} />
        <Txt v="title" center>
          {p.name ? fill(t.bookedName, { name: p.name }) : t.booked}
        </Txt>
        <Txt v="muted" center selectable>
          {fill(t.reference, { ref: p.id })}
        </Txt>
      </View>
      <Card>
        {p.date && p.window && <Line label={t.when2} value={`${formatDay(p.date, lang)}, ${windowLabel(p.window, lang)}`} />}
        <Line label={t.payAfter} value={total > 0 ? formatPKR(total) : t.onRequest} strong />
      </Card>
      <Card>
        <Txt v="h3">{t.nextTitle}</Txt>
        {[t.next1, t.next2, t.next3, t.next4].map((x, i) => (
          <Row key={x} style={{ alignItems: "flex-start" }}>
            <Txt v="small" style={{ fontWeight: "700", width: 18 }}>
              {i + 1}
            </Txt>
            <Txt v="small" style={{ flex: 1 }}>
              {x}
            </Txt>
          </Row>
        ))}
      </Card>
      <Button title={t.myBookings} onPress={() => router.replace(account.state === "in" ? { pathname: "/booking/[id]", params: { id: p.id } } : "/bookings")} />
      {catalog && <Button title={t.whatsappUs} variant="whatsapp" onPress={() => void Linking.openURL(whatsappLink(catalog.contact.whatsapp, `${p.id}`))} />}
      <Button title={t.keepBrowsing} variant="ghost" onPress={() => router.replace("/")} />
    </Screen>
  )
}
