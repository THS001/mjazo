// The Mjazo catalogue: types, the built-in defaults and the helpers built over them.
// Live content comes from the CMS (lib/cms/read.ts → getCatalog / useCatalog); the data below seeds
// it and is the fallback when the CMS is unreachable. Prices are PLACEHOLDERS until the founder confirms them.

import type { Img } from "@/lib/cms/fields"

export type Status = "live" | "waitlist" | "hidden"
export type ProType = "women" | "technician" | "care"

export interface Variant {
  label: string
  options: { label: string; delta: number }[]
}

export interface AddOn {
  id: string
  name: string
  price: number
}

export interface Service {
  slug: string
  name: string
  short: string
  price: number // "from" price in PKR; 0 = price on request
  duration: number // minutes
  popular?: boolean
  variants?: Variant[]
  addOns?: AddOn[]
  includes?: string[]
  image?: Img // photo from the media library; the icon on its tint shows without one
}

export interface Category {
  slug: string
  name: string
  world: string
  icon: string
  tagline: string
  heroLine: string
  proType: ProType
  status: Status
  includes: string[]
  excludes: string[]
  faqs: [string, string][]
  services: Service[]
  image?: Img
}

export interface World {
  slug: string
  name: string
  short: string
  bgWord: string
  icon: string
  object: ThreeObject
  tint: string
  image?: Img
  model?: Img // a GLB from the media library replaces the built-in 3D object
}

export type ThreeObject =
  | "lipstick"
  | "spray"
  | "shield"
  | "ac"
  | "wrench"
  | "stethoscope"
  | "heart"
  | "box"

export interface Area {
  slug: string
  name: string
  status: Status
  subAreas: string[]
  blurb: string
}


// ---------------------------------------------------------------------------
// Worlds
// ---------------------------------------------------------------------------

const worlds: World[] = [
  { slug: "beauty-wellness", name: "Beauty & Wellness", short: "Salon, spa & glam at home", bgWord: "GLOW", icon: "Sparkles", object: "lipstick", tint: "#f6d9cf" },
  { slug: "cleaning", name: "Cleaning", short: "Maids, deep cleans & more", bgWord: "CLEAN", icon: "SprayCan", object: "spray", tint: "#d6e9e4" },
  { slug: "pest-control", name: "Pest Control", short: "Bugs out. Peace in.", bgWord: "SAFE", icon: "Bug", object: "shield", tint: "#e3e6cf" },
  { slug: "ac-appliances", name: "AC & Appliances", short: "Cool, fixed, running", bgWord: "COOL", icon: "AirVent", object: "ac", tint: "#d7e4f2" },
  { slug: "repairs-home", name: "Repairs & Home", short: "Electric, plumbing, paint", bgWord: "FIX", icon: "Wrench", object: "wrench", tint: "#efe1c9" },
  { slug: "health", name: "Health at Home", short: "Tests, nurses, physio", bgWord: "HEAL", icon: "Stethoscope", object: "stethoscope", tint: "#e7d9ee" },
  { slug: "care", name: "Care", short: "Baby, elder & pet care", bgWord: "CARE", icon: "Baby", object: "heart", tint: "#f3dbe2" },
  { slug: "moving", name: "Moving & More", short: "Shifting & laundry", bgWord: "MOVE", icon: "Truck", object: "box", tint: "#e2ddd5" },
]

// ---------------------------------------------------------------------------
// Shared copy
// ---------------------------------------------------------------------------

const BEAUTY_INCLUDES = [
  "A vetted, women-only pro",
  "Sealed single-use kit, opened in front of you",
  "Disposable sheets, towels and clean-up after",
  "All-in price: no visit fee, no haggling",
]
const BEAUTY_EXCLUDES = ["Bridal makeup (by request only)", "Treatments needing a licensed clinic"]
const BEAUTY_FAQS: [string, string][] = [
  ["Are all beauty pros women?", "Yes. Every Mjazo beauty and spa pro is a woman, CNIC-verified, background-checked and trained by us."],
  ["What do I need to arrange?", "Just a little space and good light. Your pro brings everything else, including sheets and a sealed kit."],
  ["Can I cancel or reschedule?", "Free up to {{policy.freeChangeHours}} hours before your slot. Later changes may carry a small fee; see our cancellation policy."],
  ["How do I pay?", "Pay after the service by cash, JazzCash, Easypaisa or Raast. Nothing to pay when you book."],
]
const TECH_INCLUDES = [
  "A verified, trained technician",
  "Upfront price before any work starts",
  "Clean-up after the job",
  "30-day service warranty on our work",
]
const TECH_EXCLUDES = ["Spare parts (quoted separately, with your approval)", "Civil or structural work"]
const TECH_FAQS: [string, string][] = [
  ["Who will come to my home?", "A Mjazo-verified technician: CNIC-checked, background-checked and skill-tested before their first job."],
  ["Are spare parts included?", "No. If a part is needed, the technician shows you the price first. Nothing is fitted without your OK."],
  ["Is the work guaranteed?", "Yes, our work carries a 30-day service warranty. If the same issue returns, we fix it free."],
  ["How soon can a technician come?", "Book a time window up to 7 days ahead; the earliest slot is about {{policy.leadHours}} hours from when you book, depending on availability. For urgent jobs, WhatsApp us."],
]
const CARE_INCLUDES = ["A verified, trained caregiver", "Women caregivers for in-home care", "Clear hourly or per-visit pricing"]
const CARE_EXCLUDES = ["Medical procedures needing a licensed clinic"]

const s = (
  slug: string,
  name: string,
  price: number,
  duration: number,
  short: string,
  extra: Partial<Service> = {},
): Service => ({ slug, name, price, duration, short, ...extra })

