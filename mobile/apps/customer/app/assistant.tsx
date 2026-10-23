import { ApiError, Button, Card, color, fill, formatPKR, Loading, Notice, prefs, radius, Row, Screen, space, Txt, useDir, useLang, whatsappLink, windowLabel, formatDay, type Catalog } from "@mjazo/shared"
import { router } from "expo-router"
import { ArrowUp, Camera, ChevronLeft, ImagePlus, RotateCcw, Sparkles, X } from "lucide-react-native"
import { Fragment, useEffect, useRef, useState, type ComponentRef } from "react"
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { rememberBooking, useAccount, useCart, useCatalog, useT } from "../src/state"
import { pickPhotos, useToolsText, type ConciergeText } from "../src/tools"

// Ask Mjazo: the website's AI Concierge (/api/concierge) in the app. They type (or send up to 3
// photos) in English, Urdu or Roman Urdu; it answers from the real catalogue and prices, shows
// services, adds them to the app's cart, and can place the booking itself after a clear yes. A
// person on WhatsApp is always one tap away. The conversation is kept on the phone (without photos).

type CardData = { category: string; service: string; name: string; categoryName: string; price: number; duration: number; short: string; hasOptions: boolean }
type Msg = {
  id: string
  role: "user" | "assistant"
  text: string
  /** JPEG base64, sent once and not kept. */
  images?: string[]
  cards?: CardData[]
  added?: string[]
  booking?: { id: string; total: number; date: string; window: string }
  whatsapp?: boolean
}
type CartAdd = { category: string; service: string; name: string; options: string[]; addOns: { id: string; name: string; price: number }[]; unitPrice: number; duration: number }
type Ui = { type: "cards"; cards: CardData[] } | { type: "cart_add"; item: CartAdd; qty: number } | { type: "booking"; booking: { id: string; date: string; window: string; total: number; items?: { name: string }[] } } | { type: "handoff" }

const KEY = "mjazo.chat"
const uid = () => Math.random().toString(36).slice(2)

export default function Assistant() {
  const { text, error, retry } = useToolsText()
  const t = useT()
  if (!text)
    return error ? (
      <Screen top>
        <Notice text={t.offline} onRetry={retry} retryLabel={t.retry} />
      </Screen>
    ) : (
      <Loading label={t.loading} />
    )
  return <Chat c={text.concierge} />
}

