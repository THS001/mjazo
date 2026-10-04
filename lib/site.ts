// Site-wide settings: contact details, policy values, Plus, referral terms and feature flags.
// Live values come from the CMS (Settings in /admin; read with getSettings() on the server or
// useSite() in client components). The values below seed the CMS and are its fallback.

/** The public URL: custom domain if set, else the Vercel production URL, else the planned domain. Not editable. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://mjazo.pk")

export type Settings = {
  site: { name: string; url: string; tagline: string; positioning: string; city: string; email: string; instagram: string; phone: string; whatsapp: string; hours: string }
  policy: { freeChangeHours: number; lateFee: string; redoHours: number; leadHours: number }
  plus: { price: number; period: string; discount: number }
  referral: { friendOff: number; youGet: number }
  flags: { ONLINE_PAYMENTS: boolean; OTP_LOGIN: boolean; PLUS_PURCHASE: boolean; GIFT_CARDS: boolean; URDU_SITE: boolean }
}

export const DEFAULT_SETTINGS: Settings = {
  site: {
    name: "Mjazo",
    url: SITE_URL,
    tagline: "Everything your home needs. One tap.",
    positioning: "Verified pros for every corner of your Karachi home, at clear prices you pay after.",
    city: "Karachi",
    email: "hello@mjazo.pk",
    instagram: "https://instagram.com/mjazo",
    phone: "+92 300 0000000", // TODO: founder's support number
    whatsapp: "923000000000", // TODO: founder's WhatsApp Business number (digits, country code first)
    hours: "Every day, 9 am – 9 pm",
  },
  // PLACEHOLDERS until the founder confirms them.
  policy: {
    freeChangeHours: 3, // free cancel/reschedule up to N hours before the slot
    lateFee: "a small late-change fee (amount to be confirmed)",
    redoHours: 24, // report an issue within N hours for a free redo
    leadHours: 2, // earliest bookable slot from now
  },
  plus: { price: 2500, period: "year", discount: 0.1 },
  referral: { friendOff: 500, youGet: 500 },
  // Flip to true when the backing service is ready.
  flags: { ONLINE_PAYMENTS: false, OTP_LOGIN: false, PLUS_PURCHASE: false, GIFT_CARDS: false, URDU_SITE: false },
}

/** A wa.me link to Mjazo's WhatsApp with a prefilled message. */
export function waLink(number: string, message: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
}

type Props = Record<string, string | number | boolean | undefined>

// Analytics: pushes to GA4 dataLayer / Meta Pixel when present. Safe no-op otherwise.
export function track(event: string, props: Props = {}) {
  if (typeof window === "undefined") return
  const w = window as unknown as { dataLayer?: unknown[]; fbq?: (...a: unknown[]) => void }
  w.dataLayer?.push({ event, ...props })
  w.fbq?.("trackCustom", event, props)
  if (process.env.NODE_ENV !== "production") console.debug("[track]", event, props)
}

// First-touch attribution, saved once per browser and sent with every submission.
export function captureAttribution() {
  if (typeof window === "undefined") return
  try {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref && /^[A-Z0-9-]{3,24}$/i.test(ref)) localStorage.setItem("mjazo-ref", ref.toUpperCase())
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ref"]
    const found = Object.fromEntries(keys.filter((k) => params.get(k)).map((k) => [k, params.get(k)]))
    if (Object.keys(found).length && !localStorage.getItem("mjazo-attr")) {
      localStorage.setItem("mjazo-attr", JSON.stringify({ ...found, landing: window.location.pathname, ts: Date.now() }))
    }
  } catch {}
}

export function getAttribution(): Record<string, unknown> {
  try {
    const ref = localStorage.getItem("mjazo-ref")
    return { ...JSON.parse(localStorage.getItem("mjazo-attr") ?? "{}"), ...(ref ? { ref } : {}) }
  } catch {
    return {}
  }
}

/** Referral code this visitor arrived with (applies a welcome discount on their first booking). */
export function getRef(): string | null {
  try {
    return localStorage.getItem("mjazo-ref")
  } catch {
    return null
  }
}

export async function submit(type: "booking" | "request" | "waitlist" | "apply" | "enquiry", data: Record<string, unknown>) {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, data, attribution: getAttribution(), page: window.location.pathname }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Something went wrong")
  return (await res.json()) as { id: string }
}