const waxType: Variant = { label: "Wax type", options: [{ label: "Regular", delta: 0 }, { label: "Rica (peel-off)", delta: 800 }] }
const acType: Variant = { label: "AC type", options: [{ label: "Split", delta: 0 }, { label: "Window", delta: -300 }, { label: "Inverter split", delta: 500 }] }
const acCount: Variant = { label: "Units", options: [{ label: "1 unit", delta: 0 }, { label: "2 units", delta: 2200 }, { label: "3 units", delta: 4200 }] }
const homeSize: Variant = { label: "Home size", options: [{ label: "Apartment (2 bed)", delta: 0 }, { label: "House (3–4 bed)", delta: 6000 }, { label: "Large house (5+ bed)", delta: 14000 }] }

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const categories: Category[] = [
  // ---------------- Beauty & Wellness (LIVE) ----------------
  {
    slug: "womens-salon", name: "Women's Salon", world: "beauty-wellness", icon: "Sparkles",
    tagline: "Waxing, threading, facials, mani-pedi", heroLine: "Smooth moves only.",
    proType: "women", status: "live", includes: BEAUTY_INCLUDES, excludes: BEAUTY_EXCLUDES, faqs: BEAUTY_FAQS,
    services: [
      s("full-body-wax", "Full body waxing", 4500, 120, "Arms, legs, underarms and stomach/back. Our hero service.", { popular: true, variants: [waxType], addOns: [{ id: "face-wax", name: "Face wax", price: 800 }, { id: "bikini", name: "Bikini line", price: 1200 }] }),
      s("arms-legs-wax", "Full arms + full legs wax", 2500, 60, "Smooth from shoulder to toe.", { popular: true, variants: [waxType], addOns: [{ id: "underarm", name: "Underarms", price: 500 }] }),
      s("underarm-wax", "Underarm wax", 500, 15, "Quick, clean, done."),
      s("face-wax", "Face wax", 800, 20, "Full face with gentle wax for sensitive skin."),
      s("brows-upper-lip", "Threading: brows + upper lip", 400, 15, "Shape and tidy in fifteen minutes.", { popular: true }),
      s("full-face-threading", "Full face threading", 900, 25, "Brows, upper lip, chin, forehead, sides."),
      s("express-cleanup", "Express clean-up", 2000, 45, "Cleanse, exfoliate, steam, mask. A quick reset."),
      s("hydrating-facial", "Hydrating facial", 3500, 60, "Deep moisture for dry, tired skin."),
      s("brightening-facial", "Brightening facial", 3800, 70, "Evens tone and adds glow. No bleach, no ‘fairness’.", { popular: true, addOns: [{ id: "eye-mask", name: "Under-eye mask", price: 600 }] }),
      s("clarifying-facial", "Clarifying (acne-care) facial", 3500, 60, "Calms breakouts and unclogs pores."),
      s("manicure", "Classic manicure", 1500, 40, "Shape, cuticle care, scrub, massage, polish."),
      s("spa-pedicure", "Spa pedicure", 2200, 50, "Soak, scrub, callus care, mask, massage, polish."),
      s("mani-pedi", "Mani-pedi combo", 3300, 90, "Both, for less.", { popular: true, addOns: [{ id: "gel", name: "Upgrade to gel polish", price: 1500 }] }),
    ],
  },
  {
    slug: "hair", name: "Hair Studio", world: "beauty-wellness", icon: "Scissors",
    tagline: "Cuts, colour, keratin, blow-dry", heroLine: "Good hair days, delivered.",
    proType: "women", status: "live", includes: BEAUTY_INCLUDES, excludes: BEAUTY_EXCLUDES, faqs: BEAUTY_FAQS,
    services: [
      s("blow-dry", "Wash + blow-dry", 1800, 45, "Bouncy, glossy, event-ready.", { popular: true, variants: [{ label: "Hair length", options: [{ label: "Short", delta: 0 }, { label: "Medium", delta: 300 }, { label: "Long", delta: 600 }] }] }),
      s("haircut", "Haircut", 2000, 45, "Trim, layers or a fresh shape.", { variants: [{ label: "Cut", options: [{ label: "Trim", delta: 0 }, { label: "Layers / restyle", delta: 800 }] }] }),
      s("root-touch-up", "Root touch-up", 3000, 75, "Ammonia-free colour on the roots."),
      s("global-colour", "Global hair colour", 6000, 120, "One colour, all over.", { variants: [{ label: "Hair length", options: [{ label: "Short", delta: 0 }, { label: "Medium", delta: 1500 }, { label: "Long", delta: 3000 }] }] }),
      s("highlights", "Highlights / balayage", 8000, 150, "Dimension without the salon wait."),
      s("keratin", "Keratin treatment", 12000, 180, "Frizz-free for months.", { popular: true }),
      s("protein-treatment", "Protein treatment", 7000, 120, "Repairs damaged, coloured hair."),
      s("hair-spa", "Hair spa", 2500, 60, "Steam, mask, massage. Hair's day off."),
      s("oil-head-massage", "Oil head massage", 1200, 30, "Warm oil, slow hands, zero stress."),
    ],
  },
  {
    slug: "makeup-mehndi", name: "Makeup & Mehndi", world: "beauty-wellness", icon: "Palette",
    tagline: "Party glam, mehndi, squad bookings", heroLine: "From dholki to walima, we've got your glam.",
    proType: "women", status: "live", includes: BEAUTY_INCLUDES, excludes: BEAUTY_EXCLUDES, faqs: BEAUTY_FAQS,
    services: [
      s("party-makeup", "Party makeup", 6000, 75, "Full glam with lashes, set to last all night.", { popular: true, addOns: [{ id: "hair-styling", name: "Add hairstyling", price: 2000 }] }),
      s("soft-glam", "Soft glam / day makeup", 4000, 60, "Fresh, light, camera-friendly."),
      s("event-hairstyling", "Event hairstyling", 2500, 45, "Buns, waves, braids, blowouts."),
      s("makeup-hair-combo", "Makeup + hair combo", 8000, 120, "The full party package.", { popular: true }),
      s("mehndi-hands", "Mehndi: hands", 2500, 60, "Arabic, Pakistani or minimal designs.", { variants: [{ label: "Coverage", options: [{ label: "Both hands, front", delta: 0 }, { label: "Both hands, front + back", delta: 1500 }] }] }),
      s("mehndi-full", "Mehndi: arms + feet", 5000, 120, "Elbow-length arms and feet."),
      s("squad-glam", "Squad Glam (3+ guests)", 5500, 180, "Party makeup per guest, two pros, one booking.", { popular: true, variants: [{ label: "Guests", options: [{ label: "3 guests", delta: 11000 }, { label: "4 guests", delta: 16500 }, { label: "5 guests", delta: 22000 }] }] }),
      s("dupatta-draping", "Dupatta / saree draping", 1000, 20, "Pinned perfectly, stays put."),
      s("bridal-consult", "Bridal (by request)", 0, 60, "Tell us your dates; we match you with a senior artist."),
    ],
  },
  {
    slug: "nails-lashes", name: "Nails & Lashes", world: "beauty-wellness", icon: "Hand",
    tagline: "Gel, extensions, lash lifts, brows", heroLine: "Details make the look.",
    proType: "women", status: "live", includes: BEAUTY_INCLUDES, excludes: BEAUTY_EXCLUDES, faqs: BEAUTY_FAQS,
    services: [
      s("gel-polish", "Gel polish (hands)", 2000, 45, "Chip-free shine for two weeks.", { popular: true, addOns: [{ id: "nail-art", name: "Nail art (per hand)", price: 800 }] }),
      s("gel-removal", "Gel removal", 600, 20, "Gentle soak-off, no damage."),
      s("nail-extensions", "Nail extensions", 5000, 90, "Gel or acrylic, any shape."),
      s("lash-lift", "Lash lift + tint", 3500, 60, "Curled, darker lashes for 6 weeks."),
      s("lash-extensions", "Classic lash extensions", 6000, 90, "Natural-looking, one-to-one lashes."),
      s("brow-lamination", "Brow lamination", 3000, 45, "Fuller, brushed-up brows."),
      s("brow-tint", "Brow tint", 1200, 20, "Defined brows without pencil."),
    ],
  },
  {
    slug: "spa-women", name: "Spa for Women", world: "beauty-wellness", icon: "Flower2",
    tagline: "Massage, body polish, reflexology", heroLine: "Unwind without leaving the sofa.",
    proType: "women", status: "live", includes: [...BEAUTY_INCLUDES.slice(0, 3), "Portable massage table on request"], excludes: BEAUTY_EXCLUDES, faqs: BEAUTY_FAQS,
    services: [
      s("swedish-massage", "Swedish massage", 4500, 60, "Long, flowing strokes. Pure relaxation.", { popular: true, variants: [{ label: "Length", options: [{ label: "60 min", delta: 0 }, { label: "90 min", delta: 2000 }] }] }),
      s("deep-tissue", "Deep-tissue massage", 5500, 60, "Firm pressure for knots and tension."),
      s("pain-relief", "Pain-relief massage", 5000, 60, "Back, neck and shoulder focus."),
      s("aromatherapy", "Aromatherapy massage", 5000, 60, "Essential oils matched to your mood."),
      s("head-neck-shoulder", "Head, neck + shoulder", 2500, 30, "The desk-worker's rescue."),
      s("foot-reflexology", "Foot reflexology", 3000, 45, "Pressure-point foot therapy."),
      s("body-polish", "Body polish", 5000, 60, "Full-body scrub + hydrating wrap."),
    ],
  },
  {
    slug: "mens-grooming", name: "Men's Grooming", world: "beauty-wellness", icon: "User",
    tagline: "Haircut, beard, facial, massage", heroLine: "Sharp, without the barber queue.",
    proType: "technician", status: "live", includes: TECH_INCLUDES.slice(0, 3), excludes: [], faqs: TECH_FAQS,
    services: [
      s("mens-haircut", "Men's haircut", 1200, 30, "Clean cut at home."),
      s("beard", "Beard trim + styling", 700, 20, "Shape, line-up, hot towel."),
      s("haircut-beard", "Haircut + beard", 1700, 45, "The full refresh."),
      s("mens-facial", "Men's facial", 2500, 45, "Deep clean for city skin."),
      s("mens-head-massage", "Head massage", 1000, 20, "Ten-minute reset, doubled."),
      s("mens-massage", "Men's body massage", 4500, 60, "Relaxing or deep-tissue."),
    ],
  },

  // ---------------- Cleaning ----------------
  {
    slug: "home-cleaning", name: "Home Cleaning", world: "cleaning", icon: "SprayCan",
    tagline: "Hourly maids, deep cleans, move-in/out", heroLine: "Come home to clean.",
    proType: "technician", status: "live", includes: ["Trained, verified cleaners", "Equipment and materials (optional)", "Upfront hourly or fixed price"], excludes: ["Exterior walls", "Heavy furniture lifting"], faqs: TECH_FAQS,
    services: [
      s("hourly-maid", "Hourly maid", 1200, 120, "Book 2–4 hours of help, once or weekly.", { popular: true, variants: [{ label: "Hours", options: [{ label: "2 hours", delta: 0 }, { label: "3 hours", delta: 600 }, { label: "4 hours", delta: 1200 }] }, { label: "Materials", options: [{ label: "I have them", delta: 0 }, { label: "Bring materials", delta: 400 }] }] }),
      s("deep-cleaning", "Full home deep cleaning", 9000, 360, "Every room, top to bottom, machine-scrubbed.", { popular: true, variants: [homeSize] }),
      s("kitchen-deep-clean", "Kitchen deep clean", 4500, 180, "Degrease cabinets, hob, tiles and hood."),
      s("bathroom-deep-clean", "Bathroom deep clean", 2500, 90, "Descale, disinfect, shine.", { variants: [{ label: "Bathrooms", options: [{ label: "1", delta: 0 }, { label: "2", delta: 2000 }, { label: "3", delta: 3800 }] }] }),
      s("move-in-out", "Move-in / move-out clean", 12000, 420, "Empty-home deep clean for handovers."),
      s("post-construction", "Post-renovation clean", 15000, 480, "Dust, paint drops and debris, gone."),
    ],
  },
  {
    slug: "upholstery-cleaning", name: "Sofa, Carpet & Mattress", world: "cleaning", icon: "Sofa",
    tagline: "Shampoo, extraction, stain removal", heroLine: "Your sofa called. It wants a spa day.",
    proType: "technician", status: "live", includes: TECH_INCLUDES.slice(0, 3), excludes: ["Leather restoration"], faqs: TECH_FAQS,
    services: [
      s("sofa-shampoo", "Sofa shampoo", 3000, 90, "Wet extraction, dries in hours.", { popular: true, variants: [{ label: "Seats", options: [{ label: "3 seats", delta: 0 }, { label: "5 seats", delta: 1800 }, { label: "7 seats", delta: 3500 }] }] }),
      s("carpet-cleaning", "Carpet / rug cleaning", 2500, 60, "Deep shampoo and stain treatment."),
      s("mattress-cleaning", "Mattress cleaning", 2500, 45, "Dust-mite and stain treatment."),
      s("curtain-cleaning", "Curtain steam cleaning", 3000, 90, "Steamed on the rod, no removal."),
      s("chair-cleaning", "Dining chair cleaning", 1800, 45, "Six chairs, fabric seats."),
    ],
  },
  {
    slug: "water-tank-cleaning", name: "Water Tank Cleaning", world: "cleaning", icon: "Droplets",
    tagline: "Underground & overhead, disinfected", heroLine: "Clean tank, clean water.",
    proType: "technician", status: "live", includes: TECH_INCLUDES.slice(0, 3), excludes: ["Tank repair or re-plastering"], faqs: TECH_FAQS,
    services: [
      s("underground-tank", "Underground tank cleaning", 5000, 180, "Drain, scrub, sludge removal, disinfect.", { popular: true }),
      s("overhead-tank", "Overhead tank cleaning", 3000, 90, "Plastic or concrete roof tanks."),
      s("tank-combo", "Underground + overhead combo", 7000, 240, "Both tanks, one visit."),
    ],
  },
  {
    slug: "solar-cleaning", name: "Solar Panel Cleaning", world: "cleaning", icon: "Sun",
    tagline: "Wash + health check for more units", heroLine: "Dusty panels, lost units.",
    proType: "technician", status: "live", includes: TECH_INCLUDES.slice(0, 3), excludes: ["Inverter repair (see UPS & Inverter)"], faqs: TECH_FAQS,
    services: [
      s("panel-wash", "Solar panel wash", 2500, 60, "Soft-brush, de-mineralised water, up to 10 panels.", { popular: true, variants: [{ label: "Panels", options: [{ label: "Up to 10", delta: 0 }, { label: "11–20", delta: 2000 }, { label: "21–30", delta: 3800 }] }] }),
      s("panel-health-check", "Wash + health check", 4000, 90, "Cleaning plus output and wiring check."),
      s("solar-monthly", "Monthly cleaning plan", 2000, 60, "Scheduled every month during dust season."),
    ],
  },
  {
    slug: "car-wash", name: "Car Wash at Home", world: "cleaning", icon: "Car",
    tagline: "Exterior, interior, detailing", heroLine: "Shine in the driveway.",
    proType: "technician", status: "live", includes: TECH_INCLUDES.slice(0, 3), excludes: ["Paint correction"], faqs: TECH_FAQS,
    services: [
      s("exterior-wash", "Exterior wash", 1200, 40, "Waterless or low-water wash."),
      s("full-wash", "Interior + exterior", 2500, 90, "Vacuum, dashboard, glass, body.", { popular: true }),
      s("car-detailing", "Full detailing", 8000, 240, "Deep interior shampoo + polish."),
    ],
  },

  // ---------------- Pest Control ----------------
  {
    slug: "pest-control", name: "Pest Control", world: "pest-control", icon: "Bug",
    tagline: "Cockroach, termite, bed bugs, dengue", heroLine: "Bugs out. Peace in.",
    proType: "technician", status: "live", includes: [...TECH_INCLUDES.slice(0, 3), "Odourless, family-safe chemicals"], excludes: ["Structural termite barrier works"], faqs: TECH_FAQS,
    services: [
      s("cockroach", "Cockroach control", 3000, 60, "Gel + spray, kitchen and bathrooms.", { popular: true, variants: [homeSize] }),
      s("termite", "Termite treatment", 9000, 180, "Drill-fill-seal for wood and walls."),
      s("bed-bugs", "Bed bug treatment", 5000, 120, "Two-visit treatment for mattresses and furniture."),
      s("rodent", "Rodent control", 3500, 60, "Bait stations and entry-point sealing."),
      s("dengue-fumigation", "Dengue / mosquito fumigation", 3500, 60, "Indoor + lawn fogging, pre-monsoon.", { popular: true }),
      s("disinfection", "Home disinfection", 4000, 90, "Hospital-grade sanitising spray."),
    ],
  },

  // ---------------- AC & Appliances ----------------
  {
    slug: "ac-services", name: "AC Services", world: "ac-appliances", icon: "AirVent",
    tagline: "Service, gas, repair, install", heroLine: "Karachi summers, handled.",
    proType: "technician", status: "live", includes: TECH_INCLUDES, excludes: TECH_EXCLUDES, faqs: TECH_FAQS,
    services: [
      s("ac-service", "AC service (foam + jet)", 2500, 60, "Deep clean of coils, filters and drain. The pre-summer must.", { popular: true, variants: [acType, acCount] }),
      s("ac-gas-refill", "AC gas refill", 6500, 90, "Leak check + full gas top-up.", { variants: [acType] }),
      s("ac-repair", "AC repair (inspection)", 1500, 45, "Diagnosis; repair quoted before work."),
      s("ac-installation", "AC installation", 4000, 120, "Mounting, piping and test run.", { variants: [acType] }),
      s("ac-uninstall", "AC uninstallation", 2500, 60, "Safe removal with gas pumped down."),
      s("inverter-pcb", "Inverter AC PCB repair", 6000, 120, "Board diagnosis and repair."),
    ],
  },
  {
    slug: "appliance-repair", name: "Appliance Repair", world: "ac-appliances", icon: "WashingMachine",
    tagline: "Fridge, washer, geyser, microwave", heroLine: "Fixed at home, not ‘sent to the shop’.",
    proType: "technician", status: "live", includes: TECH_INCLUDES, excludes: TECH_EXCLUDES, faqs: TECH_FAQS,
    services: [
      s("fridge-repair", "Refrigerator repair", 1500, 60, "Cooling, compressor, gas, thermostat.", { popular: true }),
      s("washing-machine", "Washing machine repair", 1500, 60, "Automatic and semi-automatic."),
      s("microwave", "Microwave repair", 1200, 45, "Heating, turntable, panel faults."),
      s("geyser", "Geyser repair + service", 1800, 60, "Gas and electric; pre-winter service.", { popular: true }),
      s("water-dispenser", "Water dispenser repair", 1200, 45, "Cooling, heating, leaks."),
      s("ro-filter", "RO filter service", 2500, 45, "Cartridge change and TDS check."),
      s("tv-repair", "TV repair", 1500, 60, "LED/LCD diagnosis at home."),
      s("kitchen-hood", "Kitchen hood cleaning + repair", 2500, 60, "Degrease filters, fix motor."),
    ],
  },
  {
    slug: "ups-inverter", name: "UPS, Inverter & Battery", world: "ac-appliances", icon: "BatteryCharging",
    tagline: "Load-shedding sorted", heroLine: "Lights stay on.",
    proType: "technician", status: "live", includes: TECH_INCLUDES, excludes: TECH_EXCLUDES, faqs: TECH_FAQS,
    services: [
      s("ups-installation", "UPS installation + wiring", 4000, 120, "Dedicated circuit for fans and lights.", { popular: true }),
      s("battery-replacement", "Battery replacement", 1500, 45, "Swap, terminal clean, water top-up."),
      s("inverter-repair", "UPS / solar inverter repair", 2000, 60, "Diagnosis and repair at home."),
    ],
  },

  // ---------------- Repairs & Home ----------------
  {
    slug: "electrician", name: "Electrician", world: "repairs-home", icon: "Zap",
    tagline: "Fans, lights, switches, wiring", heroLine: "Sparks only where they belong.",
    proType: "technician", status: "live", includes: TECH_INCLUDES, excludes: TECH_EXCLUDES, faqs: TECH_FAQS,
    services: [
      s("fan-installation", "Ceiling fan installation", 1000, 45, "Mounting, wiring, balancing.", { popular: true }),
      s("fan-repair", "Fan repair", 800, 45, "Capacitor, noise, speed issues."),
      s("light-fixtures", "Light fixture installation", 800, 30, "Chandeliers, panels, spotlights."),
      s("switchboard", "Switchboard repair", 700, 30, "Sockets, switches, sparking boards."),
      s("db-repair", "Distribution board repair", 2500, 90, "Breakers, trips, overload issues."),
      s("wiring-inspection", "Wiring safety inspection", 2000, 60, "Whole-home check with a written report."),
    ],
  },
  {
    slug: "plumber", name: "Plumber", world: "repairs-home", icon: "ShowerHead",
    tagline: "Leaks, taps, pumps, drains", heroLine: "Drip, drip, done.",
    proType: "technician", status: "live", includes: TECH_INCLUDES, excludes: TECH_EXCLUDES, faqs: TECH_FAQS,
    services: [
      s("leak-repair", "Leak repair", 1000, 45, "Pipes, joints, under-sink leaks.", { popular: true }),
      s("tap-install", "Tap / mixer installation", 800, 30, "Kitchen or bathroom fittings."),
      s("water-pump", "Water pump / motor repair", 2000, 60, "Suction, pressure, wiring faults.", { popular: true }),
      s("geyser-fitting", "Geyser fitting", 2500, 90, "Installation and connections."),
      s("drain-blockage", "Drain blockage", 1500, 45, "Sinks, floor traps, toilets."),
      s("flush-repair", "Toilet / flush repair", 1000, 45, "Cisterns, seats, jet sprays."),
    ],
  },
  {
    slug: "handyman", name: "Carpenter & Handyman", world: "repairs-home", icon: "Hammer",
    tagline: "Assembly, mounting, locks, doors", heroLine: "That to-do list? Done.",
    proType: "technician", status: "live", includes: TECH_INCLUDES, excludes: TECH_EXCLUDES, faqs: TECH_FAQS,
    services: [
      s("furniture-assembly", "Furniture assembly", 1500, 60, "Beds, wardrobes, tables, flat-pack.", { popular: true }),
      s("tv-mounting", "TV wall mounting", 1500, 45, "Bracket, drilling, cable tidy.", { popular: true }),
      s("curtain-rods", "Curtain rods + blinds", 800, 30, "Per window, drilled and levelled."),
      s("door-lock", "Door lock installation", 1000, 30, "Locks, handles, smart locks."),
      s("door-repair", "Door repair", 1500, 60, "Hinges, alignment, sticking doors."),
      s("wall-drilling", "Shelves + wall drilling", 700, 30, "Frames, shelves, mirrors."),
    ],
  },
  {
    slug: "painting", name: "Painting & Waterproofing", world: "repairs-home", icon: "PaintRoller",
    tagline: "Rooms, homes, roofs, seepage", heroLine: "Fresh walls. Dry roofs.",
    proType: "technician", status: "live", includes: [...TECH_INCLUDES.slice(0, 3), "Furniture covering and masking"], excludes: ["Paint material (quoted at site visit)"], faqs: TECH_FAQS,
    services: [
      s("room-painting", "Room painting", 15000, 480, "One room, two coats, labour + prep.", { popular: true }),
      s("home-painting", "Full home painting", 0, 0, "Free site visit and fixed quote."),
      s("roof-waterproofing", "Roof waterproofing", 0, 0, "Pre-monsoon coating. Free inspection.", { popular: true }),
      s("seepage", "Seepage treatment", 0, 0, "Find the source, fix the wall."),
      s("wall-panels", "Wall panels", 0, 0, "PVC / WPC panels for feature walls."),
      s("touch-up", "Touch-up painting", 5000, 240, "Marks, patches and small areas."),
    ],
  },

  // ---------------- Health ----------------
  {
    slug: "health-at-home", name: "Health at Home", world: "health", icon: "Stethoscope",
    tagline: "Lab tests, nurses, physio, doctor", heroLine: "Care that comes to you.",
    proType: "care", status: "live", includes: ["Licensed, verified professionals", "Partner labs for all tests", "Digital reports"], excludes: ["Emergencies: call 1122"], faqs: TECH_FAQS,
    services: [
      s("lab-sample", "Lab test sample collection", 500, 20, "Phlebotomist collects at home; partner lab reports.", { popular: true }),
      s("nurse-visit", "Nurse visit", 2500, 60, "Injections, dressings, vitals."),
      s("physiotherapy", "Physiotherapy session", 3500, 45, "Post-op, back pain, mobility.", { popular: true }),
      s("doctor-visit", "Doctor home visit", 5000, 30, "GP consultation at home."),
      s("vaccination", "Vaccination at home", 1500, 20, "Flu and routine adult vaccines."),
    ],
  },

  // ---------------- Care ----------------
  {
    slug: "care", name: "Baby, Elder & Pet Care", world: "care", icon: "Baby",
    tagline: "Babysitters, attendants, pet grooming", heroLine: "Trusted hands for the ones you love.",
    proType: "care", status: "live", includes: CARE_INCLUDES, excludes: CARE_EXCLUDES, faqs: TECH_FAQS,
    services: [
      s("babysitter", "Babysitter", 1000, 180, "Per-hour care by trained women sitters.", { popular: true }),
      s("elder-care", "Elder-care attendant", 4000, 480, "Day shift companion and assistance."),
      s("pet-grooming", "Pet grooming", 3500, 90, "Bath, trim, nails for cats and dogs.", { popular: true }),
      s("vet-visit", "Vet home visit", 4000, 45, "Check-ups and vaccinations."),
    ],
  },

  // ---------------- Moving ----------------
  {
    slug: "moving-laundry", name: "Moving & Laundry", world: "moving", icon: "Truck",
    tagline: "Shifting, packing, laundry pickup", heroLine: "Heavy lifting, lightly priced.",
    proType: "technician", status: "live", includes: TECH_INCLUDES.slice(0, 3), excludes: ["Inter-city moves"], faqs: TECH_FAQS,
    services: [
      s("house-shifting", "In-city house shifting", 25000, 480, "Truck, crew, loading and unloading.", { popular: true, variants: [homeSize] }),
      s("packing", "Packing service", 8000, 240, "Boxes, bubble wrap and labels."),
      s("single-item", "Single item move", 3500, 90, "A sofa, fridge or bed across town."),
      s("wash-fold", "Laundry wash + fold", 250, 0, "Per kg, picked up and delivered in 48h.", { popular: true }),
      s("dry-cleaning", "Dry-cleaning pickup", 400, 0, "Per item, door to door."),
    ],
  },
]

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

