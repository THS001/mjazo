// Mjazo protocol manual: what Pro Copilot answers from. Generic, conservative guidance written
// for this build; the founder and trainers should review and replace it with Mjazo's own manual.

export type Protocol = { id: string; title: string; tags: string[]; text: string }

export const PROTOCOLS: Protocol[] = [
  {
    id: "hygiene-kit",
    title: "Hygiene and the sealed kit",
    tags: ["hygiene", "kit", "sealed", "gloves", "sheets", "safai", "clean"],
    text: "Open the sealed single-use kit in front of the customer. Wash or sanitise hands, then wear fresh gloves. Lay a disposable sheet. Never reuse spatulas, strips, files, buffers or sheets. Wipe tools with alcohol between steps. Bag all waste and take it with you.",
  },
  {
    id: "wax-sensitive",
    title: "Waxing: sensitive skin and when not to wax",
    tags: ["wax", "waxing", "sensitive", "skin", "rash", "allergy", "rica", "redness"],
    text: "Ask about sensitivity, recent sunburn, broken skin, and acne or skin medicines (retinoids, isotretinoin, strong exfoliating acids). If any apply, do not wax that area; offer threading or another service and note it. For sensitive skin use Rica (peel-off) wax, test a small patch first, keep wax at the correct temperature (test on your own wrist), wax in small sections, press immediately after each pull. Aftercare: soothing gel, no hot showers, gym, saunas or perfumed products for 24 hours. If a reaction looks severe (blistering, swelling spreading), stop and escalate to your supervisor.",
  },
  {
    id: "threading",
    title: "Threading",
    tags: ["threading", "brows", "upper lip", "thread"],
    text: "Use a new thread for every customer. Cleanse the area, hold skin taut, follow the customer's preferred shape and confirm the shape before finishing. Apply a soothing gel after. Avoid areas with active pimples, cuts or recent sunburn.",
  },
  {
    id: "facial",
    title: "Facials",
    tags: ["facial", "cleanup", "brightening", "acne", "allergy", "patch"],
    text: "Ask about allergies and current skin medicines. Patch test any new product on the jaw or inner arm. Never use bleach or skin-lightening products (Mjazo brand rule). For acne-prone skin, avoid heavy massage over active acne and do not extract inflamed spots. If the customer has a skin condition or wound, do not treat that area and suggest a dermatologist.",
  },
  {
    id: "massage",
    title: "Massage safety",
    tags: ["massage", "pregnant", "pregnancy", "pain", "deep tissue", "back"],
    text: "Ask about pregnancy, recent surgery, injuries, blood pressure and heart conditions before starting. If pregnant or any of these apply, do not do deep-tissue; offer a gentle relaxing massage only if the customer confirms her doctor is fine with it, otherwise reschedule. Stop if anything hurts sharply.",
  },
  {
    id: "mehndi",
    title: "Mehndi",
    tags: ["mehndi", "henna", "black henna", "allergy"],
    text: "Use only Mjazo-approved natural henna. Never use ‘black henna’ or any product with PPD: it can cause severe skin reactions. Ask about past reactions; patch test if unsure. Aftercare: keep dry for 6–8 hours, a little lemon-sugar once dry, scrape off (do not wash) after 8–12 hours.",
  },
  {
    id: "etiquette",
    title: "Customer etiquette",
    tags: ["customer", "etiquette", "late", "price", "extra", "upsell", "rude", "behaviour"],
    text: "Arrive in uniform with your Mjazo card. Greet, confirm the services and price before starting. Any extra service: confirm the price first and log it. Never take bookings directly or share your number for private work; all bookings go through Mjazo. If you'll be late, tell ops at once so we can inform the customer.",
  },
  {
    id: "safety",
    title: "Your safety",
    tags: ["safety", "unsafe", "harass", "scared", "sos", "danger", "cash", "leave"],
    text: "If you ever feel unsafe, stop the service, pack up and leave, then press SOS or call Mjazo support. You will never be penalised for leaving an unsafe situation. Check in on arrival and check out when you leave. Prefer digital payments to carrying cash; if paid in cash, keep it out of sight and don't count it in the street.",
  },
  {
    id: "ac-service",
    title: "AC service (split / inverter)",
    tags: ["ac", "air conditioner", "service", "foam", "jet", "filter", "coil", "drain", "dripping", "leak", "cooling"],
    text: "Switch off the breaker before opening the unit. Cover furniture and lay the bag. Clean filters, foam-wash the indoor coil, rinse with the jet, clear the drain line (water dripping indoors is usually a blocked or loose drain pipe or a dirty coil). Clean the outdoor unit coil. Restore power and test: indoor air should be clearly colder than room air after 10–15 minutes. Low cooling after cleaning can mean low gas: do not refill without a leak check; quote gas refill to the customer first.",
  },
  {
    id: "ac-errors",
    title: "AC error codes",
    tags: ["error", "code", "inverter", "display", "blinking", "e1", "e5", "f0", "h6", "pcb"],
    text: "Error codes differ by brand and model: always read the brand and model from the indoor unit label and check that brand's code list. Common families: sensor faults (indoor or outdoor temperature sensor), communication errors between indoor and outdoor unit (check wiring and connectors), and protection errors (high pressure, overcurrent, low gas). Power-cycle once (breaker off 5 minutes). If the code returns, do not open the PCB without approval; quote the PCB check to the customer and escalate if unsure.",
  },
  {
    id: "fridge",
    title: "Refrigerator not cooling",
    tags: ["fridge", "refrigerator", "cooling", "compressor", "gas", "thermostat", "ice"],
    text: "Check power and thermostat setting, door seals, and that the back/condenser coils are not blocked by dust. Listen for the compressor and fan. Ice build-up in a frost-free fridge suggests a defrost fault. Any gas work or compressor replacement must be quoted and approved before starting.",
  },
  {
    id: "geyser",
    title: "Geyser safety",
    tags: ["geyser", "gas", "smell", "pilot", "heater", "leak"],
    text: "If you smell gas: do not touch switches or light anything, open doors and windows, turn off the gas supply, get everyone out and call the gas company emergency line, then ops. Never bypass a thermostat or safety valve. Check the pilot, flue and burner; service only with the gas off.",
  },
  {
    id: "electrical",
    title: "Electrical safety",
    tags: ["electric", "electrician", "switch", "spark", "wiring", "breaker", "shock", "bijli"],
    text: "Turn off the breaker and confirm with a tester before touching any wire. Never work on live circuits or in wet conditions. Burnt smell, melted sockets or repeated tripping: isolate the circuit and recommend a wiring inspection.",
  },
  {
    id: "plumbing",
    title: "Leaks and plumbing",
    tags: ["leak", "pipe", "tap", "plumber", "drain", "pump", "motor", "pani"],
    text: "Shut the nearest valve or the main before working. For water near electrics, switch off power first. Find the source (joint, tap cartridge, pipe crack) before replacing parts; quote parts before fitting.",
  },
]

export function searchProtocols(q: string) {
  const terms = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1)
  return PROTOCOLS.map((p) => ({ p, score: terms.reduce((s, t) => s + (p.tags.some((tag) => tag.includes(t) || t.includes(tag)) ? 2 : 0) + (p.title.toLowerCase().includes(t) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.p)
}
