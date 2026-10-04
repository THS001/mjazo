// The SEO score (0–100): deterministic checks on a page's rendered HTML, the same way a search
// engine sees it. Pure functions, so they're tested against fixtures (score.test.ts).

export type Check = { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string; weight: number }
export type Analysis = {
  score: number
  checks: Check[]
  stats: {
    title: string
    description: string
    h1: string[]
    headings: { level: number; text: string }[]
    words: number
    internalLinks: string[]
    externalLinks: number
    images: number
    imagesMissingAlt: number
    readability: number | null
    ogImage: string | null
    canonical: string | null
    noindex: boolean
  }
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\s${name}=("([^"]*)"|'([^']*)')`, "i"))
  return m ? decode(m[2] ?? m[3] ?? "") : null
}
const meta = (html: string, key: string, by: "name" | "property") => {
  for (const m of html.matchAll(/<meta\s[^>]*>/gi)) if (attr(m[0], by)?.toLowerCase() === key) return attr(m[0], "content")
  return null
}

/** Rough English syllable count (for the Flesch reading-ease score). */
function syllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "")
  if (!w) return 0
  if (w.length <= 3) return 1
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups?.length ?? 1)
}

/** Flesch reading ease (0–100, higher is easier). Null when the text isn't English or too short. */
export function readingEase(body: string): number | null {
  const words = body.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
  if (words.length < 30) return null
  const sentences = Math.max(1, (body.match(/[.!?]+(\s|$)/g) ?? []).length)
  const syl = words.reduce((n, w) => n + syllables(w), 0)
  return Math.round(206.835 - 1.015 * (words.length / sentences) - 84.6 * (syl / words.length))
}

/** Whether every word of the keyword appears in the text (any order, case-insensitive, singular or plural). */
export function hasKeyword(haystack: string, keyword: string) {
  const words = (s: string) => s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)
  const stem = (w: string) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)
  const hay = words(haystack).map(stem)
  const want = words(keyword).filter((w) => w.length > 1).map(stem)
  return want.length > 0 && want.every((w) => hay.includes(w) || (w.length > 4 && hay.some((h) => h.startsWith(w))))
}