const areas: Area[] = [
  { slug: "dha", name: "DHA", status: "live", blurb: "Every phase of DHA Karachi, from Phase 1 to Phase 8 and the extensions.", subAreas: ["Phase 1", "Phase 2", "Phase 2 Ext.", "Phase 4", "Phase 5", "Phase 6", "Phase 7", "Phase 7 Ext.", "Phase 8"] },
  { slug: "clifton", name: "Clifton", status: "live", blurb: "Clifton Blocks 1–9, Bath Island, Boat Basin and Kehkashan.", subAreas: ["Block 1", "Block 2", "Block 3", "Block 4", "Block 5", "Block 7", "Block 8", "Block 9", "Bath Island", "Kehkashan"] },
  { slug: "pechs", name: "PECHS", status: "live", blurb: "PECHS Blocks 2, 3 and 6, Tariq Road, Nursery and the Shahrah-e-Faisal side.", subAreas: ["Block 2", "Block 3", "Block 6", "Tariq Road", "Nursery", "Shahrah-e-Faisal"] },
  { slug: "bahadurabad", name: "Bahadurabad", status: "live", blurb: "Bahadurabad, Sharfabad, Dhoraji and Hill Park.", subAreas: ["Bahadurabad", "Sharfabad", "Dhoraji", "Hill Park", "BYJCHS"] },
  { slug: "gulshan", name: "Gulshan-e-Iqbal", status: "live", blurb: "Gulshan-e-Iqbal blocks, from Maskan to NIPA and 13-D.", subAreas: ["Block 1", "Block 2", "Block 4", "Block 5", "Block 6", "Block 7", "Block 10", "Block 13-D", "Maskan", "NIPA"] },
  { slug: "jauhar", name: "Gulistan-e-Jauhar", status: "live", blurb: "Gulistan-e-Jauhar blocks along Rashid Minhas Road and beyond.", subAreas: ["Block 1", "Block 2", "Block 3", "Block 7", "Block 12", "Block 13", "Block 14", "Block 15", "Block 17", "Block 18"] },
  { slug: "north-nazimabad", name: "North Nazimabad", status: "live", blurb: "North Nazimabad Blocks A to N, around Hyderi and Five Star.", subAreas: ["Block A", "Block B", "Block C", "Block D", "Block F", "Block H", "Block I", "Block J", "Block L", "Block N"] },
  { slug: "bahria", name: "Bahria Town", status: "live", blurb: "Bahria Town Karachi precincts and Bahria Heights.", subAreas: ["Precinct 1", "Precinct 2", "Precinct 6", "Precinct 10", "Precinct 11", "Precinct 19", "Precinct 27", "Precinct 31", "Bahria Heights"] },
]

