import { ApiError } from "@mjazo/shared"
import * as Location from "expo-location"
import { useEffect, useState } from "react"
import { AppState } from "react-native"
import { useSchedule } from "./schedule"
import { useSession } from "./session"

// Live tracking: while she's on the way to a visit and Mjazo Pro is open, her location goes to Mjazo
// about once a minute (the customer sees how far away she is; ops see it on the board). Only with
// the permission she already gave for "On my way" (never asked for here), never in the background,
// and it stops when the visit moves on (check-in: the server answers 409).

const EVERY_MS = 55_000

export function LiveTracker() {
  const { schedule, reload } = useSchedule()
  const { api } = useSession()
  const onWay = (schedule?.days.flatMap((d) => d.visits) ?? []).filter((v) => v.status === "en_route").map((v) => v.id)
  const key = onWay.join(",")
  const [open, setOpen] = useState(AppState.currentState === "active")
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setOpen(s === "active"))
    return () => sub.remove()
  }, [])
  useEffect(() => {
    if (!key || !open) return
    let sub: Location.LocationSubscription | null = null
    let stopped = false
    let last = 0
    void (async () => {
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null)
      if (perm?.status !== "granted" || stopped) return
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 50 }, (pos) => {
        if (Date.now() - last < EVERY_MS) return
        last = Date.now()
        for (const id of key.split(","))
          void api(`/api/v1/pro/jobs/${encodeURIComponent(id)}/location`, { body: { lat: pos.coords.latitude, lng: pos.coords.longitude, ...(pos.coords.accuracy != null ? { accuracy: pos.coords.accuracy } : {}) } }).catch((e) => {
            // The visit moved on (checked in, cancelled): the schedule updates and tracking stops.
            if (e instanceof ApiError && e.status === 409) void reload()
          })
      }).catch(() => null)
      if (stopped) sub?.remove()
    })()
    return () => {
      stopped = true
      sub?.remove()
    }
  }, [key, open, api, reload])
  return null
}
