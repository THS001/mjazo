// Takes the handbook's screenshots of the admin with headless Chrome, and measures where each
// numbered callout goes (docs/handbook/shots.js, read by handbook.html).
//
//   1. Run the dev server (npm run dev). The admin screens come from it, signed in as the local
//      Owner with local sample data; the sign-in screen comes from the live site.
//   2. node docs/handbook/shots.mjs upload     (once: puts sample images in the local media library)
//      node docs/handbook/shots.mjs            (all shots; or name some: ... shots.mjs editor history)
//   3. node docs/handbook/print.mjs
//
// The local-only "development" banner and notices are hidden, and the local sign-in's name
// ("Local owner") shows as the support account, so the pictures match the live admin.

import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, "shots")
const LOCAL = "http://localhost:3000"
const LIVE = "https://mjazo.vercel.app"
const DPR = 1.5
const PORT = 9333
const CHROME = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find((b) => b && existsSync(b))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// In-page helpers
// ---------------------------------------------------------------------------

const HELPERS = `
window.__vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" }
// "css:selector", "=exact text", or text the element contains; also matches placeholder and aria-label.
// Every match, each the deepest element holding it, in page order.
window.__findAll = (q, root) => {
  root = root || document.body
  if (q.startsWith("css:")) return [...root.querySelectorAll(q.slice(4))].filter(__vis)
  const exact = q.startsWith("=")
  const s = exact ? q.slice(1) : q
  const hits = []
  for (const e of root.querySelectorAll("*")) {
    if (["SCRIPT", "STYLE", "svg"].includes(e.tagName) || !__vis(e)) continue
    const t = (e.innerText || "").trim()
    if (!((exact ? t === s : t.includes(s)) || e.getAttribute("placeholder") === s || e.getAttribute("aria-label") === s)) continue
    const last = hits[hits.length - 1]
    if (last && last.contains(e)) hits[hits.length - 1] = e
    else hits.push(e)
  }
  return hits
}
window.__find = (q, root) => __findAll(q, root)[0] || null
window.__click = (q) => { const e = __find(q); if (!e) throw new Error("No element for " + q); (e.closest("button,a,label,[role=button]") || e).click() }
window.__waitFor = async (q, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { const e = __find(q); if (e) return e; await new Promise((r) => setTimeout(r, 200)) } throw new Error("Timed out waiting for " + q) }
window.__abs = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height } }
window.__clip = (spec) => {
  if (!spec) return { x: 0, y: 0, width: innerWidth, height: innerHeight }
  if (spec.rect) return spec.rect
  let e = __find(spec.q)
  if (e && spec.closest) e = e.closest(spec.closest)
  if (!e) throw new Error("No clip element for " + spec.q)
  const a = __abs(e), p = spec.pad ?? 16
  const x = Math.max(0, a.x - p), y = Math.max(0, a.y - (spec.padTop ?? p))
  return { x, y, width: Math.min(document.documentElement.scrollWidth - x, a.w + 2 * p), height: spec.height ?? a.h + (spec.padTop ?? p) + p }
}
window.__marks = (list, clip) => list.map((m, i) => {
  // The first match inside the picture (the same words can also be in the menu or further down).
  const all = __findAll(m.q)
  const inside = all.find((x) => { const a = __abs(x), cx = a.x + a.w / 2, cy = a.y + a.h / 2; return cx >= clip.x && cx <= clip.x + clip.width && cy >= clip.y && cy <= clip.y + clip.height })
  const e = inside || all[0]
  if (!e) return { n: i + 1, missing: m.q }
  // Far enough from the thing it points at not to cover its first letter.
  const a = __abs(e), at = m.at || "left", gap = 24
  const pos = { left: [a.x - gap, a.y + a.h / 2], right: [a.x + a.w + gap, a.y + a.h / 2], top: [a.x + a.w / 2, a.y - gap], bottom: [a.x + a.w / 2, a.y + a.h + gap], center: [a.x + a.w / 2, a.y + a.h / 2], tl: [a.x + 4, a.y + 4], tr: [a.x + a.w - 4, a.y + 4] }[at]
  const x = pos[0] + (m.dx || 0), y = pos[1] + (m.dy || 0)
  return { n: i + 1, x: +(((x - clip.x) / clip.width) * 100).toFixed(2), y: +(((y - clip.y) / clip.height) * 100).toFixed(2) }
})
`

