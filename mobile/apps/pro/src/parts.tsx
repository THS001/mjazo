import { Badge, Button, Card, Chip, color, confirm, currentLocation, errorText, formatPKR, Notice, Row, space, tell, Txt, useLang, windowLabel, type BookingStatus, type Visit } from "@mjazo/shared"
import { router } from "expo-router"
import { ShieldAlert } from "lucide-react-native"
import { useState } from "react"
import { Linking, Pressable, View } from "react-native"
import { useSession, useT } from "./session"

// Pieces several pro screens share: a visit's card, its status, the safety prompt and SOS.

export function StatusBadge({ status }: { status: BookingStatus }) {
  const t = useT()
  const map: Partial<Record<BookingStatus, [string, "neutral" | "brand" | "green" | "red" | "sky" | "violet"]>> = {
    assigned: [t.statusAssigned, "sky"],
    en_route: [t.onWay, "brand"],
    checked_in: [t.statusIn, "violet"],
    checked_out: [t.checkOut, "violet"],
    completed: [t.done, "green"],
    cancelled: [t.cancel, "red"],
  }
  const [text, tone] = map[status] ?? [status, "neutral"]
  return <Badge text={text} tone={tone} />
}

/** A visit in a list: when, where, what, what she earns; tap for the visit. */
export function VisitCard({ v }: { v: Visit }) {
  const t = useT()
  const { lang } = useLang()
  const alert = v.safety.level !== "ok" && !["completed", "cancelled"].includes(v.status)
  return (
    <Card onPress={() => router.push({ pathname: "/visit/[id]", params: { id: v.id } })} style={alert ? { borderColor: color.red, borderWidth: 1.5 } : undefined}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h3" style={{ flex: 1 }}>
          {windowLabel(v.window, lang)}
          {v.eta ? ` · ${v.eta}` : ""}
        </Txt>
        <StatusBadge status={v.status} />
      </Row>
      <Txt>{[v.subArea, v.area].filter(Boolean).join(", ")}</Txt>
      <Txt v="muted" numberOfLines={2}>
        {v.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")}
      </Txt>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="small">
          {t.youEarn} {formatPKR(v.earn)}
        </Txt>
        {v.askedForYou && <Badge text={t.askedForYou} tone="violet" />}
      </Row>
      {alert && <Notice tone="red" text={v.safety.message || t.safeBody} />}
    </Card>
  )
}

/** SOS: confirm, then ops get her location at once (on a visit, it goes on the visit). */
export function SosButton({ jobId, compact }: { jobId?: string; compact?: boolean }) {
  const t = useT()
  const { api, config } = useSession()
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!(await confirm(t.sosQ, t.sosBody, t.sosSend, t.cancel, true))) return
    setBusy(true)
    try {
      const where = await currentLocation()
      await api("/api/v1/pro/sos", { body: { ...(jobId ? { jobId } : {}), ...(where ?? {}) } })
      tell(t.sosSent)
    } catch (e) {
      // Nothing reached ops: she must call.
      tell(errorText(e, t.offline), `${t.call15}${config?.contact?.phone ? ` · ${t.callOps}: ${config.contact.phone}` : ""}`)
    } finally {
      setBusy(false)
    }
  }
  return compact ? (
    <Pressable accessibilityRole="button" accessibilityLabel={t.sos} onPress={send} disabled={busy} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: color.red, borderRadius: 999, paddingHorizontal: 14, height: 38, opacity: busy || pressed ? 0.7 : 1 })}>
      <ShieldAlert size={16} color={color.paper} />
      <Txt v="small" style={{ color: color.paper, fontWeight: "700" }}>
        {t.sos}
      </Txt>
    </Pressable>
  ) : (
    <View style={{ gap: space.sm }}>
      <Button title={t.sos} variant="danger" busy={busy} icon={<ShieldAlert size={18} color={color.paper} />} onPress={send} />
      <Row>
        <Chip label={t.call15} onPress={() => void Linking.openURL("tel:15")} />
        {config?.contact?.phone ? <Chip label={t.callOps} onPress={() => void Linking.openURL(`tel:${config.contact!.phone.replace(/[^\d+]/g, "")}`)} /> : null}
      </Row>
    </View>
  )
}

/** "PKR 3,375" (and "PKR 0", where a price would say "On request"). */
export const money = (n: number) => `PKR ${Math.round(Math.abs(n)).toLocaleString("en-US")}`