// ---------------------------------------------------------------------------
// Bundles (shown on /offers and home)
// ---------------------------------------------------------------------------

export interface Bundle {
  slug: string
  name: string
  items: { category: string; service: string }[]
  price: number
  note: string
  status: Status
}

const bundles: Bundle[] = [
  { slug: "quick-refresh", name: "The Quick Refresh", price: 2600, status: "live", note: "Threading, underarms and a clean-up. In and out in 75 minutes.", items: [{ category: "womens-salon", service: "brows-upper-lip" }, { category: "womens-salon", service: "underarm-wax" }, { category: "womens-salon", service: "express-cleanup" }] },
  { slug: "weekend-reset", name: "The Weekend Reset", price: 7000, status: "live", note: "Facial, arms + legs wax and a manicure.", items: [{ category: "womens-salon", service: "hydrating-facial" }, { category: "womens-salon", service: "arms-legs-wax" }, { category: "womens-salon", service: "manicure" }] },
  { slug: "full-glow", name: "The Full Glow", price: 7800, status: "live", note: "Full body wax + brightening facial. Our hero bundle.", items: [{ category: "womens-salon", service: "full-body-wax" }, { category: "womens-salon", service: "brightening-facial" }] },
  { slug: "shaadi-ready", name: "Shaadi Season Ready", price: 11500, status: "live", note: "Pre-event facial, full wax, mani-pedi and brows.", items: [{ category: "womens-salon", service: "brightening-facial" }, { category: "womens-salon", service: "full-body-wax" }, { category: "womens-salon", service: "mani-pedi" }, { category: "womens-salon", service: "brows-upper-lip" }] },
  { slug: "pre-summer-ac", name: "Pre-summer AC Pack", price: 6500, status: "live", note: "Service three split ACs before the heat hits.", items: [{ category: "ac-services", service: "ac-service" }] },
  { slug: "pre-monsoon", name: "Pre-monsoon Home Pack", price: 0, status: "live", note: "Roof waterproofing check + dengue fumigation.", items: [{ category: "painting", service: "roof-waterproofing" }, { category: "pest-control", service: "dengue-fumigation" }] },
]

