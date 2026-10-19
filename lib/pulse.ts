// Home Pulse planning engine (pure; runs in the browser). Turns a home profile, past bookings,
// Karachi's seasons, the weather forecast, Eid dates and family events into a 90-day care plan.
// Every item points at a real catalogue service so it can be booked in one tap.

export type PulseProfile = {
  acs: number
  tankUnderground: boolean
  tankOverhead: boolean
  solar: boolean
  geyser: "gas" | "electric" | "none"
  pets: boolean
  waxWeeks: number // 0 = not for me
  threadWeeks: number
  facialWeeks: number
  maniWeeks: number
  events: { name: string; date: string }[]
}

export const DEFAULT_PROFILE: PulseProfile = {
  acs: 2,
  tankUnderground: true,
  tankOverhead: true,
  solar: false,
  geyser: "gas",
  pets: false,
  waxWeeks: 4,
  threadWeeks: 3,
  facialWeeks: 6,
  maniWeeks: 0,
  events: [],
}

export type PulseKind = "beauty" | "home" | "season" | "weather" | "event" | "eid"
export type PulseItem = {
  id: string
  date: string // yyyy-mm-dd
  title: string
  why: string
  kind: PulseKind
  category: string
  service: string
  priority: 1 | 2 | 3 // 1 = act now
  approx?: boolean
}

export type PastBooking = { date: string; items: { category: string; service: string }[] }
export type WeatherDay = { date: string; max: number; rain: number }

/**
 * The wording of every plan item ({{tokens}} filled per item). The site passes the CMS copy
 * (Pages → Home Pulse → Tool text → Plan wording); this English is the default.
 */
export const PULSE_RULES = {
  groups: { wax: "Waxing", thread: "Threading", facial: "Facial", mani: "Mani-pedi" },
  overdue: "{{label}} is overdue",
  due: "{{label}} due",
  lastDone: "Last done {{days}} days ago; your rhythm is every {{weeks}} weeks.",
  keeping: "Keeping your every-{{weeks}}-weeks rhythm.",
  start: "Start your every-{{weeks}}-weeks routine.",
  acOne: "1 AC",
  acMany: "{{n}} ACs",
  acDue: "AC service due",
  acDueWhy: "{{units}} last serviced {{days}} days ago. Clean coils cool faster and use less power.",
  ac: "AC service",
  acWhy: "No AC service in your Mjazo history. {{units}} in Karachi's heat need cleaning every 3–4 months.",
  acPre: "Pre-summer AC service",
  acPreWhy: "Get {{units}} cleaned before the heat arrives and technicians get busy.",
  heat: "Heatwave coming: service your ACs",
  heatWhy: "Karachi forecast hits {{temp}}°C on {{date}}. Book before demand spikes.",
  tank: "Water tank cleaning",
  tankWhy: "Tanks should be cleaned and disinfected every six months.",
  tankFirstWhy: "No tank cleaning in your Mjazo history. Sludge builds up within months.",
  tankPost: "Post-monsoon tank clean",
  tankPostWhy: "Heavy rain can push dirty water into tanks. Clean and disinfect after the season.",
  fumigation: "Pre-monsoon fumigation",
  fumigationWhy: "Fog the lawn and standing-water spots before the rains bring mosquitoes.",
  dengue: "Dengue season fumigation",
  dengueWhy: "Dengue peaks in Karachi from September to November.",
  roof: "Roof waterproofing check",
  roofWhy: "Seal cracks before the monsoon: far cheaper than seepage repair after it.",
  geyser: "Geyser service before winter",
  geyserWhy: "A {{type}} geyser serviced before the cold runs safer and heats faster.",
  gas: "gas",
  electric: "electric",
  solar: "Solar panel wash",
  solarWhy: "Dust on panels can cut output noticeably, especially in the dusty months.",
  pets: "Pet grooming",
  petsWhy: "Bath, trim and nails every six weeks keeps coats healthy in the humidity.",
  eidFitr: "Eid ul-Fitr",
  eidAdha: "Eid ul-Adha",
  eidFacial: "{{eid}} glow: facial",
  eidFacialWhy: "{{eid}} is around {{date}}. A facial a week before settles in time.",
  eidMani: "{{eid}}: mani-pedi",
  eidManiWhy: "Fresh hands and feet for Eid visits.",
  chandRaat: "Chand raat mehndi",
  chandRaatWhy: "Book early: chand raat is the busiest mehndi night of the year.",
  yourEvent: "Your event",
  eventFacial: "{{name}}: facial",
  eventFacialWhy: "Two weeks before gives your skin time to settle and glow.",
  eventWax: "{{name}}: full body wax",
  eventWaxWhy: "About a week before, so any redness is long gone.",
  eventBrows: "{{name}}: brows & threading",
  eventBrowsWhy: "A few days before for a clean, natural shape.",
  eventMani: "{{name}}: mani-pedi",
  eventManiWhy: "Gel lasts through the celebrations.",
  eventMehndi: "{{name}}: mehndi",
  eventMehndiWhy: "The night before, so the colour deepens by the day.",
  eventGlam: "{{name}}: party makeup & hair",
  eventGlamWhy: "Glam at home, so you're never stuck in salon traffic in your outfit.",
  calendarBook: "Book at mjazo.pk",
}
export type PulseRules = typeof PULSE_RULES
const put = (s: string, vars: Record<string, string | number>) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

