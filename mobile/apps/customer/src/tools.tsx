import { prefs, request, useLang } from "@mjazo/shared"
import * as ImageManipulator from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import { useEffect, useState } from "react"

// The AI tools in the app (the Concierge chat, Ghar Scan, Home Pulse), shared pieces:
// - their wording, from the server (/api/v1/tools: the website's CMS texts, so both say the same
//   and the team edits them once), in the app's language; the last copy is kept for offline starts;
// - photos from the camera or the gallery, made small enough to send;
// - the brief a Ghar Scan saves for the next booking (sent to the pro with it, like the website).

export type ConciergeText = {
  welcome: string
  chips: string[]
  photoQuestion: string
  offline: string
  tooMany: string
  busy: string
  failed: string
  error: string
  noServer: string
  done: string
  waHelp: string
  title: string
  sub: string
  person: string
  newChat: string
  onRequest: string
  chooseOptions: string
  addedToCart: string
  viewCart: string
  bookingSent: string
  bookingLine: string
  viewBooking: string
  thinking: string
  removePhoto: string
  addPhoto: string
  placeholder: string
  send: string
}

export type ScanText = {
  modes: { label: string; home: string; beauty: string }
  capture: { homeTitle: string; homeHint: string; beautyTitle: string; beautyHint: string; photo: string; removePhoto: string; reading: string; updating: string; startOver: string; noteLabel: string; homeNote: string; beautyNote: string; scanAgain: string; scanHome: string; scanBeauty: string; disclaimer: string }
  errors: { title: string; unavailable: string; tooMany: string; noPhotos: string; busy: string; failed: string; generic: string; offline: string; sendWhatsapp: string }
  result: {
    high: string
    medium: string
    low: string
    urgent: string
    updated: string
    sure: string
    causes: string
    checkNow: string
    lookCard: string
    saved: string
    save: string
    videoTitle: string
    videoBody: string
    videoCta: string
    briefTitle: string
    parts: string
    briefSaved: string
    briefSend: string
    fixTitle: string
    inspection: string
    history: string
    chooseOptions: string
    questionsTitle: string
    answer: string
    update: string
    askPerson: string
  }
  idle: { title: string; home: string[]; beauty: string[]; homeBody: string; beautyBody: string }
}

export type ToolsText = { ai: boolean; concierge: ConciergeText; scan: ScanText }

const cache = new Map<string, ToolsText>()

/** The tools' wording in the app's language (null while the first copy loads). */
export function useToolsText() {
  const { lang } = useLang()
  const l = lang === "ur" ? "ur" : "en"
  const [text, setText] = useState<ToolsText | null>(cache.get(l) ?? null)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    const key = `mjazo.tools.${l}`
    if (!cache.has(l)) void prefs.get<ToolsText | null>(key, null).then((saved) => live && saved && setText((t) => t ?? saved))
    request<ToolsText>(`/api/v1/tools?lang=${l}`).then(
      (t) => {
        cache.set(l, t)
        void prefs.set(key, t)
        if (live) {
          setText(t)
          setError(null)
        }
      },
      (e) => live && setError(e),
    )
    return () => {
      live = false
    }
  }, [l, tick])
  return { text, error, retry: () => setTick((n) => n + 1) }
}

/** A photo as JPEG base64 (no "data:" prefix): `full` to send for reading (1280 px), `small` to keep (640 px). */
export type Photo = { full: string; small: string }

/** Photos from the camera or the gallery, at most `max` of them. Empty when they cancel or refuse the permission. */
export async function pickPhotos(from: "camera" | "gallery", max: number): Promise<Photo[]> {
  if (max <= 0) return []
  let r: ImagePicker.ImagePickerResult
  if (from === "camera") {
    const p = await ImagePicker.requestCameraPermissionsAsync().catch(() => null)
    if (!p?.granted) return []
    r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
  } else r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: max > 1, selectionLimit: max })
  if (r.canceled) return []
  const jpeg = (uri: string, w: number, width: number, compress: number) =>
    ImageManipulator.manipulateAsync(uri, w > width ? [{ resize: { width } }] : [], { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true }).then((x) => x.base64 ?? null, () => null)
  const out: Photo[] = []
  for (const a of r.assets.slice(0, max)) {
    const [full, small] = await Promise.all([jpeg(a.uri, a.width, 1280, 0.72), jpeg(a.uri, a.width, 640, 0.75)])
    if (full) out.push({ full, small: small ?? full })
  }
  return out
}

// ---------------------------------------------------------------------------
// The brief for the next booking
// ---------------------------------------------------------------------------

export type Brief = {
  kind: "scan" | "look"
  title: string
  text: string
  causes?: string[]
  parts?: string[]
  pins?: { photo: number; x: number; y: number; label: string }[]
  /** Small JPEGs (base64), sent to the pro once booked and deleted after the visit. */
  photos: string[]
  categories: string[]
  at: number
}
const BRIEF_KEY = "mjazo.brief"
const BRIEF_DAYS = 14

export const saveBrief = (b: Omit<Brief, "at">) => prefs.set(BRIEF_KEY, { ...b, at: Date.now() })
export async function loadBrief(): Promise<Brief | null> {
  const b = await prefs.get<Brief | null>(BRIEF_KEY, null)
  return b && Date.now() - b.at < BRIEF_DAYS * 86400_000 ? b : null
}
export const clearBrief = () => prefs.remove(BRIEF_KEY)
