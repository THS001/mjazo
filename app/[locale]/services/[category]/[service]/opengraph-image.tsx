import { ImageResponse } from "next/og"
import { formatPKR } from "@/lib/catalog"
import { getCatalog } from "@/lib/cms/read"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Mjazo service"

export async function generateStaticParams() {
  const { allServices } = await getCatalog()
  return allServices.map(({ category, service }) => ({ category: category.slug, service: service.slug }))
}

/** Per-service share card: service name, category and from-price on the world's tint. */
export default async function ServiceOg({ params }: { params: Promise<{ category: string; service: string }> }) {
  const { allServices, getService, getWorld } = await getCatalog()
  const p = await params
  const found = getService(p.category, p.service)
  const tint = found ? getWorld(found.category.world)?.tint ?? "#f6d9cf" : "#f6d9cf"
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: tint, fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontFamily: "sans-serif" }}>
          <span style={{ fontWeight: 600 }}>Mjazo</span>
          <span style={{ opacity: 0.6 }}>{found?.category.name ?? "Home services"}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, lineHeight: 1.02, color: "#111" }}>{found?.service.name ?? "Home services in Karachi"}</div>
          <div style={{ fontSize: 34, marginTop: 24, color: "#333", fontFamily: "sans-serif" }}>{found?.service.short ?? ""}</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 28, fontFamily: "sans-serif" }}>
          {found && found.service.price > 0 && <div style={{ padding: "12px 24px", borderRadius: 999, background: "#111", color: "#f4a437" }}>{`from ${formatPKR(found.service.price)}`}</div>}
          <div style={{ padding: "12px 24px", borderRadius: 999, background: "rgba(255,255,255,0.75)" }}>At home across Karachi · Pay after</div>
        </div>
      </div>
    ),
    size,
  )
}
