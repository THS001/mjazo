import { Button, Card, color, errorText, prefs, radius, Row, space, Txt, useDir, useLang } from "@mjazo/shared"
import * as ImageManipulator from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import { router } from "expo-router"
import * as Speech from "expo-speech"
import { ArrowUp, ChevronLeft, ImagePlus, RotateCcw, Sparkles, Volume2, X } from "lucide-react-native"
import { useEffect, useRef, useState, type ComponentRef } from "react"
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useSession, useT } from "../src/session"

// The pro's AI Copilot (/api/v1/pro/copilot, as on the web pro app): today's brief (her route,
// customer notes and kit reminders), read aloud; and a chat about her day, a customer, a technique
// or safety, with a photo when it helps. It can save a note on her own visits for next time. The
// conversation stays on the phone for the day (without photos).

type Msg = { role: "user" | "assistant"; text: string; image?: string }
const KEY = "mjazo.pro.copilot"
const VOICE = { en: "en-PK", ur: "ur-PK", ro: "ur-PK" } as const

export default function Copilot() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const { row, align } = useDir()
  const { lang } = useLang()
  const l = lang === "ur" || lang === "ro" ? lang : "en"
  const { api } = useSession()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState<"" | "chat" | "brief">("")
  const [error, setError] = useState("")
  const [speaking, setSpeaking] = useState(false)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const day = new Date().toISOString().slice(0, 10)
  // The day's conversation is written back only once it has been read.
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void prefs.get<{ day: string; msgs: Msg[] } | null>(KEY, null).then((s) => {
      if (s?.day === day) setMsgs((m) => (m.length ? m : s.msgs))
      setLoaded(true)
    })
    return () => void Speech.stop()
  }, [day])
  useEffect(() => {
    if (loaded) void prefs.set(KEY, { day, msgs: msgs.slice(-20).map(({ image: _drop, ...m }) => m) })
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50)
  }, [msgs, busy, day, loaded])

  const say = (text: string) => {
    void Speech.stop()
    setSpeaking(true)
    Speech.speak(text, { language: VOICE[l], onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) })
  }
  const brief = async () => {
    setBusy("brief")
    setError("")
    try {
      const r = await api<{ text: string }>("/api/v1/pro/copilot", { body: { brief: true, lang: l } })
      setMsgs((m) => [...m, { role: "assistant", text: r.text }])
      say(r.text)
    } catch (e) {
      setError(errorText(e, t.offline))
    } finally {
      setBusy("")
    }
  }
  const send = async (typed?: string) => {
    const text = (typed ?? input).trim()
    if ((!text && !image) || busy) return
    const next = [...msgs, { role: "user" as const, text: text || "(photo)", ...(image ? { image } : {}) }]
    setMsgs(next)
    setInput("")
    setImage(null)
    setBusy("chat")
    setError("")
    try {
      const r = await api<{ reply: string }>("/api/v1/pro/copilot", { body: { messages: next } })
      setMsgs((m) => [...m, { role: "assistant", text: r.reply }])
    } catch (e) {
      setError(errorText(e, t.offline))
    } finally {
      setBusy("")
    }
  }
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 })
    if (r.canceled || !r.assets[0]) return
    const out = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }).catch(() => null)
    if (out?.base64) setImage(`data:image/jpeg;base64,${out.base64}`)
  }

  const chips = [t.chip1, t.chip2, t.chip3, t.chip4]
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, flexDirection: row, alignItems: "center", gap: space.sm, borderBottomWidth: 1, borderBottomColor: color.line, backgroundColor: color.paper }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={10} accessibilityLabel={t.back}>
          <ChevronLeft size={24} color={color.ink} style={{ transform: [{ scaleX: row === "row" ? 1 : -1 }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt v="h3">{`Mjazo ${t.copilot}`}</Txt>
          <Txt v="muted" numberOfLines={1}>{t.copilotSub}</Txt>
        </View>
        {speaking && (
          <Pressable onPress={() => void Speech.stop()} hitSlop={10} accessibilityLabel={t.stop}>
            <Volume2 size={20} color={color.brand} />
          </Pressable>
        )}
        {msgs.length > 0 && (
          <Pressable onPress={() => setMsgs([])} hitSlop={10} accessibilityLabel={t.newChat}>
            <RotateCcw size={20} color={color.ink} />
          </Pressable>
        )}
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
        <Card>
          <Row>
            <Sparkles size={16} color={color.brand} />
            <Txt v="small" style={{ fontWeight: "700" }}>{t.copilot}</Txt>
          </Row>
          <Txt>{t.copilotHello}</Txt>
          <Button title={t.brief} variant="brand" small busy={busy === "brief"} disabled={!!busy} onPress={() => void brief()} style={{ alignSelf: "flex-start" }} />
          <Txt v="muted">{t.briefSub}</Txt>
        </Card>
        {msgs.length === 0 && (
          <Row wrap>
            {chips.map((c) => (
              <Pressable key={c} onPress={() => void send(c)} style={{ borderWidth: 1, borderColor: color.field, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8, backgroundColor: color.paper }}>
                <Txt v="small">{c}</Txt>
              </Pressable>
            ))}
          </Row>
        )}
        {msgs.map((m, i) => (
          <View key={i} style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: space.xs }}>
            {m.image ? <Image source={{ uri: m.image }} style={{ width: 96, height: 96, borderRadius: radius.md }} /> : null}
            <Pressable onPress={m.role === "assistant" ? () => say(m.text) : undefined} style={{ maxWidth: "88%", backgroundColor: m.role === "user" ? color.ink : color.paper, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 10, borderWidth: m.role === "user" ? 0 : 1, borderColor: color.line }}>
              <Txt style={{ color: m.role === "user" ? color.paper : color.ink }}>{m.text}</Txt>
            </Pressable>
          </View>
        ))}
        {busy === "chat" && <Txt v="muted">{t.thinking}</Txt>}
        {error ? <Txt v="small" style={{ color: color.red }}>{error}</Txt> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, backgroundColor: color.paper, borderTopWidth: 1, borderTopColor: color.line, gap: space.sm }}>
        {image && (
          <View style={{ width: 56 }}>
            <Image source={{ uri: image }} style={{ width: 56, height: 56, borderRadius: radius.md }} />
            <Pressable onPress={() => setImage(null)} style={{ position: "absolute", top: -6, right: -6, backgroundColor: color.ink, borderRadius: 12, padding: 3 }}>
              <X size={12} color={color.paper} />
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: row, alignItems: "flex-end", gap: space.sm }}>
          <Pressable onPress={() => void pick()} hitSlop={6} accessibilityLabel={t.addPhoto} style={{ padding: 8 }}>
            <ImagePlus size={22} color={color.ink} />
          </Pressable>
          <TextInput value={input} onChangeText={setInput} placeholder={t.askAnything} placeholderTextColor={color.faint} multiline style={{ flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderColor: color.field, borderRadius: 22, paddingHorizontal: space.md, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: color.ink, textAlign: align }} />
          <Pressable onPress={() => void send()} disabled={!!busy || (!input.trim() && !image)} accessibilityLabel={t.send} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: busy || (!input.trim() && !image) ? color.field : color.ink, alignItems: "center", justifyContent: "center" }}>
            <ArrowUp size={20} color={color.paper} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
