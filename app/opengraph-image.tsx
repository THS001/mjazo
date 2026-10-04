import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Mjazo: everything your home needs, across Karachi"

/** Default social share image for every page without its own. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(160deg, #fbf3e4 0%, #f7d9a0 55%, #f4a437 100%)", fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontFamily: "sans-serif", fontWeight: 600 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#f4a437" strokeWidth="2"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M8 21v-6.5l4 3.5 4-3.5V21" /></svg>
          </div>
          Mjazo
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, lineHeight: 1, color: "#111" }}>Everything your home needs.</div>
          <div style={{ fontSize: 34, marginTop: 28, color: "#3a2f1d", fontFamily: "sans-serif" }}>Salon at home · Cleaning · AC · Repairs · Health · Care</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 26, fontFamily: "sans-serif", color: "#111" }}>
          {["Verified pros", "All-in prices", "Pay after", "Across Karachi"].map((t) => (
            <div key={t} style={{ padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.7)" }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    size,
  )
}
