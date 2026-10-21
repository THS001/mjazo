// Where Mjazo's areas are: one centre point per neighbourhood. Route Brain uses them for travel
// times (lib/ops/logic.ts); saved addresses use them to tell which area a map pin is in, and the
// map starts there. Pure, so the browser can use it too.

export const AREA_CENTERS: Record<string, [number, number]> = {
  dha: [24.795, 67.064],
  clifton: [24.818, 67.03],
  pechs: [24.868, 67.068],
  bahadurabad: [24.881, 67.071],
  gulshan: [24.921, 67.096],
  jauhar: [24.913, 67.132],
  "north-nazimabad": [24.937, 67.041],
  bahria: [25.028, 67.309],
}

/** Karachi, for the map's starting view and to refuse pins far outside the city. */
export const KARACHI: [number, number] = [24.86, 67.06]
export const inKarachi = (lat: number, lng: number) => lat > 24.7 && lat < 25.25 && lng > 66.8 && lng < 67.45

/** Straight-line distance in km. */
export function kmBetween(a: [number, number], b: [number, number]) {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** How far from an area's centre a pin still counts as that area. */
export const ZONE_RADIUS_KM = 6

/**
 * The area a map pin falls in: the nearest centre within ZONE_RADIUS_KM, among `areas` (the live
 * ones) when given. Null when the pin is outside every area we cover.
 */
export function zoneFor(lat: number, lng: number, areas?: string[]): string | null {
  let best: { slug: string; km: number } | null = null
  for (const [slug, c] of Object.entries(AREA_CENTERS)) {
    if (areas && !areas.includes(slug)) continue
    const km = kmBetween([lat, lng], c)
    if (km <= ZONE_RADIUS_KM && (!best || km < best.km)) best = { slug, km }
  }
  return best?.slug ?? null
}
