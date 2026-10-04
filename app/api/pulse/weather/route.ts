import { NextResponse } from "next/server"

// Karachi 7-day forecast (Open-Meteo, free, no key). Cached for an hour across visitors.
export const revalidate = 3600

export async function GET() {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=24.86&longitude=67.01&daily=temperature_2m_max,precipitation_sum&timezone=Asia%2FKarachi&forecast_days=7",
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) throw new Error(String(res.status))
    const j = (await res.json()) as { daily: { time: string[]; temperature_2m_max: number[]; precipitation_sum: number[] } }
    const days = j.daily.time.map((date, i) => ({ date, max: j.daily.temperature_2m_max[i], rain: j.daily.precipitation_sum[i] }))
    return NextResponse.json({ days })
  } catch (e) {
    console.error("[pulse/weather]", e)
    return NextResponse.json({ days: [] })
  }
}