const HORIZON = 90
const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
export const addDays = (iso: string, n: number) => new Date(d(iso).getTime() + n * 86400000).toISOString().slice(0, 10)
export const daysBetween = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / 86400000)
const mmdd = (iso: string) => iso.slice(5)

const GROUPS = {
  wax: { services: ["full-body-wax", "arms-legs-wax", "underarm-wax", "face-wax"], default: "full-body-wax" },
  thread: { services: ["brows-upper-lip", "full-face-threading"], default: "brows-upper-lip" },
  facial: { services: ["hydrating-facial", "brightening-facial", "clarifying-facial", "express-cleanup"], default: "hydrating-facial" },
  mani: { services: ["manicure", "spa-pedicure", "mani-pedi"], default: "mani-pedi" },
} as const

function lastDone(bookings: PastBooking[], services: readonly string[]) {
  const dates = bookings.filter((b) => b.items.some((i) => services.includes(i.service))).map((b) => b.date).sort()
  return dates.length ? dates[dates.length - 1] : null
}
function lastService(bookings: PastBooking[], services: readonly string[]) {
  const sorted = [...bookings].sort((a, b) => a.date.localeCompare(b.date))
  for (let i = sorted.length - 1; i >= 0; i--) {
    const hit = sorted[i].items.find((it) => services.includes(it.service))
    if (hit) return hit.service
  }
  return null
}

/** Next date on/after `from` with the given month-day, if within the horizon. */
function nextMonthDay(from: string, md: string, horizonEnd: string) {
  const y = Number(from.slice(0, 4))
  for (const year of [y, y + 1]) {
    const iso = `${year}-${md}`
    if (iso >= from && iso <= horizonEnd) return iso
  }
  return null
}

/** A seasonal job: soon if we are inside its season now, else at the season's next start (if within the horizon). */
function seasonal(today: string, startMd: string, endMd: string, horizonEnd: string) {
  const md = mmdd(today)
  if (md >= startMd && md <= endMd) return addDays(today, 5)
  return nextMonthDay(today, startMd, horizonEnd)
}

/** Eid dates via the Umm al-Qura Islamic calendar (Pakistan may differ by a day; marked approx). */
export function upcomingEids(today: string, days = 400) {
  const out: { key: "fitr" | "adha"; date: string }[] = []
  let fmt: Intl.DateTimeFormat
  try {
    fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric", day: "numeric", timeZone: "UTC" })
  } catch {
    return out
  }
  for (let i = 0; i < days && out.length < 2; i++) {
    const iso = addDays(today, i)
    const parts = fmt.formatToParts(d(iso))
    const m = Number(parts.find((p) => p.type === "month")?.value)
    const day = Number(parts.find((p) => p.type === "day")?.value)
    if (m === 10 && day === 1) out.push({ key: "fitr", date: iso })
    if (m === 12 && day === 10) out.push({ key: "adha", date: iso })
  }
  return out
}

