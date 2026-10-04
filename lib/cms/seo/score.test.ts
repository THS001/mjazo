import { describe, expect, it } from "vitest"
import { analyse, hasKeyword, readingEase } from "./score"

const page = (o: { title?: string; description?: string; h1?: string; body?: string; noindex?: boolean; og?: boolean; imgs?: string[] }) => `<!doctype html><html><head>
<title>${o.title ?? "Waxing at home in Karachi from PKR 1,500 · Mjazo"}</title>
<meta name="description" content="${o.description ?? "Waxing at home across Karachi by women-only pros with sealed kits. All-in prices from PKR 1,500, and you pay after."}"/>
${o.noindex ? '<meta name="robots" content="noindex, nofollow"/>' : ""}
${o.og === false ? "" : '<meta property="og:image" content="https://x/og.png"/>'}
<script>var junk = "<h1>not a heading</h1>"</script>
</head><body><header><a href="/">Home</a></header><main>
<h1>${o.h1 ?? "Waxing at home"}</h1>
<p>${o.body ?? "Book waxing at home in Karachi. A verified woman pro brings a sealed kit and does the job in your home."}</p>
<h2>What's included</h2><p>${"Simple words make clear text for people to read. ".repeat(60)}</p>
<a href="/services">All services</a> <a href="/services/womens-salon">Salon</a> <a href="/safety#kits">Safety</a> <a href="https://instagram.com/x">IG</a>
${(o.imgs ?? ['<img src="/a.jpg" alt="A pro waxing an arm"/>']).join("")}
</main></body></html>`

describe("SEO score", () => {
  it("scores a well-made page highly", () => {
    const a = analyse(page({}), { path: "/services/womens-salon/waxing", keyword: "waxing at home Karachi" })
    expect(a.stats.h1).toEqual(["Waxing at home"])
    expect(a.stats.internalLinks.sort()).toEqual(["/", "/safety", "/services"].filter((p) => p !== "/").concat([]).length ? ["/safety", "/services", "/services/womens-salon"] : [])
    expect(a.checks.find((c) => c.id === "keyword-title")?.status).toBe("pass")
    expect(a.checks.find((c) => c.id === "one-h1")?.status).toBe("pass")
    expect(a.score).toBeGreaterThanOrEqual(85)
  })

  it("ignores scripts and the header when reading headings and links", () => {
    const a = analyse(page({}), { path: "/x" })
    expect(a.stats.h1).toHaveLength(1)
    expect(a.stats.internalLinks).not.toContain("/")
  })

  it("fails a page with no description, no H1, missing alt text and noindex", () => {
    const a = analyse(page({ description: "", h1: "", noindex: true, og: false, imgs: ['<img src="/a.jpg">', '<img src="/b.jpg" alt="">'] }), { path: "/x", keyword: "deep cleaning" })
    const st = (id: string) => a.checks.find((c) => c.id === id)?.status
    expect(st("description-length")).toBe("fail")
    expect(st("one-h1")).toBe("fail")
    expect(st("image-alt")).toBe("fail")
    expect(st("indexable")).toBe("fail")
    expect(st("share-image")).toBe("warn")
    expect(a.score).toBeLessThan(60)
  })

  it("reads a headline animated letter by letter as whole words", () => {
    const letters = (w: string) => `<span aria-hidden="true" class="inline-block">${[...w].map((c) => `<span class="inline-block" style="opacity:0">${c}</span>`).join("")}</span>`
    const h1 = `<span aria-label="Everything your home needs.">${letters("Everything ")}${letters("your ")}${letters("home ")}${letters("needs.")}</span>`
    const a = analyse(page({ h1, title: "Everything your home needs · Mjazo" }), { path: "/x", keyword: "home needs" })
    expect(a.stats.h1).toEqual(["Everything your home needs."])
    expect(a.checks.find((c) => c.id === "keyword-h1")?.status).toBe("pass")
  })

  it("keeps words apart across block tags", () => {
    const a = analyse(page({ body: "Clean homes<br>Happy families</p><p>Every day" }), { path: "/x" })
    expect(a.stats.words).toBeGreaterThan(300)
    expect(analyse(page({ h1: "Deep<div>cleaning</div>" }), { path: "/x" }).stats.h1).toEqual(["Deep cleaning"])
  })

  it("asks for a focus keyword when none is set", () => {
    const a = analyse(page({}), { path: "/x" })
    expect(a.checks.find((c) => c.id === "keyword-set")?.status).toBe("fail")
    expect(a.checks.some((c) => c.id === "keyword-title")).toBe(false)
  })

  it("matches keywords loosely and measures readability for English only", () => {
    expect(hasKeyword("Book AC service at home", "ac services")).toBe(true)
    expect(hasKeyword("Book a facial", "deep cleaning")).toBe(false)
    expect(hasKeyword("کراچی میں گھر پر ویکسنگ", "ویکسنگ کراچی")).toBe(true)
    expect(readingEase("The cat sat on the mat. ".repeat(10))).toBeGreaterThan(80)
    expect(analyse(page({}), { path: "/x", locale: "ur" }).stats.readability).toBeNull()
  })
})
