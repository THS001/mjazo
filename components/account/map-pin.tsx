"use client"

import { useEffect, useRef, useState } from "react"
import { Crosshair, Loader2 } from "lucide-react"
import "leaflet/dist/leaflet.css"
import { AREA_CENTERS, KARACHI, inKarachi, zoneFor } from "@/lib/geo"
import { cn } from "@/lib/utils"

// A map to put the pin on a customer's door: the pin stays in the middle and they move the map
// under it (or use their location). OpenStreetMap tiles through Leaflet: no API key. Reports the
// pin and the area it falls in (null outside the areas we cover).

export type Pin = { lat: number; lng: number; area: string | null }

export function MapPin({ value, area, areas, onChange, labels, className }: { value?: { lat: number; lng: number } | null; area?: string; areas: string[]; onChange: (p: Pin) => void; labels: { myLocation: string }; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<import("leaflet").Map | null>(null)
  const report = useRef(onChange)
  report.current = onChange
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    let alive = true
    void import("leaflet").then((L) => {
      if (!alive || !box.current || map.current) return
      const start: [number, number] = value ? [value.lat, value.lng] : area && AREA_CENTERS[area] ? AREA_CENTERS[area] : KARACHI
      // No glide after a drag: the pin stays exactly where they let go.
      const m = L.map(box.current, { center: start, zoom: value ? 17 : area ? 15 : 12, zoomControl: true, attributionControl: true, inertia: false })
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m)
      const emit = () => {
        const c = m.getCenter()
        const lat = Math.round(c.lat * 1e6) / 1e6
        const lng = Math.round(c.lng * 1e6) / 1e6
        report.current({ lat, lng, area: inKarachi(lat, lng) ? zoneFor(lat, lng, areas) : null })
      }
      m.on("moveend", emit)
      map.current = m
      if (value) emit()
    })
    return () => {
      alive = false
      // Closing the map must never take the page down with it (Leaflet can throw while tidying up).
      try {
        map.current?.remove()
      } catch (e) {
        console.warn("[map] cleanup failed", e)
      }
      map.current = null
    }
    // The map is made once; later pins come from moving it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Picking an area elsewhere on the form moves the map there (until a pin is set).
  useEffect(() => {
    if (!value && area && AREA_CENTERS[area]) map.current?.setView(AREA_CENTERS[area], 15)
  }, [area, value])

  const locate = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false)
        map.current?.setView([p.coords.latitude, p.coords.longitude], 18)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className={cn("relative rounded-2xl overflow-hidden border border-zinc-200 isolate", className)}>
      <div ref={box} className="h-64 w-full bg-zinc-100" />
      {/* The pin sits on the middle of the map; its tip marks the spot. */}
      <svg aria-hidden viewBox="0 0 24 36" className="pointer-events-none absolute left-1/2 top-1/2 z-[500] w-8 h-12 -translate-x-1/2 -translate-y-full drop-shadow">
        <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 36 12 36s12-15.2 12-24.1C24 5.3 18.6 0 12 0z" fill="#0b0b0b" />
        <circle cx="12" cy="12" r="4.5" fill="#F4A437" />
      </svg>
      <button type="button" onClick={locate} className="absolute z-[500] bottom-3 end-3 h-10 px-3 rounded-full bg-white shadow border border-zinc-200 text-xs font-medium flex items-center gap-1.5">
        {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />} {labels.myLocation}
      </button>
    </div>
  )
}