export function buildPlan({ profile, bookings, today, weather, text: t = PULSE_RULES }: { profile: PulseProfile; bookings: PastBooking[]; today: string; weather?: WeatherDay[]; text?: PulseRules }): PulseItem[] {
  const end = addDays(today, HORIZON)
  const items: PulseItem[] = []
  const push = (it: Omit<PulseItem, "id">) => {
    if (it.date < today || it.date > end) return
    items.push({ ...it, id: `${it.kind}-${it.service}-${it.date}` })
  }

  // --- Beauty routines -----------------------------------------------------------------
  const cadence: Record<keyof typeof GROUPS, number> = { wax: profile.waxWeeks, thread: profile.threadWeeks, facial: profile.facialWeeks, mani: profile.maniWeeks }
  for (const key of Object.keys(GROUPS) as (keyof typeof GROUPS)[]) {
    const weeks = cadence[key]
    if (!weeks) continue
    const g = GROUPS[key]
    const label = t.groups[key]
    const last = lastDone(bookings, g.services)
    const service = lastService(bookings, g.services) ?? g.default
    let due = last ? addDays(last, weeks * 7) : addDays(today, 3)
    const overdue = last !== null && due < today
    if (due < today) due = addDays(today, 1)
    for (let k = 0; k < 2; k++) {
      push({
        date: due,
        title: put(k === 0 && overdue ? t.overdue : t.due, { label }),
        why: put(last && k === 0 ? t.lastDone : last ? t.keeping : t.start, { days: last ? daysBetween(last, today) : 0, weeks }),
        kind: "beauty",
        category: "womens-salon",
        service,
        priority: k === 0 && (overdue || daysBetween(today, due) <= 5) ? 1 : 2,
      })
      due = addDays(due, weeks * 7)
    }
  }

  // --- Home & seasons --------------------------------------------------------------------
  if (profile.acs > 0) {
    const last = lastDone(bookings, ["ac-service"])
    const month = Number(today.slice(5, 7))
    const inSeason = month >= 3 && month <= 10
    const units = profile.acs > 1 ? put(t.acMany, { n: profile.acs }) : t.acOne
    if (last) {
      const next = addDays(last, 120)
      push({ date: next < today ? addDays(today, 2) : next, title: t.acDue, why: put(t.acDueWhy, { units, days: daysBetween(last, today) }), kind: "home", category: "ac-services", service: "ac-service", priority: next <= addDays(today, 7) ? 1 : 2 })
    } else if (inSeason) {
      push({ date: addDays(today, 3), title: t.ac, why: put(t.acWhy, { units }), kind: "season", category: "ac-services", service: "ac-service", priority: 2 })
    } else {
      const pre = nextMonthDay(today, "03-01", end)
      if (pre) push({ date: pre, title: t.acPre, why: put(t.acPreWhy, { units }), kind: "season", category: "ac-services", service: "ac-service", priority: 2 })
    }
    const hot = weather?.find((w) => w.max >= 38)
    const recent = last && daysBetween(last, today) < 90
    if (hot && !recent) push({ date: addDays(today, 1), title: t.heat, why: put(t.heatWhy, { temp: Math.round(hot.max), date: hot.date }), kind: "weather", category: "ac-services", service: "ac-service", priority: 1 })
  }

  if (profile.tankUnderground || profile.tankOverhead) {
    const service = profile.tankUnderground && profile.tankOverhead ? "tank-combo" : profile.tankUnderground ? "underground-tank" : "overhead-tank"
    const last = lastDone(bookings, ["tank-combo", "underground-tank", "overhead-tank"])
    if (last) push({ date: addDays(last, 180) < today ? addDays(today, 5) : addDays(last, 180), title: t.tank, why: t.tankWhy, kind: "home", category: "water-tank-cleaning", service, priority: 2 })
    else push({ date: addDays(today, 10), title: t.tank, why: t.tankFirstWhy, kind: "home", category: "water-tank-cleaning", service, priority: 2 })
    const post = seasonal(today, "09-01", "10-15", end)
    if (post) push({ date: post, title: t.tankPost, why: t.tankPostWhy, kind: "season", category: "water-tank-cleaning", service, priority: 2 })
  }

  for (const [start, stop, title, why] of [
    ["06-01", "07-10", t.fumigation, t.fumigationWhy],
    ["09-01", "11-15", t.dengue, t.dengueWhy],
  ] as const) {
    const at = seasonal(today, start, stop, end)
    if (at) push({ date: at, title, why, kind: "season", category: "pest-control", service: "dengue-fumigation", priority: 2 })
  }
  const roof = seasonal(today, "05-01", "06-20", end)
  if (roof) push({ date: roof, title: t.roof, why: t.roofWhy, kind: "season", category: "painting", service: "roof-waterproofing", priority: 2 })

  if (profile.geyser !== "none") {
    const at = seasonal(today, "10-25", "11-30", end) === addDays(today, 5) ? addDays(today, 5) : nextMonthDay(today, "11-01", end)
    if (at) push({ date: at, title: t.geyser, why: put(t.geyserWhy, { type: t[profile.geyser] }), kind: "season", category: "appliance-repair", service: "geyser", priority: 2 })
  }
  if (profile.solar) {
    const last = lastDone(bookings, ["panel-wash", "panel-health-check", "solar-monthly"])
    const month = Number(today.slice(5, 7))
    const gap = month >= 4 && month <= 6 ? 30 : 60
    const next = last ? addDays(last, gap) : addDays(today, 4)
    push({ date: next < today ? addDays(today, 2) : next, title: t.solar, why: t.solarWhy, kind: "home", category: "solar-cleaning", service: "panel-wash", priority: 3 })
  }
  if (profile.pets) {
    const last = lastDone(bookings, ["pet-grooming"])
    const next = last ? addDays(last, 42) : addDays(today, 7)
    push({ date: next < today ? addDays(today, 2) : next, title: t.pets, why: t.petsWhy, kind: "home", category: "care", service: "pet-grooming", priority: 3 })
  }

  // --- Eid ------------------------------------------------------------------------------------
  for (const eid of upcomingEids(today)) {
    const name = eid.key === "fitr" ? t.eidFitr : t.eidAdha
    push({ date: addDays(eid.date, -7), title: put(t.eidFacial, { eid: name }), why: put(t.eidFacialWhy, { eid: name, date: eid.date }), kind: "eid", category: "womens-salon", service: "brightening-facial", priority: 2, approx: true })
    push({ date: addDays(eid.date, -3), title: put(t.eidMani, { eid: name }), why: t.eidManiWhy, kind: "eid", category: "womens-salon", service: "mani-pedi", priority: 2, approx: true })
    if (eid.key === "fitr") push({ date: addDays(eid.date, -1), title: t.chandRaat, why: t.chandRaatWhy, kind: "eid", category: "makeup-mehndi", service: "mehndi-hands", priority: 1, approx: true })
  }

  // --- Family events --------------------------------------------------------------------------
  for (const ev of profile.events) {
    if (!ev.date || ev.date < today) continue
    const wedding = /wedding|shaadi|mehndi|mayun|baraat|walima|nikkah|nikah|dholki|شادی|مہندی|مایوں|بارات|ولیمہ|نکاح|ڈھولکی/i.test(ev.name)
    const name = ev.name.trim() || t.yourEvent
    push({ date: addDays(ev.date, -14), title: put(t.eventFacial, { name }), why: t.eventFacialWhy, kind: "event", category: "womens-salon", service: "brightening-facial", priority: 2 })
    push({ date: addDays(ev.date, -8), title: put(t.eventWax, { name }), why: t.eventWaxWhy, kind: "event", category: "womens-salon", service: "full-body-wax", priority: 2 })
    push({ date: addDays(ev.date, -3), title: put(t.eventBrows, { name }), why: t.eventBrowsWhy, kind: "event", category: "womens-salon", service: "brows-upper-lip", priority: 2 })
    push({ date: addDays(ev.date, -2), title: put(t.eventMani, { name }), why: t.eventManiWhy, kind: "event", category: "womens-salon", service: "mani-pedi", priority: 2 })
    if (wedding) push({ date: addDays(ev.date, -1), title: put(t.eventMehndi, { name }), why: t.eventMehndiWhy, kind: "event", category: "makeup-mehndi", service: "mehndi-hands", priority: 2 })
    push({ date: ev.date, title: put(t.eventGlam, { name }), why: t.eventGlamWhy, kind: "event", category: "makeup-mehndi", service: "makeup-hair-combo", priority: 1 })
  }

  // Event and Eid plans replace routine reminders for the same service within 6 days.
  const special = items.filter((i) => i.kind === "event" || i.kind === "eid")
  const kept = items.filter((i) => i.kind !== "beauty" || !special.some((s) => s.service === i.service && Math.abs(daysBetween(s.date, i.date)) <= 6))
  const unique = kept.filter((i, idx) => kept.findIndex((x) => x.id === i.id) === idx)
  return unique.sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority).slice(0, 18)
}

/** One .ics file with every plan item as an all-day event and a reminder the day before. */
export function planIcs(items: PulseItem[], label = "Mjazo", book = PULSE_RULES.calendarBook) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
  const esc = (s: string) => s.replace(/[,;\\]/g, (m) => `\\${m}`)
  const ev = items.flatMap((i) => [
    "BEGIN:VEVENT",
    `UID:${i.id}@mjazo.pk`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${i.date.replace(/-/g, "")}`,
    `DTEND;VALUE=DATE:${addDays(i.date, 1).replace(/-/g, "")}`,
    `SUMMARY:${esc(`${label}: ${i.title}`)}`,
    `DESCRIPTION:${esc(`${i.why} ${book}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(i.title)}`,
    "END:VALARM",
    "END:VEVENT",
  ])
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mjazo//Home Pulse//EN", ...ev, "END:VCALENDAR"].join("\r\n")
}