// ---------------------------------------------------------------------------
// Search vocabulary (editable in the CMS: Settings → Search)
// ---------------------------------------------------------------------------

// Whole-word synonyms, including everyday Karachi Roman Urdu. Values are added to the query.
const SYNONYMS: Record<string, string> = {
  "air conditioner": "ac", aircon: "ac", thanda: "ac", garmi: "ac", inverter: "ac inverter",
  wax: "waxing", waxing: "wax", maid: "hourly maid", cleaner: "cleaning", safai: "cleaning", jharu: "cleaning",
  bugs: "pest", keeray: "cockroach pest", keere: "cockroach pest", cockroaches: "cockroach", deemak: "termite", machhar: "mosquito dengue", dengue: "fumigation",
  mehendi: "mehndi", henna: "mehndi", "make up": "makeup", dulhan: "bridal makeup", shaadi: "makeup mehndi party", baal: "hair", chehra: "facial", nakhun: "nails",
  geezer: "geyser", fridge: "refrigerator", pani: "water leak", leakage: "leak", nalka: "tap", bijli: "electrician", pankha: "fan", tanki: "tank",
  rang: "painting", seepage: "seepage waterproofing", dhulai: "laundry", kapray: "laundry", shifting: "house shifting", doctor: "doctor visit", nurse: "nurse visit",
}

