import { Badge, Card, CatalogIcon, color, errorText, fill, Loading, Notice, radius, Row, Screen, space, Txt, useDir } from "@mjazo/shared"
import { router } from "expo-router"
import { Search } from "lucide-react-native"
import { useMemo, useState } from "react"
import { Pressable, ScrollView, TextInput, View } from "react-native"
import { CartBar, ServiceRow, servicePrice } from "../../src/parts"
import { useAccount, useCatalog, useT } from "../../src/state"

// Home: a greeting, search, every world with its categories, and the popular services.

export default function Home() {
  const t = useT()
  const { catalog, error, reload } = useCatalog()
  const { account } = useAccount()
  const { row, align } = useDir()
  const [q, setQ] = useState("")
  const name = account.state === "in" ? account.me.customer.name.split(" ")[0] : null

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!catalog || query.length < 2) return null
    const words = query.split(/\s+/)
    return catalog.categories
      .filter((c) => c.status !== "hidden")
      .flatMap((c) => c.services.map((s) => ({ c, s, text: `${s.name} ${s.short} ${c.name} ${c.tagline}`.toLowerCase() })))
      .filter((x) => words.every((w) => x.text.includes(w)))
      .slice(0, 30)
  }, [catalog, q])

  const popular = useMemo(() => catalog?.categories.filter((c) => c.status === "live").flatMap((c) => c.services.filter((s) => s.popular).map((s) => ({ c, s }))).slice(0, 10) ?? [], [catalog])

  return (
    <View style={{ flex: 1 }}>
      <Screen top>
        <View style={{ gap: 4 }}>
          <Txt v="title">{name ? fill(t.salaamName, { name }) : t.salaam}</Txt>
          <Txt v="muted">{t.intro}</Txt>
        </View>
        <View style={{ flexDirection: row, alignItems: "center", gap: space.sm, backgroundColor: color.paper, borderRadius: radius.pill, borderWidth: 1, borderColor: color.field, paddingHorizontal: space.lg, height: 50 }}>
          <Search size={18} color={color.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder={t.search} placeholderTextColor={color.faint} style={{ flex: 1, fontSize: 15, color: color.ink, textAlign: align }} returnKeyType="search" />
        </View>

        {!catalog && error ? <Notice text={errorText(error, t.offline)} onRetry={reload} retryLabel={t.retry} /> : null}
        {!catalog && !error ? <Loading label={t.loading} /> : null}

        {catalog && results && (
          <View style={{ gap: space.sm }}>
            {results.length ? results.map(({ c, s }) => <ServiceRow key={`${c.slug}/${s.slug}`} c={c} s={s} />) : <Txt v="muted">{fill(t.noResults, { q: q.trim() })}</Txt>}
          </View>
        )}

        {catalog && !results && (
          <>
            {popular.length > 0 && (
              <View style={{ gap: space.sm }}>
                <Txt v="h2">{t.popular}</Txt>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, flexDirection: row }}>
                  {popular.map(({ c, s }) => (
                    <Card key={`${c.slug}/${s.slug}`} style={{ width: 200 }} onPress={() => router.push(`/service/${c.slug}/${s.slug}`)}>
                      <CatalogIcon name={c.icon} />
                      <Txt v="h3" numberOfLines={2}>
                        {s.name}
                      </Txt>
                      <Txt v="muted">{servicePrice(s, t)}</Txt>
                    </Card>
                  ))}
                </ScrollView>
              </View>
            )}
            {catalog.worlds.map((w) => {
              const cats = catalog.categories.filter((c) => c.world === w.slug && c.status !== "hidden")
              if (!cats.length) return null
              return (
                <View key={w.slug} style={{ gap: space.sm }}>
                  <Txt v="h2">{w.name}</Txt>
                  <View style={{ flexDirection: row, flexWrap: "wrap", gap: space.sm }}>
                    {cats.map((c) => (
                      <Pressable key={c.slug} onPress={() => router.push(`/category/${c.slug}`)} style={({ pressed }) => ({ width: "48%", flexGrow: 1, backgroundColor: color.paper, borderRadius: radius.lg, padding: space.md, gap: 6, borderWidth: 1, borderColor: color.line, opacity: pressed ? 0.85 : 1 })}>
                        <Row style={{ justifyContent: "space-between" }}>
                          <View style={{ backgroundColor: w.tint || color.brandSoft, borderRadius: radius.md, padding: 8 }}>
                            <CatalogIcon name={c.icon} />
                          </View>
                          {c.status === "waitlist" && <Badge text={t.soon} tone="amber" />}
                        </Row>
                        <Txt v="h3" numberOfLines={2}>
                          {c.name}
                        </Txt>
                        <Txt v="muted" numberOfLines={2}>
                          {c.tagline}
                        </Txt>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )
            })}
            <View style={{ height: 70 }} />
          </>
        )}
      </Screen>
      <CartBar />
    </View>
  )
}
