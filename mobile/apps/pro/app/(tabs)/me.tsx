import { addDays, Badge, Button, Card, Chip, color, errorText, formatDay, karachiNow, Loading, Notice, pushUnavailable, Row, Screen, space, Txt, useLang, WINDOWS, type Availability, type Ratings } from "@mjazo/shared"
import { useFocusEffect } from "expo-router"
import { Star } from "lucide-react-native"
import { useCallback, useState } from "react"
import { Pressable, View } from "react-native"
import { useSession, useT } from "../../src/session"

// Profile: her rating and recent ratings, areas and skills, her weekly windows and days off (she
// changes them herself; a day she already has visits on can't be taken off), language, log out.

const WEEKDAYS = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], ur: ["اتوار", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ"], ro: ["Itwar", "Peer", "Mangal", "Budh", "Jumeraat", "Juma", "Hafta"] }
const SHORT_WINDOWS = ["9–11", "11–1", "1–3", "3–5", "5–7", "7–9"]

export default function Me() {
  const t = useT()
  const { lang, setLang } = useLang()
  const { session, api, signOut } = useSession()
  const [ratings, setRatings] = useState<Ratings | null>(null)
  const [avail, setAvail] = useState<Availability | null>(null)
  const [weekly, setWeekly] = useState<Record<string, string[]> | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState<{ text: string; tone: "green" | "red" } | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([api<Ratings>("/api/v1/pro/ratings"), api<Availability>("/api/v1/pro/availability")])
      setRatings(r)
      setAvail(a)
      setWeekly(a.availability)
      setDirty(false)
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [api])
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )
  if (session.state !== "in") return null
  const pro = session.pro
  const days = WEEKDAYS[lang] ?? WEEKDAYS.en

  const toggle = (day: number, w: string) => {
    // Not set means every window: the first change starts from "all ticked".
    const base = weekly ?? Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [...WINDOWS]]))
    const list = base[String(day)] ?? []
    setWeekly({ ...base, [String(day)]: list.includes(w) ? list.filter((x) => x !== w) : [...list, w].sort((a, b) => WINDOWS.indexOf(a) - WINDOWS.indexOf(b)) })
    setDirty(true)
  }
  const save = async (body: Record<string, unknown>, key: string) => {
    setBusy(key)
    setMsg(null)
    try {
      await api("/api/v1/pro/availability", { method: "PUT", body })
      setMsg({ text: t.saved, tone: "green" })
      await load()
    } catch (e) {
      setMsg({ text: errorText(e, t.offline), tone: "red" })
    } finally {
      setBusy("")
    }
  }
  const today = karachiNow().date
  const upcoming = Array.from({ length: 21 }, (_, i) => addDays(today, i))
  const off = (avail?.timeOff ?? []).filter((d) => d >= today).sort()

  return (
    <Screen top>
      <Txt v="title">{pro.name}</Txt>
      <Row wrap>
        <Badge text={pro.verified ? t.verified : t.notVerified} tone={pro.verified ? "green" : "amber"} />
        <Txt v="muted">{pro.phone}</Txt>
      </Row>
      {error ? <Notice text={errorText(error, t.offline)} onRetry={load} retryLabel={t.retry} /> : null}
      {msg && <Notice tone={msg.tone} text={msg.text} />}

      <Card>
        <Txt v="h3">{t.rating}</Txt>
        {!ratings ? (
          <Loading />
        ) : ratings.count ? (
          <>
            <Row>
              <Star size={22} color={color.brand} fill={color.brand} />
              <Txt v="h2">{ratings.average?.toFixed(1)}</Txt>
              <Txt v="muted">{`· ${ratings.count} ${t.ratings}`}</Txt>
            </Row>
            {ratings.recent.slice(0, 5).map((r) => (
              <View key={r.bookingId} style={{ gap: 2 }}>
                <Txt v="small">{`${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)} · ${formatDay(r.day, lang)} · ${r.services.join(", ")}`}</Txt>
                {r.comment ? <Txt v="muted">{`“${r.comment}”`}</Txt> : null}
              </View>
            ))}
          </>
        ) : (
          <Txt v="muted">{t.noRatings}</Txt>
        )}
      </Card>

      <Card>
        <Txt v="small">{`${t.areas}: ${[pro.area, ...pro.zones.filter((z) => z !== pro.area)].join(", ")}`}</Txt>
        <Txt v="small">{`${t.skills}: ${pro.skills.join(", ")}`}</Txt>
        <Txt v="small">{`${t.mostADay}: ${pro.dailyCap}`}</Txt>
      </Card>

      <Txt v="h2">{t.availability}</Txt>
      {avail && (
        <Card>
          <Txt v="h3">{t.weekly}</Txt>
          <Txt v="muted">{weekly ? t.ticked : t.everyWindow}</Txt>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Row key={d} gap={4}>
              <Txt v="small" style={{ width: 64 }}>
                {days[d]}
              </Txt>
              {WINDOWS.map((w, i) => {
                const on = weekly ? (weekly[String(d)] ?? []).includes(w) : true
                return (
                  <Pressable key={w} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${days[d]} ${w}`} onPress={() => toggle(d, w)} style={{ flex: 1, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: on ? color.ink : color.paper, borderWidth: 1, borderColor: on ? color.ink : color.field }}>
                    <Txt v="tiny" style={{ color: on ? color.paper : color.muted, fontSize: 10, textTransform: "none" }}>
                      {SHORT_WINDOWS[i]}
                    </Txt>
                  </Pressable>
                )
              })}
            </Row>
          ))}
          <Row>
            <Button title={t.save} small disabled={!dirty} busy={busy === "weekly"} onPress={() => save({ availability: weekly }, "weekly")} />
            {weekly && <Button title={t.clearAll} small variant="ghost" busy={busy === "clear"} onPress={() => save({ availability: null }, "clear")} />}
          </Row>
        </Card>
      )}
      {avail && (
        <Card>
          <Txt v="h3">{t.daysOff}</Txt>
          {off.length ? (
            <Row wrap>
              {off.map((d) => (
                <Chip key={d} label={`${formatDay(d, lang)}  ✕`} onPress={() => save({ timeOff: { remove: [d] } }, d)} />
              ))}
            </Row>
          ) : (
            <Txt v="muted">{t.noDaysOff}</Txt>
          )}
          <Txt v="small" style={{ fontWeight: "600", marginTop: space.sm }}>
            {t.dayOffPick}
          </Txt>
          <Row wrap>
            {upcoming
              .filter((d) => !off.includes(d))
              .map((d) => (
                <Chip key={d} label={formatDay(d, lang)} disabled={avail.busyDays.includes(d) || busy !== ""} onPress={() => save({ timeOff: { add: [d] } }, d)} />
              ))}
          </Row>
          <Txt v="muted">{t.busyHint}</Txt>
        </Card>
      )}

      <Card>
        <Txt v="h3">{t.language}</Txt>
        <Row wrap>
          <Chip label="English" selected={lang === "en"} onPress={() => setLang("en")} />
          <Chip label="اردو" selected={lang === "ur"} onPress={() => setLang("ur")} />
          <Chip label="Roman Urdu" selected={lang === "ro"} onPress={() => setLang("ro")} />
        </Row>
      </Card>
      {pushUnavailable() === "expo-go" && <Notice tone="sky" text={t.pushOff} />}
      <Button title={t.logout} variant="light" onPress={() => void signOut()} />
    </Screen>
  )
}
