// Prints handbook.html to docs/Mjazo-CMS-Team-Handbook.pdf with headless Chrome (or Edge).
//   node docs/handbook/print.mjs
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, "..", "Mjazo-CMS-Team-Handbook.pdf")
const browsers = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean)
const browser = browsers.find((b) => existsSync(b))
if (!browser) throw new Error("No Chrome or Edge found. Set CHROME to its path.")

const r = spawnSync(browser, [
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  // Time for the Google Fonts to load before printing.
  "--virtual-time-budget=15000",
  `--print-to-pdf=${out}`,
  pathToFileURL(join(here, "handbook.html")).href,
], { encoding: "utf8" })
if (r.status !== 0 || !existsSync(out)) throw new Error(`Printing failed: ${r.stderr}`)
console.log(`Printed ${out}`)