// Everyday filler words in Roman Urdu/English that should never drive a match.
const STOP_WORDS = "hai hain ka ki ke ko se mein me aur ya bhi nahi nai raha rahi rahe karna karni karwana karwani kar kaam theek thik chahiye mujhe mera meri mere hamara ghar pe par wala wali the and for the my need want get book please".split(" ")

// ---------------------------------------------------------------------------
// The catalogue as data, and the helpers built over it
// ---------------------------------------------------------------------------

export type CatalogData = {
  worlds: World[]
  categories: Category[]
  areas: Area[]
  bundles: Bundle[]
  minOrder: number // PKR
  coverage: string
  synonyms: Record<string, string>
  stopWords: string[]
}

/** The built-in catalogue: the CMS defaults, and the fallback whenever the CMS is unreachable. */
export const DEFAULT_CATALOG: CatalogData = { worlds, categories, areas, bundles, minOrder: 2500, coverage: "across Karachi", synonyms: SYNONYMS, stopWords: STOP_WORDS }

export const formatPKR = (n: number) => (n <= 0 ? "On request" : `PKR ${n.toLocaleString("en-PK")}`)
type DurationWords = { flexible: string; min: string; hr: string; hrs: string; hrMin: string }
const EN_DURATION: DurationWords = { flexible: "Flexible", min: "{{m}} min", hr: "{{h}} hr", hrs: "{{h}} hrs", hrMin: "{{h}} hr {{m}} min" }
/** "1 hr 30 min"; pass the UI strings' duration words for other languages. */
export const formatDuration = (min: number, w: DurationWords = EN_DURATION) => {
  const put = (s: string, h: number, m: number) => s.replace("{{h}}", String(h)).replace("{{m}}", String(m))
  if (!min) return w.flexible
  if (min < 60) return put(w.min, 0, min)
  const h = Math.floor(min / 60)
  const m = min % 60
  return put(m ? w.hrMin : h > 1 ? w.hrs : w.hr, h, m)
}

