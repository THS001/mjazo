// Date formatting for the CMS admin, usable on the server and in the browser.

export const ago = (iso: string | null | undefined) => {
  if (!iso) return ""
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (s < 45) return "just now"
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: s > 300 * 86400 ? "numeric" : undefined })
}

export const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" }) : ""