function Chat({ c }: { c: ConciergeText }) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const { row, align } = useDir()
  const { lang } = useLang()
  const { account, api } = useAccount()
  const { catalog } = useCatalog()
  const cart = useCart()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  // The saved conversation is written back only once it has been read.
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void prefs.get<Msg[]>(KEY, []).then((saved) => {
      setMsgs((m) => (m.length ? m : saved))
      setLoaded(true)
    })
  }, [])
  useEffect(() => {
    if (loaded) void prefs.set(KEY, msgs.slice(-30).map(({ images: _drop, ...m }) => m))
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50)
  }, [msgs, busy, loaded])

  const whatsapp = () => catalog && void Linking.openURL(whatsappLink(catalog.contact.whatsapp, c.waHelp))

  const send = async (typed?: string) => {
    const said = (typed ?? input).trim()
    if ((!said && !photos.length) || busy) return
    const mine: Msg = { id: uid(), role: "user", text: said || c.photoQuestion, images: photos.length ? photos : undefined }
    const next = [...msgs, mine]
    setMsgs(next)
    setInput("")
    setPhotos([])
    setBusy(true)
    const me = account.state === "in" ? account.me.customer : null
    // Photos go again only with the last two messages that had them (the server keeps 3 at most).
    const recent = next.slice(-20)
    const withPhotos = new Set(recent.map((m, i) => (m.images?.length ? i : -1)).filter((i) => i >= 0).slice(-2))
    try {
      const r = await api<{ reply: string; ui?: Ui[] }>("/api/concierge", {
        body: {
          channel: "app",
          messages: recent.map((m, i) => (m.role === "assistant" ? { role: "assistant", content: m.text } : { role: "user", content: [...(withPhotos.has(i) ? (m.images ?? []) : []).map((data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })), { type: "text", text: m.text }] })),
          context: { name: me?.name || undefined, phone: me?.phone || undefined, cart: cart.items.map((i) => `${i.name}${i.optionLabels.length ? ` (${i.optionLabels.join(", ")})` : ""} x${i.qty}`), locale: lang === "ur" ? "ur" : "en" },
        },
      })
      setMsgs((m) => [...m, reply(r.reply || c.done, r.ui ?? [])])
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined
      const say = code === "offline" ? (e instanceof ApiError && e.status === 0 ? c.noServer : c.offline) : code === "tooMany" ? c.tooMany : code === "busy" ? c.busy : code === "failed" ? c.failed : c.error
      setMsgs((m) => [...m, { id: uid(), role: "assistant", text: say, whatsapp: true }])
    } finally {
      setBusy(false)
    }
  }

  /** The reply, with what the assistant did: services to show, the cart, a booking, or a hand-off. */
  const reply = (text: string, ui: Ui[]): Msg => {
    const m: Msg = { id: uid(), role: "assistant", text }
    for (const a of ui) {
      if (a.type === "cards") m.cards = [...(m.cards ?? []), ...a.cards].filter((x, i, all) => all.findIndex((y) => y.service === x.service) === i).slice(0, 4)
      if (a.type === "cart_add" && catalog) {
        const item = toCartItem(a.item, a.qty, catalog)
        if (item) {
          cart.add(item)
          m.added = [...(m.added ?? []), item.name]
        }
      }
      if (a.type === "booking") {
        const b = a.booking
        m.booking = { id: b.id, total: b.total, date: b.date, window: b.window }
        void rememberBooking({ id: b.id, date: b.date, window: b.window, total: b.total, services: (b.items ?? []).map((i) => i.name), at: new Date().toISOString() })
        cart.clear()
      }
      if (a.type === "handoff") m.whatsapp = true
    }
    return m
  }

  const addPhotos = async (from: "camera" | "gallery") => {
    const got = await pickPhotos(from, 3 - photos.length)
    if (got.length) setPhotos((p) => [...p, ...got.map((x) => x.full)].slice(0, 3))
  }
  const restart = () => {
    setMsgs([])
    void prefs.remove(KEY)
  }

  const bubble = (m: Msg) => {
    const mine = m.role === "user"
    return (
      <View key={m.id} style={{ alignItems: mine ? "flex-end" : "flex-start", gap: space.xs }}>
        {m.images?.length ? (
          <Row>
            {m.images.map((d, i) => (
              <Image key={i} source={{ uri: `data:image/jpeg;base64,${d}` }} style={{ width: 72, height: 72, borderRadius: radius.md }} />
            ))}
          </Row>
        ) : null}
        <View style={{ maxWidth: "88%", backgroundColor: mine ? color.ink : color.paper, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 10, borderWidth: mine ? 0 : 1, borderColor: color.line }}>
          <Rich text={m.text} light={mine} />
        </View>
        {m.cards?.map((x) => (
          <Card key={x.service} style={{ width: "88%" }} onPress={() => router.push(`/service/${x.category}/${x.service}`)}>
            <Txt v="tiny">{x.categoryName}</Txt>
            <Txt v="h3">{x.name}</Txt>
            {x.short ? <Txt v="muted" numberOfLines={2}>{x.short}</Txt> : null}
            <Row style={{ justifyContent: "space-between" }}>
              <Txt style={{ fontWeight: "700" }}>{x.price > 0 ? formatPKR(x.price) : c.onRequest}</Txt>
              <Txt v="small" style={{ textDecorationLine: "underline" }}>{c.chooseOptions}</Txt>
            </Row>
          </Card>
        ))}
        {m.added?.length ? (
          <Card tint={color.brandSoft} style={{ width: "88%" }}>
            <Txt v="small">{fill(c.addedToCart, { items: m.added.join(", ") })}</Txt>
            <Button title={c.viewCart} small variant="light" onPress={() => router.push("/cart")} style={{ alignSelf: "flex-start" }} />
          </Card>
        ) : null}
        {m.booking ? (
          <Card tint={color.greenSoft} style={{ width: "88%" }}>
            <Txt v="h3">{c.bookingSent}</Txt>
            <Txt v="small">{m.booking.id}</Txt>
            <Txt v="small">{fill(c.bookingLine, { date: formatDay(m.booking.date, lang), window: windowLabel(m.booking.window, lang), total: formatPKR(m.booking.total) })}</Txt>
            <Button title={account.state === "in" ? c.viewBooking : t.viewBookings} small variant="light" onPress={() => router.push(account.state === "in" ? `/booking/${m.booking!.id}` : "/bookings")} style={{ alignSelf: "flex-start" }} />
          </Card>
        ) : null}
        {m.whatsapp && catalog ? <Button title={c.person} small variant="whatsapp" onPress={whatsapp} /> : null}
      </View>
    )
  }

  const empty = msgs.length === 0
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, flexDirection: row, alignItems: "center", gap: space.sm, borderBottomWidth: 1, borderBottomColor: color.line, backgroundColor: color.paper }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={10} accessibilityLabel={t.back}>
          <ChevronLeft size={24} color={color.ink} style={{ transform: [{ scaleX: row === "row" ? 1 : -1 }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt v="h3">{c.title}</Txt>
          <Txt v="muted" numberOfLines={1}>{c.sub}</Txt>
        </View>
        {!empty && (
          <Pressable onPress={restart} hitSlop={10} accessibilityLabel={c.newChat}>
            <RotateCcw size={20} color={color.ink} />
          </Pressable>
        )}
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "flex-start", gap: space.sm }}>
          <View style={{ maxWidth: "88%", backgroundColor: color.paper, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 10, borderWidth: 1, borderColor: color.line }}>
            <Row>
              <Sparkles size={16} color={color.brand} />
              <Txt v="small" style={{ fontWeight: "700" }}>{t.toolChat}</Txt>
            </Row>
            <Rich text={c.welcome} />
          </View>
          {empty && (
            <Row wrap>
              {c.chips.map((chip) => (
                <Pressable key={chip} onPress={() => void send(chip)} style={{ borderWidth: 1, borderColor: color.field, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8, backgroundColor: color.paper }}>
                  <Txt v="small">{chip}</Txt>
                </Pressable>
              ))}
            </Row>
          )}
        </View>
        {msgs.map(bubble)}
        {busy && <Txt v="muted">{c.thinking}</Txt>}
      </ScrollView>
      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, backgroundColor: color.paper, borderTopWidth: 1, borderTopColor: color.line, gap: space.sm }}>
        {photos.length > 0 && (
          <Row>
            {photos.map((d, i) => (
              <View key={i}>
                <Image source={{ uri: `data:image/jpeg;base64,${d}` }} style={{ width: 56, height: 56, borderRadius: radius.md }} />
                <Pressable onPress={() => setPhotos((p) => p.filter((_, k) => k !== i))} accessibilityLabel={c.removePhoto} style={{ position: "absolute", top: -6, right: -6, backgroundColor: color.ink, borderRadius: 12, padding: 3 }}>
                  <X size={12} color={color.paper} />
                </Pressable>
              </View>
            ))}
          </Row>
        )}
        <View style={{ flexDirection: row, alignItems: "flex-end", gap: space.sm }}>
          <Pressable onPress={() => void addPhotos("camera")} disabled={photos.length >= 3} hitSlop={6} accessibilityLabel={t.takePhoto} style={{ padding: 8 }}>
            <Camera size={22} color={photos.length >= 3 ? color.faint : color.ink} />
          </Pressable>
          <Pressable onPress={() => void addPhotos("gallery")} disabled={photos.length >= 3} hitSlop={6} accessibilityLabel={c.addPhoto} style={{ padding: 8 }}>
            <ImagePlus size={22} color={photos.length >= 3 ? color.faint : color.ink} />
          </Pressable>
          <TextInput value={input} onChangeText={setInput} placeholder={c.placeholder} placeholderTextColor={color.faint} multiline style={{ flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderColor: color.field, borderRadius: 22, paddingHorizontal: space.md, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: color.ink, textAlign: align }} />
          <Pressable onPress={() => void send()} disabled={busy || (!input.trim() && !photos.length)} accessibilityLabel={c.send} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: busy || (!input.trim() && !photos.length) ? color.field : color.ink, alignItems: "center", justifyContent: "center" }}>
            <ArrowUp size={20} color={color.paper} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

