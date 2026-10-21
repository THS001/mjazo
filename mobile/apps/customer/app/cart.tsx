import { Button, Card, color, Empty, fill, formatPKR, Line, Notice, Row, Screen, space, Txt } from "@mjazo/shared"
import { router } from "expo-router"
import { Minus, Plus, Trash2 } from "lucide-react-native"
import { Pressable, View } from "react-native"
import { Stepper } from "../src/parts"
import { useCart, useCatalog, useT } from "../src/state"

// The cart: each line with its choices, how many, the subtotal, and the minimum order.

export default function CartScreen() {
  const t = useT()
  const cart = useCart()
  const { catalog } = useCatalog()
  const min = catalog?.minOrder ?? 0
  // A visit priced on request has no total yet: the minimum only counts for priced visits.
  const short = cart.subtotal > 0 && cart.subtotal < min
  if (!cart.items.length)
    return (
      <Screen>
        <Empty title={t.emptyTitle} body={t.emptyBody} action={<Button title={t.browse} onPress={() => router.navigate("/")} />} />
      </Screen>
    )
  return (
    <Screen footer={<Button title={t.bookTime} variant="brand" disabled={short} onPress={() => router.push("/checkout")} />}>
      {cart.rebook && <Notice tone="sky" text={fill(t.withPro, { name: cart.rebook.firstName })} />}
      {cart.items.map((i) => (
        <Card key={i.key}>
          <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="h3">{i.name}</Txt>
              {[...i.optionLabels, ...i.addOnNames].length > 0 && <Txt v="muted">{[...i.optionLabels, ...i.addOnNames].join(" · ")}</Txt>}
            </View>
            <Txt v="small" style={{ fontWeight: "700" }}>
              {i.unitPrice > 0 ? formatPKR(i.unitPrice * i.qty) : t.onRequest}
            </Txt>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Row gap={space.md}>
              <Stepper icon={<Minus size={16} color={color.ink} />} label="−" onPress={() => cart.setQty(i.key, i.qty - 1)} />
              <Txt v="h3">{i.qty}</Txt>
              <Stepper icon={<Plus size={16} color={color.ink} />} label="+" onPress={() => cart.setQty(i.key, i.qty + 1)} />
            </Row>
            <Pressable accessibilityRole="button" accessibilityLabel={t.remove} onPress={() => cart.remove(i.key)} hitSlop={10}>
              <Row gap={4}>
                <Trash2 size={16} color={color.red} />
                <Txt v="small" style={{ color: color.red }}>
                  {t.remove}
                </Txt>
              </Row>
            </Pressable>
          </Row>
        </Card>
      ))}
      <Card>
        <Line label={t.subtotal} value={cart.subtotal > 0 ? formatPKR(cart.subtotal) : t.onRequest} strong />
        <Txt v="muted">{t.nothingNow}</Txt>
      </Card>
      {short && <Notice tone="amber" text={fill(t.errMin, { min: formatPKR(min) })} />}
    </Screen>
  )
}
