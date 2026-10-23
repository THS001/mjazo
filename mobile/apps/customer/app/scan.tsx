import { ApiError, Badge, Button, Card, Chip, color, Field, fill, formatPKR, Loading, Notice, radius, request, Row, Screen, space, Txt, useLang, whatsappLink } from "@mjazo/shared"
import { router } from "expo-router"
import { Camera, ImagePlus, X } from "lucide-react-native"
import { useState } from "react"
import { Image, Linking, Pressable, View } from "react-native"
import { useCatalog, useT } from "../src/state"
import { pickPhotos, saveBrief, useToolsText, type Photo, type ScanText } from "../src/tools"

// Ghar Scan in the app (/api/scan, as on the website): photos of a problem at home (or of a beauty
// look) → the likely issue marked on the photo, causes, what to check now, parts, and the right
// Mjazo services with prices. It asks a question or two when it isn't sure. The diagnosis (and
// small copies of the photos) can go to the technician with the next booking.

type Rec = { category: string; categoryName: string; service: string; name: string; why: string; price: number; range: { label: string } | null; hasOptions: boolean; history: { jobs: number; low: number; high: number } | null }
type Result = {
  mode: "home" | "beauty"
  summary: string
  title: string
  confidence: "high" | "medium" | "low"
  score: number
  videoCheck: boolean
  pins: { photo: number; x: number; y: number; label: string }[]
  techBrief: string
  checkNow: string[]
  causes: string[]
  urgent: boolean
  safety: string
  parts: string[]
  brief: string
  questions: string[]
  recommendations: Rec[]
  whatsapp: string
}
const PROBLEMS = ["unavailable", "tooMany", "noPhotos", "busy", "failed", "offline"] as const

export default function Scan() {
  const { text, error, retry } = useToolsText()
  const t = useT()
  if (!text)
    return error ? (
      <Screen>
        <Notice text={t.offline} onRetry={retry} retryLabel={t.retry} />
      </Screen>
    ) : (
      <Loading label={t.loading} />
    )
  return <GharScan s={text.scan} />
}