/** The app's cart line for a service the assistant added (its options are the English labels, which the app keeps as keys). */
function toCartItem(a: CartAdd, qty: number, cat: Catalog) {
  const c = cat.categories.find((x) => x.slug === a.category)
  const s = c?.services.find((x) => x.slug === a.service)
  if (!c || !s) return null
  const choice = s.variants.map((v, i) => v.options.find((o) => o.key === a.options[i]) ?? v.options[0]).filter(Boolean)
  const extras = a.addOns.map((x) => s.addOns.find((y) => y.id === x.id) ?? x)
  return { name: s.name, category: c.slug, service: s.slug, options: choice.map((o) => o!.key), optionLabels: choice.map((o) => o!.label), addOns: extras.map((x) => x.id), addOnNames: extras.map((x) => x.name), qty: Math.max(1, Math.min(10, qty || 1)), unitPrice: a.unitPrice, duration: a.duration || s.duration }
}

/** Replies use **bold**, line breaks and "- " lists. */
function Rich({ text, light }: { text: string; light?: boolean }) {
  const { align } = useDir()
  const style = { color: light ? color.paper : color.ink, fontSize: 15, lineHeight: 22, textAlign: align }
  return (
    <>
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-•]\s+/.test(line)
        const parts = line.replace(/^\s*[-•]\s+/, "").split(/(\*\*[^*]+\*\*)/g)
        return (
          <Text key={i} style={style}>
            {bullet ? "•  " : ""}
            {parts.map((p, k) => (p.startsWith("**") && p.endsWith("**") ? <Text key={k} style={{ fontWeight: "700" }}>{p.slice(2, -2)}</Text> : <Fragment key={k}>{p}</Fragment>))}
          </Text>
        )
      })}
    </>
  )
}
