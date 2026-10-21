// The brand kit, for the phone: ink on warm white, one saffron accent (#F4A437), WhatsApp labels in
// ink. Rounded cards like the website.

export const color = {
  ink: "#111111",
  paper: "#FFFFFF",
  bg: "#F6F4F1",
  brand: "#F4A437",
  brandSoft: "#FDF1DE",
  muted: "#6B6B6B",
  faint: "#9A9A9A",
  line: "rgba(0,0,0,0.08)",
  field: "rgba(0,0,0,0.12)",
  green: "#15803D",
  greenSoft: "#DCFCE7",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  amber: "#B45309",
  amberSoft: "#FEF3C7",
  sky: "#0369A1",
  skySoft: "#E0F2FE",
  violet: "#6D28D9",
  violetSoft: "#EDE9FE",
  whatsapp: "#25D366",
} as const

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

export const type = {
  title: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "700" as const },
  h3: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.4 },
}

/** A tone for a status badge: background and text. */
export const tone = {
  neutral: { bg: "#F1F1F1", fg: "#444444" },
  brand: { bg: color.brandSoft, fg: "#8A5208" },
  green: { bg: color.greenSoft, fg: color.green },
  red: { bg: color.redSoft, fg: color.red },
  amber: { bg: color.amberSoft, fg: color.amber },
  sky: { bg: color.skySoft, fg: color.sky },
  violet: { bg: color.violetSoft, fg: color.violet },
} as const
export type Tone = keyof typeof tone