function GharScan({ s }: { s: ScanText }) {
  const t = useT()
  const { lang } = useLang()
  const { catalog } = useCatalog()
  const [mode, setMode] = useState<"home" | "beauty">("home")
  const [photos, setPhotos] = useState<Photo[]>([])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [round, setRound] = useState(0)
  const [problem, setProblem] = useState<{ text: string; whatsapp?: string } | null>(null)
  const [saved, setSaved] = useState(false)

  const add = async (from: "camera" | "gallery") => {
    const got = await pickPhotos(from, 3 - photos.length)
    if (got.length) {
      setPhotos((p) => [...p, ...got].slice(0, 3))
      setResult(null)
    }
  }
  const startOver = () => {
    setPhotos([])
    setNote("")
    setResult(null)
    setAnswers({})
    setRound(0)
    setProblem(null)
    setSaved(false)
  }
  const scan = async (withAnswers = false) => {
    if (!photos.length) return setProblem({ text: s.errors.noPhotos })
    setBusy(true)
    setProblem(null)
    try {
      const answered = withAnswers && result ? result.questions.map((q) => ({ q, a: (answers[q] ?? "").trim() })).filter((x) => x.a) : []
      const r = await request<Result>("/api/scan", { body: { mode, images: photos.map((p) => p.full), note: note.trim() || undefined, answers: answered.length ? answered : undefined, locale: lang === "ur" ? "ur" : "en" } })
      setResult(r)
      setSaved(false)
      if (withAnswers) setRound((n) => n + 1)
      else setAnswers({})
    } catch (e) {
      const code = e instanceof ApiError ? (e.status === 0 ? "offline" : e.code) : undefined
      const key = PROBLEMS.find((k) => k === code)
      setProblem({ text: key ? s.errors[key] : s.errors.generic, whatsapp: e instanceof ApiError && typeof e.data?.whatsapp === "string" ? e.data.whatsapp : undefined })
    } finally {
      setBusy(false)
    }
  }
  const keepBrief = async (r: Result) => {
    await saveBrief({
      kind: r.mode === "home" ? "scan" : "look",
      title: r.title,
      text: r.mode === "home" ? [r.summary, r.techBrief].filter(Boolean).join(" ") : r.brief || r.summary,
      causes: r.causes,
      parts: r.parts,
      pins: r.pins,
      photos: photos.map((p) => p.small),
      categories: [...new Set(r.recommendations.map((x) => x.category))],
    })
    setSaved(true)
  }

  const r = result
  const sure = r ? { high: s.result.high, medium: s.result.medium, low: s.result.low }[r.confidence] : ""
  return (
    <Screen>
      <Txt v="small" style={{ fontWeight: "600" }}>{s.modes.label}</Txt>
      <Row wrap>
        {(["home", "beauty"] as const).map((m) => (
          <Chip key={m} label={s.modes[m]} selected={mode === m} onPress={() => (setMode(m), setResult(null))} />
        ))}
      </Row>
      <Card>
        <Txt v="h3">{mode === "home" ? s.capture.homeTitle : s.capture.beautyTitle}</Txt>
        <Txt v="muted">{mode === "home" ? s.capture.homeHint : s.capture.beautyHint}</Txt>
        {photos.length > 0 && (
          <Row wrap gap={space.sm}>
            {photos.map((p, i) => (
              <View key={i} style={{ width: 96, height: 96 }}>
                <Image source={{ uri: `data:image/jpeg;base64,${p.small}` }} style={{ width: 96, height: 96, borderRadius: radius.md }} accessibilityLabel={fill(s.capture.photo, { n: i + 1 })} />
                {r?.pins
                  .map((pin, n) => ({ pin, n }))
                  .filter(({ pin }) => pin.photo === i)
                  .map(({ pin, n }) => (
                    <View key={n} style={{ position: "absolute", left: pin.x * 96 - 9, top: pin.y * 96 - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: color.brand, borderWidth: 2, borderColor: color.paper, alignItems: "center", justifyContent: "center" }}>
                      <Txt v="tiny" style={{ color: color.ink, fontWeight: "800" }}>{n + 1}</Txt>
                    </View>
                  ))}
                <Pressable onPress={() => (setPhotos((list) => list.filter((_, k) => k !== i)), setResult(null))} accessibilityLabel={s.capture.removePhoto} style={{ position: "absolute", top: -6, right: -6, backgroundColor: color.ink, borderRadius: 12, padding: 3 }}>
                  <X size={12} color={color.paper} />
                </Pressable>
              </View>
            ))}
          </Row>
        )}
        {r?.pins.length ? r.pins.map((pin, n) => <Txt key={n} v="small">{`${n + 1}. ${pin.label}`}</Txt>) : null}
        {photos.length < 3 && (
          <Row wrap>
            <Button title={t.takePhoto} small variant="light" icon={<Camera size={16} color={color.ink} />} onPress={() => void add("camera")} />
            <Button title={t.fromGallery} small variant="light" icon={<ImagePlus size={16} color={color.ink} />} onPress={() => void add("gallery")} />
          </Row>
        )}
        <Field label={s.capture.noteLabel} value={note} onChangeText={setNote} placeholder={mode === "home" ? s.capture.homeNote : s.capture.beautyNote} multiline maxLength={600} />
        <Button title={busy ? (round || result ? s.capture.updating : s.capture.reading) : result ? s.capture.scanAgain : mode === "home" ? s.capture.scanHome : s.capture.scanBeauty} variant="brand" busy={busy} disabled={!photos.length} onPress={() => void scan()} />
        {photos.length > 0 && !busy ? (
          <Pressable onPress={startOver}>
            <Txt v="small" style={{ textDecorationLine: "underline" }}>{s.capture.startOver}</Txt>
          </Pressable>
        ) : null}
      </Card>

      {problem && (
        <Card tint={color.redSoft}>
          <Txt v="h3">{s.errors.title}</Txt>
          <Txt>{problem.text}</Txt>
          {problem.whatsapp || catalog ? <Button title={s.errors.sendWhatsapp} variant="whatsapp" small onPress={() => void Linking.openURL(problem.whatsapp ?? whatsappLink(catalog!.contact.whatsapp))} style={{ alignSelf: "flex-start" }} /> : null}
        </Card>
      )}

      {!r && !problem && (
        <Card>
          <Txt v="tiny">{s.idle.title}</Txt>
          {(mode === "home" ? s.idle.home : s.idle.beauty).map((x) => (
            <Txt key={x} v="small">{`•  ${x}`}</Txt>
          ))}
          <Txt v="muted">{mode === "home" ? s.idle.homeBody : s.idle.beautyBody}</Txt>
        </Card>
      )}

      {r && (
        <>
          <Card>
            <Row wrap>
              <Badge text={`${sure} · ${fill(s.result.sure, { score: r.score })}`} tone={r.confidence === "high" ? "green" : r.confidence === "medium" ? "amber" : "neutral"} />
              {r.urgent && <Badge text={s.result.urgent} tone="red" />}
              {round > 0 && <Badge text={s.result.updated} tone="sky" />}
            </Row>
            <Txt v="h2">{r.title}</Txt>
            <Txt>{r.summary}</Txt>
            {r.safety ? <Notice text={r.safety} /> : null}
            {r.causes.length > 0 && (
              <View style={{ gap: 4 }}>
                <Txt v="small" style={{ fontWeight: "700" }}>{s.result.causes}</Txt>
                {r.causes.map((x, i) => <Txt key={i} v="small">{`${i + 1}. ${x}`}</Txt>)}
              </View>
            )}
            {r.checkNow.length > 0 && (
              <View style={{ gap: 4 }}>
                <Txt v="small" style={{ fontWeight: "700" }}>{s.result.checkNow}</Txt>
                {r.checkNow.map((x, i) => <Txt key={i} v="small">{`•  ${x}`}</Txt>)}
              </View>
            )}
          </Card>

          {r.videoCheck && (
            <Card tint={color.brandSoft}>
              <Txt v="h3">{s.result.videoTitle}</Txt>
              <Txt v="small">{s.result.videoBody}</Txt>
              <Button title={s.result.videoCta} variant="whatsapp" small onPress={() => void Linking.openURL(r.whatsapp)} style={{ alignSelf: "flex-start" }} />
            </Card>
          )}

          {r.questions.length > 0 && (
            <Card>
              <Txt v="h3">{s.result.questionsTitle}</Txt>
              {r.questions.map((q) => (
                <Field key={q} label={q} value={answers[q] ?? ""} onChangeText={(v) => setAnswers((a) => ({ ...a, [q]: v }))} placeholder={s.result.answer} maxLength={300} />
              ))}
              <Button title={s.result.update} busy={busy} disabled={!r.questions.some((q) => (answers[q] ?? "").trim())} onPress={() => void scan(true)} />
            </Card>
          )}

          {(r.mode === "home" ? r.techBrief : r.brief) ? (
            <Card>
              <Txt v="h3">{r.mode === "home" ? s.result.briefTitle : s.result.lookCard}</Txt>
              <Txt v="small">{r.mode === "home" ? r.techBrief : r.brief}</Txt>
              {r.parts.length > 0 && (
                <>
                  <Txt v="muted">{s.result.parts}</Txt>
                  <Txt v="small">{r.parts.join(" · ")}</Txt>
                </>
              )}
              {saved ? <Notice tone="green" text={s.result.briefSaved} /> : <Button title={s.result.briefSend} variant="light" small onPress={() => void keepBrief(r)} style={{ alignSelf: "flex-start" }} />}
            </Card>
          ) : null}

          {r.recommendations.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Txt v="h2">{s.result.fixTitle}</Txt>
              {r.recommendations.map((x) => (
                <Card key={`${x.category}/${x.service}`} onPress={() => router.push(`/service/${x.category}/${x.service}`)}>
                  <Txt v="tiny">{x.categoryName}</Txt>
                  <Txt v="h3">{x.name}</Txt>
                  <Txt v="small">{x.why}</Txt>
                  <Txt style={{ fontWeight: "700" }}>{x.range ? x.range.label : s.result.inspection}</Txt>
                  {x.history ? <Txt v="muted">{fill(s.result.history, { jobs: x.history.jobs, range: `${formatPKR(x.history.low)} – ${formatPKR(x.history.high)}` })}</Txt> : null}
                  <Txt v="small" style={{ textDecorationLine: "underline" }}>{s.result.chooseOptions}</Txt>
                </Card>
              ))}
            </View>
          )}
          {catalog && <Button title={s.result.askPerson} variant="whatsapp" small onPress={() => void Linking.openURL(whatsappLink(catalog.contact.whatsapp, r.title))} style={{ alignSelf: "flex-start" }} />}
        </>
      )}
      <Txt v="muted">{s.capture.disclaimer}</Txt>
    </Screen>
  )
}
