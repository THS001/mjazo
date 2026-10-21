import { Button, Chip, color, fill, formatPKR, Line, Loading, Notice, Row, Screen, space, Txt, whatsappLink } from "@mjazo/shared"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { Minus, Plus } from "lucide-react-native"
import { useState } from "react"
import { Linking, View } from "react-native"
import { duration, Stepper } from "../../../src/parts"
import { useCart, useCatalog, useT } from "../../../src/state"

// One service: its options (each choice can change the price), add-ons, how many, and "Add to cart"
// with the price that the server will charge (it prices every booking again from the catalogue).

export default function ServiceScreen() {
  const t = useT()
  const { category, slug } = useLocalSearchParams<{ category: string; slug: string }>()
  const { catalog } = useCatalog()
  const cart = useCart()
  const c = catalog?.categories.find((x) => x.slug === category)
  const s = c?.services.find((x) => x.slug === slug)
  const [picked, setPicked] = useState<number[]>([]) // per variant: the chosen option's index
  const [addOns, setAddOns] = useState<string[]>([])
  const [qty, setQty] = useState(1)
  if (!catalog) return <Loading label={t.loading} />
  if (!c || !s) return <Notice text={t.unavailable} />

  const choice = s.variants.map((v, i) => v.options[picked[i] ?? 0])
  const extras = s.addOns.filter((a) => addOns.includes(a.id))
  const unit = s.price > 0 ? Math.max(0, s.price + choice.reduce((n, o) => n + (o?.delta ?? 0), 0) + extras.reduce((n, a) => n + a.price, 0)) : 0
  const live = c.status === "live"

  const add = () => {
    cart.add({
      name: s.name,
      category: c.slug,
      service: s.slug,
      options: choice.map((o) => o.key),
      optionLabels: choice.map((o) => o.label),
      addOns: extras.map((a) => a.id),
      addOnNames: extras.map((a) => a.name),
      qty,
      unitPrice: unit,
      duration: s.duration,
    })
    router.back()
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: c.name }} />
      <Screen
        footer={
          live ? (
            <Button title={unit > 0 ? fill(t.addToCart, { price: formatPKR(unit * qty) }) : t.addToCartPlain} variant="brand" onPress={add} />
          ) : (
            <Button title={t.whatsappUs} variant="whatsapp" onPress={() => void Linking.openURL(whatsappLink(catalog.contact.whatsapp, s.name))} />
          )
        }
      >
        <View style={{ gap: 4 }}>
          <Txt v="title">{s.name}</Txt>
          {s.short ? <Txt v="muted">{s.short}</Txt> : null}
          <Txt v="small" style={{ color: color.muted }}>
            {duration(s.duration, t)} · {s.price > 0 ? fill(t.from, { price: formatPKR(s.price) }) : t.onRequest}
          </Txt>
        </View>
        {!live && <Notice tone="amber" text={`${t.soonTitle}. ${t.soonBody}`} />}
        {s.price <= 0 && live && <Notice tone="sky" text={`${t.onRequest}. ${t.onRequestNote}`} />}

        {s.variants.map((v, vi) => (
          <View key={v.label} style={{ gap: space.sm }}>
            <Txt v="h3">{v.label}</Txt>
            <Row wrap>
              {v.options.map((o, oi) => (
                <Chip key={o.key} label={o.label} sub={o.delta ? `${o.delta > 0 ? "+" : "−"}${formatPKR(Math.abs(o.delta))}` : undefined} selected={(picked[vi] ?? 0) === oi} onPress={() => setPicked((p) => Object.assign([...p], { [vi]: oi }))} />
              ))}
            </Row>
          </View>
        ))}

        {s.addOns.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Txt v="h3">{t.addOns}</Txt>
            <Row wrap>
              {s.addOns.map((a) => (
                <Chip key={a.id} label={a.name} sub={`+${formatPKR(a.price)}`} selected={addOns.includes(a.id)} onPress={() => setAddOns((x) => (x.includes(a.id) ? x.filter((y) => y !== a.id) : [...x, a.id]))} />
              ))}
            </Row>
          </View>
        )}

        {live && (
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="h3">{t.quantity}</Txt>
            <Row gap={space.md}>
              <Stepper icon={<Minus size={18} color={color.ink} />} onPress={() => setQty((n) => Math.max(1, n - 1))} label="−" />
              <Txt v="h3">{qty}</Txt>
              <Stepper icon={<Plus size={18} color={color.ink} />} onPress={() => setQty((n) => Math.min(10, n + 1))} label="+" />
            </Row>
          </Row>
        )}

        {s.includes.length > 0 && (
          <View style={{ gap: 4 }}>
            <Txt v="h3">{t.includes}</Txt>
            {s.includes.map((x) => (
              <Txt key={x} v="small">
                ✓ {x}
              </Txt>
            ))}
          </View>
        )}
        {unit > 0 && live && <Line label={t.subtotal} value={formatPKR(unit * qty)} strong />}
      </Screen>
    </View>
  )
}