/** Local admin only: hide what only shows on a developer's computer, and use the support account's name. */
const TIDY = `
if (!document.getElementById("__tidy")) {
  const st = document.createElement("style")
  st.id = "__tidy"
  st.textContent = "nextjs-portal{display:none!important} *{caret-color:transparent!important} ::-webkit-scrollbar{display:none}"
  document.head.append(st)
}
for (const e of document.querySelectorAll("div")) if (e.childElementCount === 0 && /^Local development:/.test(e.textContent.trim())) e.style.display = "none"
for (const t of ["AI translation needs ANTHROPIC_API_KEY", "Inviting people needs Supabase", "Two-step sign-in needs Supabase"]) {
  const e = __find(t)
  if (e) e.style.display = "none"
}
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
for (let n; (n = walker.nextNode()); ) {
  const v = n.nodeValue.replace(/Local owner/g, "Mjazo Support").replace(/Hello, Local\\./, "Hello, Mjazo Support.").replace(/owner@localhost/g, "mjazosupport@gmail.com")
  if (v !== n.nodeValue) n.nodeValue = v
}
// The avatar shows the first letter of the name.
for (const e of document.querySelectorAll("aside span, aside div")) if (e.childElementCount === 0 && e.textContent === "L") e.textContent = "M"
// React writes the greeting in pieces ("Hello, " + "Local" + "."), so set it whole.
for (const h of document.querySelectorAll("h1")) if (h.textContent === "Hello, Local.") h.textContent = "Hello, Mjazo Support."
`

const BRAND = "F:/mjazo/brand/logo"
/** Opens the History panel, then compares the newest version that has a Compare button. */
const OPEN_HISTORY = `__click("=History"); await __waitFor("=Compare")`

// ---------------------------------------------------------------------------
// The shots. marks: the numbered callouts, in order; their meanings are in handbook.html.
// ---------------------------------------------------------------------------

const crop = (x, y, width, height) => ({ rect: { x, y, width, height } })
/** Admin pages without the menu on the left (it's explained once, on the dashboard). */
const MAIN = 244

