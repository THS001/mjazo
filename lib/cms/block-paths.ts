// Addresses for block pages. A block page lives at a path no other page claims: its first part
// can't be one of the site's own sections (their routes would answer first), a staff app, the API
// or a language prefix. block-paths.test.ts keeps SITE_SECTIONS in step with app/[locale].

/** The first part of every address the site's own pages use (folders in app/[locale]). */
export const SITE_SECTIONS = [
  "about",
  "account",
  "app",
  "blog",
  "booking",
  "business",
  "cancellation-refund",
  "careers",
  "cart",
  "checkout",
  "complaint",
  "contact",
  "ghar-scan",
  "gift-cards",
  "glam-mirror",
  "help",
  "home-pulse",
  "how-it-works",
  "karachi",
  "login",
  "offers",
  "partner",
  "plus",
  "privacy",
  "pro-code-of-conduct",
  "rate",
  "refer",
  "safety",
  "search",
  "services",
  "terms",
  "weddings",
]
const SYSTEM = ["admin", "ops", "pro", "api", "en", "ur", "icon", "apple-icon", "opengraph-image", "twitter-image"]
export const RESERVED = new Set([...SITE_SECTIONS, ...SYSTEM])

/** One to four parts of lowercase letters, numbers and single hyphens: /eid-sale, /campaigns/eid-sale. */
export const PATH_PATTERN = "^/[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*){0,3}$"

/** Problems with a block page address beyond its format (the field's pattern checks that). */
export function pathProblems(path: unknown): string[] {
  if (typeof path !== "string" || !new RegExp(PATH_PATTERN).test(path)) return []
  const first = path.split("/")[1]
  return RESERVED.has(first) ? [`Address: /${first} is already part of the site. Start the address with something else, like /campaigns/… or /${first}-…`] : []
}

/** A block page's entry id, from its first address: "/campaigns/eid-sale" → "campaigns--eid-sale" (parts never contain "--"). */
export const pathToId = (path: unknown) => (typeof path === "string" && new RegExp(PATH_PATTERN).test(path) ? path.slice(1).replace(/\//g, "--") : "")