export const proLabel: Record<ProType, string> = {
  women: "Women-only pros",
  technician: "Verified technicians",
  care: "Licensed & verified carers",
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter(Boolean)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Every lookup the site needs, over one catalogue (the CMS's published data or the defaults). */
export function buildCatalog(data: CatalogData) {
  const { worlds, categories, areas, bundles } = data
  const visibleCategories = categories.filter((c) => c.status !== "hidden")
  const getWorld = (slug: string) => worlds.find((w) => w.slug === slug)
  const getCategory = (slug: string) => visibleCategories.find((c) => c.slug === slug)
  const getService = (cat: string, svc: string) => {
    const category = getCategory(cat)
    const service = category?.services.find((x) => x.slug === svc)
    return category && service ? { category, service } : undefined
  }
  const categoriesOf = (world: string) => visibleCategories.filter((c) => c.world === world)
  const worldStatus = (world: string): Status => (categoriesOf(world).some((c) => c.status === "live") ? "live" : "waitlist")
  const getArea = (slug: string) => areas.find((a) => a.slug === slug)
  const liveAreas = areas.filter((a) => a.status === "live")
  const allServices = visibleCategories.flatMap((c) => c.services.map((service) => ({ category: c, service })))

  const searchIndex = allServices.map(({ category, service }) => ({
    href: `/services/${category.slug}/${service.slug}`,
    title: service.name,
    subtitle: category.name,
    status: category.status,
    popular: Boolean(service.popular),
    keywords: `${service.name} ${service.short} ${category.name} ${category.tagline}`.toLowerCase(),
  }))
  const stop = new Set(data.stopWords)
  const synonyms = Object.entries(data.synonyms).map(([k, v]) => [new RegExp(`(^|[^a-z])${escapeRe(k.toLowerCase())}([^a-z]|$)`), v] as const)
  const indexWords = new Map(searchIndex.map((i) => [i.href, new Set(words(i.keywords))]))

  /** Whole-word search: 2-letter terms must match a word exactly; longer terms may match a word prefix. */
  function searchServices(q: string) {
    const query = q.trim().toLowerCase()
    if (!query) return []
    const typed = [...new Set(words(query))].filter((t) => t.length > 1 && !stop.has(t))
    const extra = synonyms.filter(([re]) => re.test(query)).flatMap(([, v]) => words(v))
    // Words the customer typed count double; synonym words count once.
    const terms = [...typed.map((t) => [t, 2] as const), ...[...new Set(extra)].filter((t) => !typed.includes(t)).map((t) => [t, 1] as const)]
    const hit = (set: Set<string>, t: string) => (t.length <= 3 ? set.has(t) : [...set].some((w) => w === t || w.startsWith(t) || (t.length > 4 && t.startsWith(w) && w.length > 3)))
    return searchIndex
      .map((item) => {
        const set = indexWords.get(item.href)!
        const title = new Set(words(item.title))
        const base = terms.reduce((acc, [t, w]) => acc + (hit(set, t) ? (hit(title, t) ? 3 : 1) * w : 0), 0)
        return { item, score: base ? base + (item.popular ? 1 : 0) : 0 }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (a.item.status === "live" ? -1 : 1))
      .map((r) => r.item)
  }

  return {
    data,
    worlds,
    categories,
    areas,
    bundles,
    MIN_ORDER: data.minOrder,
    COVERAGE: data.coverage,
    visibleCategories,
    getWorld,
    getCategory,
    getService,
    categoriesOf,
    worldStatus,
    getArea,
    liveAreas,
    allServices,
    serviceCount: allServices.length,
    searchIndex,
    searchServices,
  }
}

export type Catalog = ReturnType<typeof buildCatalog>

/** Area names for a form dropdown, plus "Other". */
export const areaOptions = (areas: Area[]) => areas.map((a) => a.name).concat("Other")
