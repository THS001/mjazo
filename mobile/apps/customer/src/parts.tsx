import { Badge, Card, Chip, color, fill, formatPKR, radius, Row, space, Txt, useDir, useLang, type BookingStatus, type Category, type CustomerBooking, type Service } from "@mjazo/shared"
import { router } from "expo-router"
import { ShoppingBag } from "lucide-react-native"
import type { ReactNode } from "react"
import { Pressable, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useCart, useT } from "./state"
import type { CustomerStrings } from "./strings"

// Pieces several screens share: the cart bar, a service's price and time, a booking's steps and
// status, and the language switch.

/** "45 min" / "1.5 hr". */
export function duration(min: number, t: CustomerStrings) {
  return min < 60 ? fill(t.minutes, { n: min }) : fill(t.hours, { n: Math.round((min / 60) * 10) / 10 })
}

export const servicePrice = (s: Pick<Service, "price">, t: CustomerStrings) => (s.price > 0 ? fill(t.from, { price: formatPKR(s.price) }) : t.onRequest)

/** The bar at the bottom of the browsing screens: how much is in the cart, and the way to it. */
export function CartBar() {
  const t = useT()
  const { count, subtotal } = useCart()
  const insets = useSafeAreaInsets()
  const { row } = useDir()
  if (!count) return null
  return (
    <View style={{ position: "absolute", left: space.lg, right: space.lg, bottom: insets.bottom + space.md }}>
      <Pressable accessibilityRole="button" onPress={() => router.push("/cart")} style={({ pressed }) => ({ flexDirection: row, alignItems: "center", gap: space.md, backgroundColor: color.ink, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 56, opacity: pressed ? 0.9 : 1, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 })}>
        <ShoppingBag size={20} color={color.brand} />
        <Text style={{ color: color.paper, fontWeight: "600", flex: 1 }}>{fill(t.cartCount, { n: count })}</Text>
        <Text style={{ color: color.paper, fontWeight: "700" }}>
          {subtotal > 0 ? `${formatPKR(subtotal)} · ` : ""}
          {t.viewCart}
        </Text>
      </Pressable>
    </View>
  )
}

const STEP_ORDER = ["booked", "assigned", "onTheWay", "arrived", "done"] as const

/** Booked → pro assigned → on the way → arrived → done, with the current one highlighted. */
export function Steps({ b }: { b: CustomerBooking }) {
  const t = useT()
  const { row } = useDir()
  const labels = { booked: t.stepBooked, assigned: t.stepAssigned, onTheWay: t.stepOnTheWay, arrived: t.stepArrived, done: t.stepDone }
  const reached = STEP_ORDER.filter((s) => b.steps[s]).length
  return (
    <View style={{ flexDirection: row, gap: 4 }}>
      {STEP_ORDER.map((s, i) => (
        <View key={s} style={{ flex: 1, gap: 4 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: i < reached ? color.ink : "#E2E2E2" }} />
          <Text style={{ fontSize: 10, color: i < reached ? color.ink : color.faint, textAlign: "center" }} numberOfLines={1}>
            {labels[s]}
          </Text>
        </View>
      ))}
    </View>
  )
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const t = useT()
  const map: Partial<Record<BookingStatus, [string, "neutral" | "brand" | "green" | "red" | "sky" | "violet"]>> = {
    new: [t.stepBooked, "neutral"],
    assigned: [t.stepAssigned, "sky"],
    en_route: [t.stepOnTheWay, "brand"],
    checked_in: [t.stepArrived, "violet"],
    checked_out: [t.stepArrived, "violet"],
    completed: [t.stepDone, "green"],
    cancelled: [t.statusCancelled, "red"],
    no_show: [t.statusMissed, "red"],
  }
  const [text, tone] = map[status] ?? [status, "neutral"]
  return <Badge text={text} tone={tone} />
}

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <Row>
      <Chip label="English" selected={lang === "en"} onPress={() => setLang("en")} />
      <Chip label="اردو" selected={lang === "ur"} onPress={() => setLang("ur")} />
    </Row>
  )
}

/** A heading for a section of a screen. */
export const Section = ({ title }: { title: string }) => (
  <Txt v="h2" style={{ marginTop: space.md }}>
    {title}
  </Txt>
)

/** A service in a list: name, short line and price; opens the service. */
export function ServiceRow({ c, s }: { c: Category; s: Service }) {
  const t = useT()
  return (
    <Card onPress={() => router.push(`/service/${c.slug}/${s.slug}`)}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="h3">{s.name}</Txt>
          <Txt v="muted" numberOfLines={2}>
            {s.short || c.name}
          </Txt>
        </View>
        <Txt v="small" style={{ fontWeight: "700" }}>
          {servicePrice(s, t)}
        </Txt>
      </Row>
    </Card>
  )
}

/** A round − / + button. */
export function Stepper({ icon, onPress, label }: { icon: ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: color.field, alignItems: "center", justifyContent: "center", backgroundColor: color.paper, opacity: pressed ? 0.7 : 1 })}>
      {icon}
    </Pressable>
  )
}
