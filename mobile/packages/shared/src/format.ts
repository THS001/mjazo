// Money, dates, time windows and phone numbers, the way the website writes them.

export const formatPKR = (n: number) => (n <= 0 ? "On request" : `PKR ${Math.round(n).toLocaleString("en-US")}`)
/** An amount of money (what's left to pay can be PKR 0, unlike a price). */
export const formatAmount = (n: number) => `PKR ${Math.max(0, Math.round(n)).toLocaleString("en-US")}`

const TZ = "Asia/Karachi"

/** Today in Karachi (YYYY-MM-DD) and the hour (with minutes as a fraction). */
export function karachiNow(at = new Date()) {
  const k = new Date(at.getTime() + 5 * 3600_000)
  return { date: k.toISOString().slice(0, 10), hour: k.getUTCHours() + k.getUTCMinutes() / 60 }
}

export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

const WEEKDAYS = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], ur: ["اتوار", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ"] }
const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ur: ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"],
}

/** "Thu 23 Oct" / "جمعرات 23 اکتوبر" for a YYYY-MM-DD day (no Intl needed, so every phone agrees). */
export function formatDay(iso: string, lang: string = "en") {
  const d = new Date(`${iso}T12:00:00Z`)
  const l = lang === "ur" ? "ur" : "en"
  return `${WEEKDAYS[l][d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[l][d.getUTCMonth()]}`
}

/** "3:40 pm" for an ISO time, in Karachi. */
export function formatTime(isoOrHhmm: string) {
  const [h, m] = /^\d{1,2}:\d{2}$/.test(isoOrHhmm)
    ? isoOrHhmm.split(":").map(Number)
    : (() => {
        const k = new Date(Date.parse(isoOrHhmm) + 5 * 3600_000)
        return [k.getUTCHours(), k.getUTCMinutes()]
      })()
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`
}

/** "Thu 23 Oct, 3:40 pm" for an ISO time, in Karachi. */
export const formatWhen = (iso: string, lang = "en") => `${formatDay(karachiNow(new Date(iso)).date, lang)}, ${formatTime(iso)}`

export const WINDOWS = ["9–11 am", "11 am–1 pm", "1–3 pm", "3–5 pm", "5–7 pm", "7–9 pm"]
const WINDOWS_UR = ["صبح 9 سے 11", "صبح 11 سے دوپہر 1", "دوپہر 1 سے 3", "سہ پہر 3 سے 5", "شام 5 سے 7", "شام 7 سے رات 9"]
export const windowLabel = (label: string, lang = "en") => (lang === "ur" ? (WINDOWS_UR[WINDOWS.indexOf(label)] ?? label) : label)

export const PK_PHONE = /^(\+92|0092|0)?3\d{9}$/
/** 03001234567 from "+92 300 1234567", "0300-1234567", … */
export function normalisePhone(p: string) {
  const d = p.replace(/[^\d+]/g, "")
  if (d.startsWith("+92")) return `0${d.slice(3)}`
  if (d.startsWith("0092")) return `0${d.slice(4)}`
  if (d.startsWith("92") && d.length === 12) return `0${d.slice(2)}`
  return d.startsWith("3") && d.length === 10 ? `0${d}` : d
}
export const validPhone = (p: string) => PK_PHONE.test(normalisePhone(p))

/** {{token}} replacement in a string from the string tables. */
export const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => String(vars[k] ?? ""))

export const whatsappLink = (number: string, text = "") => `https://wa.me/${number.replace(/\D/g, "").replace(/^0/, "92")}${text ? `?text=${encodeURIComponent(text)}` : ""}`
