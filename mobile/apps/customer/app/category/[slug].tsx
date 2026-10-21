import { Button, CatalogIcon, color, Loading, Notice, radius, Row, Screen, space, Txt, whatsappLink } from "@mjazo/shared"
import { Stack, useLocalSearchParams } from "expo-router"
import { Linking, View } from "react-native"
import { CartBar, ServiceRow } from "../../src/parts"
import { useCatalog, useT } from "../../src/state"

// A category: what it is, what's included, and its services. One that isn't live yet says so and
// offers WhatsApp.

export default function CategoryScreen() {
  const t = useT()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { catalog } = useCatalog()
  const c = catalog?.categories.find((x) => x.slug === slug)
  if (!catalog) return <Loading label={t.loading} />
  if (!c) return <Notice text={t.unavailable} />
  const world = catalog.worlds.find((w) => w.slug === c.world)
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: c.name }} />
      <Screen>
        <Row gap={space.md}>
          <View style={{ backgroundColor: world?.tint || color.brandSoft, borderRadius: radius.md, padding: 12 }}>
            <CatalogIcon name={c.icon} size={28} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="h2">{c.name}</Txt>
            <Txt v="muted">{c.tagline}</Txt>
          </View>
        </Row>
        {c.status === "waitlist" ? (
          <View style={{ gap: space.sm }}>
            <Notice tone="amber" text={`${t.soonTitle}. ${t.soonBody}`} />
            <Button title={t.whatsappUs} variant="whatsapp" onPress={() => void Linking.openURL(whatsappLink(catalog.contact.whatsapp, c.name))} />
          </View>
        ) : null}
        {c.includes.length > 0 && (
          <View style={{ gap: 4 }}>
            {c.includes.slice(0, 4).map((x) => (
              <Txt key={x} v="small">
                ✓ {x}
              </Txt>
            ))}
          </View>
        )}
        <Txt v="h2" style={{ marginTop: space.sm }}>
          {t.services}
        </Txt>
        {c.services.map((s) => (
          <ServiceRow key={s.slug} c={c} s={s} />
        ))}
        <View style={{ height: 70 }} />
      </Screen>
      <CartBar />
    </View>
  )
}