export function analyse(html: string, ctx: { path: string; keyword?: string; locale?: "en" | "ur"; origin?: string }): Analysis {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
  const title = text(clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
  const description = meta(clean, "description", "name") ?? ""
  const robots = (meta(clean, "robots", "name") ?? "").toLowerCase()
  const ogImage = meta(clean, "og:image", "property")
  const canonical = attr(clean.match(/<link\s[^>]*rel="canonical"[^>]*>/i)?.[0] ?? "", "href")
  const main = clean.match(/<main[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? clean
  const headings = [...main.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: text(m[2]) })).filter((h) => h.text)
  const h1 = headings.filter((h) => h.level === 1).map((h) => h.text)
  const body = text(main)
  const words = (body.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length
  const firstPara = text(main.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "")
  const intro = `${h1.join(" ")} ${firstPara} ${body.slice(0, 600)}`
  const internal = new Set<string>()
  let external = 0
  for (const m of main.matchAll(/<a\s[^>]*>/gi)) {
    const href = attr(m[0], "href")
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|whatsapp):/i.test(href)) continue
    if (href.startsWith("/") && !href.startsWith("//")) internal.add(href.split("#")[0].split("?")[0] || "/")
    else if (ctx.origin && href.startsWith(ctx.origin)) internal.add(href.slice(ctx.origin.length).split("#")[0].split("?")[0] || "/")
    else if (/^https?:/i.test(href) && !/wa\.me|whatsapp/i.test(href)) external++
  }
  internal.delete(ctx.path)
  const imgs = [...main.matchAll(/<img\s[^>]*>/gi)].map((m) => m[0]).filter((t) => attr(t, "aria-hidden") !== "true")
  const missingAlt = imgs.filter((t) => !attr(t, "alt")?.trim()).length
  const readability = ctx.locale === "ur" ? null : readingEase(body)
  const kw = ctx.keyword?.trim() ?? ""
  const slug = decodeURIComponent(ctx.path).replace(/[/-]+/g, " ")
  const noindex = /noindex/.test(robots)

  const checks: Check[] = []
  const add = (id: string, label: string, weight: number, status: Check["status"], detail: string) => checks.push({ id, label, weight, status, detail })
  const range = (n: number, lo: number, hi: number, loWarn: number, hiWarn: number): Check["status"] => (n >= lo && n <= hi ? "pass" : n >= loWarn && n <= hiWarn ? "warn" : "fail")

  add("title-length", "Title length", 10, range(title.length, 30, 65, 20, 75), `${title.length} characters (aim for 30–60, plus the “· Mjazo” ending).`)
  add("description-length", "Description length", 10, range(description.length, 70, 160, 50, 200), description ? `${description.length} characters (aim for 70–160).` : "No description.")
  if (!kw) {
    add("keyword-set", "Focus keyword", 5, "fail", "No focus keyword set. Add one in the page's SEO group to unlock the keyword checks.")
  } else {
    add("keyword-set", "Focus keyword", 5, "pass", `“${kw}”`)
    add("keyword-title", "Keyword in title", 8, hasKeyword(title, kw) ? "pass" : "fail", hasKeyword(title, kw) ? "Found." : "Put the keyword in the search title.")
    add("keyword-h1", "Keyword in main heading", 7, hasKeyword(h1.join(" "), kw) ? "pass" : "warn", hasKeyword(h1.join(" "), kw) ? "Found." : "The H1 doesn't contain it.")
    add("keyword-description", "Keyword in description", 5, hasKeyword(description, kw) ? "pass" : "warn", hasKeyword(description, kw) ? "Found." : "Mention it in the search description.")
    add("keyword-intro", "Keyword in the opening text", 5, hasKeyword(intro, kw) ? "pass" : "warn", hasKeyword(intro, kw) ? "Found." : "Use it near the top of the page.")
    add("keyword-url", "Keyword in the address", 5, hasKeyword(slug, kw) ? "pass" : "warn", hasKeyword(slug, kw) ? "Found." : "The address doesn't contain it (fine for established pages; change slugs carefully).")
  }
  add("one-h1", "One main heading (H1)", 8, h1.length === 1 ? "pass" : h1.length === 0 ? "fail" : "warn", h1.length === 1 ? `“${h1[0].slice(0, 80)}”` : `${h1.length} H1 headings.`)
  let skipped = 0
  headings.reduce((prev, h) => {
    if (h.level > prev + 1) skipped++
    return h.level
  }, 1)
  add("heading-order", "Heading order", 4, skipped === 0 ? "pass" : "warn", skipped === 0 ? "No skipped levels." : `${skipped} heading${skipped > 1 ? "s skip" : " skips"} a level (e.g. H2 to H4).`)
  add("internal-links", "Links to other pages", 6, internal.size >= 3 ? "pass" : internal.size >= 1 ? "warn" : "fail", `${internal.size} internal link${internal.size === 1 ? "" : "s"} in the page body.`)
  add("image-alt", "Image alt text", 6, missingAlt === 0 ? "pass" : missingAlt <= 1 ? "warn" : "fail", imgs.length ? `${imgs.length - missingAlt} of ${imgs.length} images have alt text.` : "No images.")
  add("content-length", "Amount of content", 8, range(words, 300, Infinity, 150, Infinity), `${words} words in the page body.`)
  add("readability", "Readability", 5, readability === null ? "pass" : readability >= 50 ? "pass" : readability >= 30 ? "warn" : "fail", readability === null ? (ctx.locale === "ur" ? "Not measured for Urdu." : "Too little text to measure.") : `Reading ease ${readability} (50+ is plain English).`)
  add("share-image", "Share image", 4, ogImage ? "pass" : "warn", ogImage ? "Set." : "No og:image; links shared on WhatsApp show no picture.")
  add("indexable", "Search engines may index it", 4, noindex ? "fail" : "pass", noindex ? "This page is set to noindex." : "Yes.")

  const got = checks.reduce((n, c) => n + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0)
  const total = checks.reduce((n, c) => n + c.weight, 0)
  return {
    score: Math.round((got / total) * 100),
    checks,
    stats: { title, description, h1, headings, words, internalLinks: [...internal], externalLinks: external, images: imgs.length, imagesMissingAlt: missingAlt, readability, ogImage, canonical, noindex },
  }
}
