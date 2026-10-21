import { describe, expect, it } from "vitest"
import { buildCatalog, DEFAULT_CATALOG } from "@/lib/catalog"
import { buildPlan, DEFAULT_PROFILE, PULSE_RULES } from "@/lib/pulse"
import { computeSchedule, emptyPlan, personMessage, SHAADI_WORDS, type ShaadiPlan } from "@/lib/shaadi"
import { storedDefaults } from "./defaults"
import { getType } from "./registry"
import "./types"
import { UI_DEFAULTS, UI_UR } from "./types/ui"
import { MESSAGES, MESSAGES_UR } from "./types/messages"
import { GHAR_SCAN_TEXT, GHAR_SCAN_TEXT_UR } from "./types/tool-text/ghar-scan"
import { HOME_PULSE_TEXT, HOME_PULSE_TEXT_UR } from "./types/tool-text/home-pulse"
import { GLAM_MIRROR_TEXT, GLAM_MIRROR_TEXT_UR } from "./types/tool-text/glam-mirror"
import { SHAADI_TEXT, SHAADI_TEXT_UR } from "./types/tool-text/shaadi"
import { PHONE_TEXT, PHONE_TEXT_UR } from "./types/tool-text/phone-app"
import { PARTNER_TEXT } from "./types/tool-text/partner"

// Interface text ships in English with hand-written Urdu. The two must line up exactly: same keys,
// same list lengths and the same {{tokens}} in every string, or the Urdu site shows a raw token or
// silently falls back to English.

type Tree = { [k: string]: unknown }
const tokens = (s: string) => [...new Set(s.match(/\{\{\s*\w+\s*\}\}/g) ?? [])].sort()

/** Every mismatch between two string trees, as "path: problem". */
function mismatches(en: unknown, ur: unknown, at = ""): string[] {
  if (typeof en === "string") {
    if (typeof ur !== "string") return [`${at}: missing`]
    if (!ur.trim()) return [`${at}: empty`]
    const a = tokens(en).join()
    const b = tokens(ur).join()
    return a === b ? [] : [`${at}: tokens ${a || "none"} vs ${b || "none"}`]
  }
  if (Array.isArray(en)) {
    if (!Array.isArray(ur)) return [`${at}: not a list`]
    if (en.length !== ur.length) return [`${at}: ${en.length} items vs ${ur.length}`]
    return en.flatMap((x, i) => mismatches(x, ur[i], `${at}[${i}]`))
  }
  if (en && typeof en === "object") {
    if (!ur || typeof ur !== "object") return [`${at}: missing`]
    const out = Object.keys(en as Tree).flatMap((k) => mismatches((en as Tree)[k], (ur as Tree)[k], at ? `${at}.${k}` : k))
    for (const k of Object.keys(ur as Tree)) if (!(k in (en as Tree))) out.push(`${at ? `${at}.` : ""}${k}: not in English`)
    return out
  }
  return []
}

const PAIRS: [string, unknown, unknown][] = [
  ["Buttons & labels", UI_DEFAULTS, UI_UR],
  ["Ghar Scan", GHAR_SCAN_TEXT, GHAR_SCAN_TEXT_UR],
  ["Home Pulse", HOME_PULSE_TEXT, HOME_PULSE_TEXT_UR],
  ["Glam Mirror", GLAM_MIRROR_TEXT, GLAM_MIRROR_TEXT_UR],
  ["Shaadi Orchestrator", SHAADI_TEXT, SHAADI_TEXT_UR],
  ["Hero phone app", PHONE_TEXT, PHONE_TEXT_UR],
]

/** Every string in a tree. */
const strings = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [])