const SHOTS = [
  {
    name: "login",
    url: `${LIVE}/admin/login`,
    live: true,
    h: 760,
    clip: { q: "css:.max-w-sm", pad: 48 },
    marks: [{ q: "Email", at: "right", dx: -40 }, { q: "Password", at: "right", dx: -40 }, { q: "=Sign in", at: "right", dx: -40 }, { q: "Email me a sign-in link", at: "bottom" }, { q: "Forgot password?", at: "bottom" }],
  },
  {
    name: "dashboard",
    url: `${LOCAL}/admin`,
    h: 860,
    prep: `const c = __find("Finish setting up"); if (c) c.closest("[class*=rounded]").style.display = "none"`,
    marks: [{ q: "css:aside", at: "tr", dx: -24, dy: 150 }, { q: "=Waiting for you", at: "left" }, { q: "=Scheduled", at: "left" }, { q: "=Unpublished changes", at: "left" }, { q: "=Content", at: "left" }],
  },
  {
    name: "list",
    url: `${LOCAL}/admin/c/service`,
    h: 900,
    clip: crop(MAIN, 0, 1440 - MAIN, 600),
    marks: [{ q: "New service", at: "bottom" }, { q: "Search services", at: "left" }, { q: "Unpublished changes 1", at: "bottom" }, { q: "=Unpublished changes", at: "bottom" }, { q: "css:[aria-label='Drag to reorder']", at: "left", dx: 4 }, { q: "css:[title='View on site']", at: "bottom" }, { q: "=Built-in", at: "left" }],
  },
  {
    name: "editor",
    url: `${LOCAL}/admin/c/service/full-body-wax`,
    h: 1000,
    clip: crop(MAIN, 0, 1440 - MAIN, 600),
    marks: [
      { q: "css:main h1", at: "left", dx: 6 },
      { q: "=Unpublished changes", at: "bottom" },
      { q: "=اردو", at: "bottom" },
      { q: "Live preview", at: "bottom" },
      { q: "=Preview", at: "bottom" },
      { q: "=History", at: "bottom" },
      { q: "=Publish", at: "bottom" },
      { q: "css:main input", at: "left", dx: 6 },
      { q: "css:main input[placeholder='اردو']", at: "bottom" },
      { q: "Schedule publish", at: "left" },
      { q: "Discard changes", at: "left" },
      { q: "Hide from site", at: "left" },
      { q: "Translate the rest with AI", at: "left" },
    ],
  },
  {
    name: "live",
    url: `${LOCAL}/admin/c/service/full-body-wax`,
    h: 960,
    preview: true,
    // Wait until the page inside the preview has drawn.
    prep: `const f = document.querySelector("iframe")
      for (let i = 0; i < 120; i++) { try { if (f?.contentDocument?.body?.innerText.length > 200) break } catch {} await new Promise((r) => setTimeout(r, 500)) }
      await new Promise((r) => setTimeout(r, 3000))`,
    clip: crop(MAIN, 0, 1440 - MAIN, 960),
    marks: [{ q: "Live preview", at: "bottom" }, { q: "=Phone", at: "bottom" }, { q: "=English", at: "bottom" }, { q: "Click to edit on", at: "bottom" }, { q: "css:iframe", at: "center" }],
  },
  {
    name: "history",
    url: `${LOCAL}/admin/c/service/full-body-wax`,
    h: 900,
    prep: OPEN_HISTORY,
    clip: crop(950, 0, 490, 420),
    marks: [{ q: "Every publish is kept", at: "left", dx: 8 }, { q: "=Compare", at: "bottom" }, { q: "=Restore", at: "bottom" }],
  },
  {
    name: "compare",
    url: `${LOCAL}/admin/c/service/full-body-wax`,
    h: 900,
    prep: `${OPEN_HISTORY}; [...document.querySelectorAll("button")].filter((b) => b.innerText.trim() === "Compare")[1].click(); await __waitFor("Changes since"); await new Promise((r) => setTimeout(r, 2500))`,
    clip: crop(752, 0, 688, 420),
    marks: [{ q: "=what's in the form now", at: "bottom" }, { q: "=the live version", at: "bottom" }, { q: "css:.line-through", at: "top" }, { q: "as a draft", at: "right" }],
  },
  {
    name: "schedule",
    url: `${LOCAL}/admin/c/service/full-body-wax`,
    h: 1000,
    // A sample date, typed the way React expects, so the Schedule button shows as it does in use.
    prep: `__click("Schedule publish"); await __waitFor("Publish at (Karachi time)")
      const i = document.querySelector("input[type=datetime-local]")
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "2026-10-10T09:00")
      i.dispatchEvent(new Event("input", { bubbles: true }))`,
    clip: { q: "Publish at (Karachi time)", closest: "[class*=rounded-2xl]", pad: 16 },
    marks: [{ q: "css:input[type='datetime-local']", at: "left", dx: 8 }, { q: "=Schedule", at: "left" }, { q: "=Cancel", at: "right" }],
  },
  {
    name: "blocks",
    url: `${LOCAL}/admin/c/block-page/eid-glow`,
    h: 1300,
    clip: crop(MAIN, 0, 1440 - MAIN, 1060),
    marks: [{ q: "=Blocks", at: "left" }, { q: "css:main [aria-label='Drag to reorder']", at: "left", dx: 4 }, { q: "=Hero", at: "bottom" }, { q: "css:[aria-label='Duplicate block']", at: "left" }, { q: "css:[aria-label='Remove block']", at: "right" }, { q: "=Expand all", at: "right" }, { q: "10 Oct, 9:00", at: "right" }],
  },
  {
    name: "addblock",
    url: `${LOCAL}/admin/c/block-page/eid-glow`,
    h: 2400,
    prep: `__click("=Add a block"); await new Promise((r) => setTimeout(r, 800))`,
    clip: { q: "css:div.rounded-2xl.shadow-lg", pad: 20 },
  },
  {
    name: "upload",
    url: `${LOCAL}/admin/media`,
    files: [`${BRAND}/mjazo-logo-2000.png`, `${BRAND}/mjazo-mark-1024.png`, `${BRAND}/mjazo-wordmark-2000.png`, `${BRAND}/mjazo-app-icon-1024.png`],
    noShot: true,
  },
  {
    name: "media",
    url: `${LOCAL}/admin/media`,
    h: 900,
    clip: crop(MAIN, 0, 1440 - MAIN, 400),
    marks: [{ q: "Search by name, alt text or tag", at: "left" }, { q: "=Images", at: "bottom" }, { q: "=Upload", at: "bottom" }, { q: "No alt text", at: "right" }],
  },
  {
    name: "media-detail",
    url: `${LOCAL}/admin/media`,
    h: 1000,
    prep: `__click("css:main img"); await __waitFor("Where it's used")`,
    clip: { q: "Where it's used", closest: "[class*=rounded-2xl]", pad: 34, padTop: 10 },
    marks: [{ q: "Click the most important spot", at: "left" }, { q: "Copy link", at: "left" }, { q: "Suggest with AI", at: "top" }, { q: "What does the image show?", at: "left" }, { q: "salon, hero, eid", at: "left" }, { q: "=Where it's used", at: "left" }, { q: "Replace file", at: "top" }, { q: "=Delete", at: "top" }],
  },
  {
    name: "urdu",
    url: `${LOCAL}/admin/c/nav`,
    h: 900,
    clip: crop(MAIN, 0, 1440 - MAIN, 470),
    marks: [{ q: "=اردو", at: "bottom" }, { q: "css:main input", at: "left", dx: 6 }, { q: "css:main input[placeholder='اردو']", at: "top" }, { q: "texts translated", at: "left" }, { q: "Translate the rest with AI", at: "left" }],
  },
  {
    name: "translate",
    url: `${LOCAL}/admin/translate`,
    h: 900,
    // On this computer there's no AI key, so the button is greyed out; on the live site it works.
    prep: `for (const b of document.querySelectorAll("button")) if (b.innerText.includes("Translate everything missing")) b.disabled = false`,
    clip: crop(MAIN, 0, 1440 - MAIN, 560),
    marks: [{ q: "in Urdu", at: "left" }, { q: "Publish each one straight away", at: "bottom" }, { q: "Translate everything missing", at: "bottom" }, { q: "=Needs review", at: "bottom" }, { q: "Booking policy", at: "left" }],
  },
  {
    name: "seo-group",
    url: `${LOCAL}/admin/c/service/full-body-wax`,
    h: 1000,
    // The section reads the live page and its latest audit first.
    prep: `for (let i = 0; i < 120; i++) { if (!__find("Loading the live page") && !__find("No title yet") && !__find("Not audited yet")) break; await new Promise((r) => setTimeout(r, 500)) }`,
    clip: { q: "Overrides the service page", closest: "fieldset", pad: 12, height: 458 },
    marks: [{ q: "=Google", at: "bottom" }, { q: "WhatsApp & social", at: "right" }, { q: "css:p[class*='1a0dab']", at: "left", dx: 10 }, { q: "=Search title", at: "left", dx: 8 }, { q: "Suggest with AI", at: "left" }, { q: "css:a[href^='/admin/seo?path']", at: "right" }],
  },
  {
    name: "seo",
    url: `${LOCAL}/admin/seo`,
    h: 900,
    clip: crop(MAIN, 0, 1440 - MAIN, 700),
    marks: [{ q: "Average SEO score", at: "left" }, { q: "Audit all pages", at: "bottom" }, { q: "Search pages, addresses or keywords", at: "left" }, { q: "css:main select", at: "top" }, { q: "=76", at: "left" }, { q: "=Top problems", at: "right" }, { q: "=Audit", at: "left" }],
  },
  {
    name: "redirects",
    url: `${LOCAL}/admin/redirects`,
    h: 900,
    clip: crop(MAIN, 0, 1440 - MAIN, 790),
    marks: [{ q: "/old-page", at: "left" }, { q: "/new-page or https://…", at: "right", dx: -20 }, { q: "Permanent (308)", at: "right" }, { q: "=Add redirect", at: "right" }, { q: "Where does this address go?", at: "left" }, { q: "Added automatically when the address changed", at: "left" }, { q: "=Built into the site", at: "left" }],
  },
  {
    name: "activity",
    url: `${LOCAL}/admin/activity`,
    h: 900,
    clip: crop(MAIN, 0, 1440 - MAIN, 420),
    marks: [{ q: "=Who", at: "left" }, { q: "=What", at: "left" }, { q: "=Details", at: "left" }],
  },
  {
    name: "backup",
    url: `${LOCAL}/admin/backup`,
    h: 900,
    clip: crop(MAIN, 0, 1440 - MAIN, 540),
    marks: [{ q: "=Download backup", at: "right" }, { q: "Choose a backup file (.json)", at: "right" }],
  },
  {
    name: "people",
    url: `${LOCAL}/admin/people`,
    h: 900,
    clip: crop(MAIN, 0, 1440 - MAIN, 290),
    marks: [{ q: "css:main input[placeholder='Email']", at: "left", dx: 8 }, { q: "css:main input[placeholder='Name']", at: "left", dx: 8 }, { q: "css:main select", at: "bottom" }, { q: "Send invite", at: "bottom" }, { q: "Edit and publish content. Not prices", at: "left" }],
  },
]