describe("shipped Urdu interface text", () => {
  for (const [name, en, ur] of PAIRS) {
    it(`${name}: Urdu has every English string, with the same {{tokens}}`, () => {
      expect(mismatches(en, ur)).toEqual([])
    })
  }

  it("partner pages: every text has English, Urdu and Roman Urdu with the same {{tokens}}", () => {
    const bad: string[] = []
    const walk = (v: unknown, at: string) => {
      if (!v || typeof v !== "object") return
      const o = v as Tree
      if (typeof o.en === "string") {
        for (const l of ["ur", "ro"]) {
          if (typeof o[l] !== "string" || !(o[l] as string).trim()) bad.push(`${at}.${l}: empty`)
          else if (tokens(o[l] as string).join() !== tokens(o.en).join()) bad.push(`${at}.${l}: tokens differ`)
        }
        return
      }
      for (const [k, x] of Object.entries(o)) walk(x, at ? `${at}.${k}` : k)
    }
    walk(PARTNER_TEXT, "")
    expect(bad).toEqual([])
  })

  it("no {{token}} in tool text collides with a page token (site, policy, plus, referral, flags, catalog)", () => {
    // getPage() fills page tokens and keeps unknown ones, so a placeholder named like a page token
    // would be replaced on read instead of where the tool fills it.
    const roots = new Set(["site", "policy", "plus", "referral", "flags", "catalog"])
    const used = new Set([GHAR_SCAN_TEXT, HOME_PULSE_TEXT, GLAM_MIRROR_TEXT, SHAADI_TEXT, PHONE_TEXT, PARTNER_TEXT].flatMap(strings).flatMap((s) => [...s.matchAll(/\{\{\s*(\w+)/g)].map((m) => m[1])))
    expect([...used].filter((t) => roots.has(t))).toEqual([])
  })

  it("the page types ship their Urdu tool text with their defaults", () => {
    const urOf = (type: string, path: string[]) => {
      let v: unknown = storedDefaults(getType(type)!).get("main")
      for (const k of path) v = (v as Tree)?.[k]
      return (v as { ur?: string })?.ur
    }
    expect(urOf("page-ghar-scan", ["tool", "modes", "home"])).toBe(GHAR_SCAN_TEXT_UR.modes.home)
    expect(urOf("page-home-pulse", ["tool", "rules", "tank"])).toBe(HOME_PULSE_TEXT_UR.rules.tank)
    expect(urOf("page-glam-mirror", ["tool", "card", "title"])).toBe(GLAM_MIRROR_TEXT_UR.card.title)
    expect(urOf("page-shaadi-planner", ["tool", "words", "roles", "bride"])).toBe(SHAADI_TEXT_UR.words.roles.bride)
    expect(urOf("page-home", ["phone", "tabs", "cart"])).toBe(PHONE_TEXT_UR.tabs.cart)
    expect(urOf("ui", ["concierge", "launcher"])).toBe(UI_UR.concierge.launcher)
  })
})

describe("engines with CMS wording", () => {
  const cat = buildCatalog(DEFAULT_CATALOG)

  it("Home Pulse: the default wording is the original English; Urdu wording changes only the words", () => {
    const today = "2026-10-19"
    const en = buildPlan({ profile: DEFAULT_PROFILE, bookings: [], today })
    const ur = buildPlan({ profile: DEFAULT_PROFILE, bookings: [], today, text: HOME_PULSE_TEXT_UR.rules })
    expect(en.map((i) => i.title)).toContain("Water tank cleaning")
    expect(en.find((i) => i.service === "tank-combo")?.why).toBe(PULSE_RULES.tankFirstWhy)
    expect(ur.map((i) => [i.id, i.date, i.service])).toEqual(en.map((i) => [i.id, i.date, i.service]))
    expect(ur.find((i) => i.service === "tank-combo")?.title).toBe(HOME_PULSE_TEXT_UR.rules.tank)
    expect(ur.flatMap((i) => [i.title, i.why]).join(" ")).not.toMatch(/\{\{/)
  })

  it("Shaadi: wording doesn't change the schedule, and full mehndi still gets its drying time", () => {
    const plan: ShaadiPlan = {
      ...emptyPlan(),
      events: [{ id: "e1", name: "Mehndi", date: "2026-12-12", readyBy: "19:00" }],
      people: [
        { id: "p1", name: "Ayesha", role: "bride", branch: "Bride's family", looks: { e1: ["mehndi-full", "party-makeup", "hair"] }, prep: ["facial"] },
        { id: "p2", name: "Sara", role: "family", branch: "Bride's family", looks: { e1: ["mehndi-hands", "soft-glam"] }, prep: [] },
      ],
    }
    const en = computeSchedule(plan, "2026-10-19", cat)
    const ur = computeSchedule(plan, "2026-10-19", cat, { words: SHAADI_TEXT_UR.words })
    const times = (s: typeof en) => s.events.flatMap((e) => e.tracks.flatMap((t) => t.blocks.map((b) => `${t.id} ${b.person} ${b.key} ${b.start}-${b.end}`)))
    expect(times(ur)).toEqual(times(en))
    expect(ur.total).toBe(en.total)
    // Full mehndi must finish 4 hours before photos (19:00 → by 15:00).
    const mehndiFull = en.events[0].tracks.flatMap((t) => t.blocks).find((b) => b.key === "mehndi-full")!
    expect(mehndiFull.end <= "15:00").toBe(true)
    expect(en.events[0].tracks.flatMap((t) => t.blocks).find((b) => b.key === "party-makeup")?.label).toBe(SHAADI_WORDS.looks["party-makeup"])
    expect(ur.events[0].tracks.flatMap((t) => t.blocks).find((b) => b.key === "party-makeup")?.label).toBe(SHAADI_TEXT_UR.words.looks["party-makeup"])
    expect(personMessage(plan, en, "p1")).toMatch(/^Assalam o Alaikum Ayesha! Your Mjazo glam plan for Our shaadi:/)
    expect(personMessage(plan, ur, "p1", { words: SHAADI_TEXT_UR.words, locale: "ur" })).toMatch(/^السلام علیکم Ayesha!/)
  })
})

describe("the messages Mjazo sends by itself", () => {
  it("has hand-written Urdu for every message, with the same {{tokens}}", () => {
    expect(mismatches(MESSAGES, MESSAGES_UR)).toEqual([])
  })
})