// ---------------------------------------------------------------------------
// Chrome over the DevTools protocol
// ---------------------------------------------------------------------------

async function main() {
  if (!CHROME) throw new Error("No Chrome found. Set CHROME to its path.")
  mkdirSync(OUT, { recursive: true })
  const only = process.argv.slice(2)
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), "mjazo-shots")}`, "about:blank"], { stdio: "ignore" })
  try {
    let targets
    for (let i = 0; i < 50 && !targets; i++) targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => sleep(200).then(() => null))
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl)
    await new Promise((r) => (ws.onopen = r))
    let seq = 0
    const pending = new Map()
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data)
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg)
    }
    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const id = ++seq
        pending.set(id, (msg) => (pending.delete(id), msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result)))
        ws.send(JSON.stringify({ id, method, params }))
      })
    const run = async (code) => {
      const r = await send("Runtime.evaluate", { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    await send("Page.enable")
    await send("Network.enable")
    await send("Network.setCookie", { name: "mjz_cms_dev", value: "1", url: LOCAL, httpOnly: true })

    const file = join(here, "shots.js")
    const results = existsSync(file) ? JSON.parse(readFileSync(file, "utf8").replace(/^window\.SHOTS = /, "").replace(/;\s*$/, "")) : {}
    for (const s of SHOTS) {
      if (only.length && !only.includes(s.name)) continue
      // Uploads run only when named (node shots.mjs upload), so a rerun doesn't add the files twice.
      if (s.noShot && !only.includes(s.name)) continue
      process.stdout.write(`${s.name}… `)
      await send("Emulation.setDeviceMetricsOverride", { width: s.w ?? 1440, height: s.h ?? 900, deviceScaleFactor: DPR, mobile: false })
      // The editor remembers whether its live preview is open; each shot says which it wants.
      const { identifier } = await send("Page.addScriptToEvaluateOnNewDocument", { source: `try { localStorage.setItem("mjazo-cms-live-preview", "${s.preview ? 1 : 0}") } catch {}` })
      await send("Page.navigate", { url: s.url })
      for (let t = Date.now(); ; ) {
        await sleep(400)
        if ((await run("return document.readyState").catch(() => "")) === "complete") break
        if (Date.now() - t > 120000) throw new Error(`${s.url} didn't load`)
      }
      await send("Page.removeScriptToEvaluateOnNewDocument", { identifier })
      await sleep(s.wait ?? 2500)
      await run(`${HELPERS}; await document.fonts.ready`)
      if (!s.live) await run(TIDY)
      if (s.prep) await run(s.prep)
      if (s.files) {
        // Uploads through the page's own file picker, as a person would.
        const { root } = await send("DOM.getDocument", { depth: -1 })
        const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[type=file]" })
        await send("DOM.setFileInputFiles", { files: s.files, nodeId })
        await sleep(10000)
      }
      if (s.noShot) {
        console.log("done")
        continue
      }
      await sleep(s.settle ?? 800)
      if (!s.live) await run(TIDY)
      const clip = await run(`return __clip(${JSON.stringify(s.clip ?? null)})`)
      const marks = await run(`return __marks(${JSON.stringify(s.marks ?? [])}, ${JSON.stringify(clip)})`)
      const { data } = await send("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 1 }, captureBeyondViewport: true })
      writeFileSync(join(OUT, `${s.name}.png`), Buffer.from(data, "base64"))
      results[s.name] = { w: Math.round(clip.width), h: Math.round(clip.height), marks }
      const missing = marks.filter((m) => m.missing)
      console.log(missing.length ? `missing marks: ${missing.map((m) => `${m.n} (${m.missing})`).join(", ")}` : "ok")
    }
    writeFileSync(file, `window.SHOTS = ${JSON.stringify(results, null, 1)};\n`)
    ws.close()
  } finally {
    chrome.kill()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
