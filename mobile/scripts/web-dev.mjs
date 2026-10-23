// Try an app in a browser against the local website, without CORS:
//   node mobile/scripts/web-dev.mjs customer   (or pro)
// It starts the app's Expo web server on 8081 and serves everything from http://localhost:8082:
// /api/* goes to the website's dev server (localhost:3000), the rest to Expo. The app is built to
// call http://localhost:8082, so the browser sees one site. Phones never need this.
import { execFileSync, spawn } from "node:child_process"
import http from "node:http"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const app = process.argv[2] === "pro" ? "pro" : "customer"
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", app)
const PORT = 8082
const EXPO = 8081
const SITE = 3000

// An Expo web server left on 8081 by an earlier run (a hard stop on Windows leaves the child
// running) would block this one: stop it first. Only an Expo server is stopped, nothing else.
if (process.platform === "win32") {
  try {
    const ps = `Get-NetTCPConnection -LocalPort ${EXPO} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $p = $_.OwningProcess; if ((Get-CimInstance Win32_Process -Filter "ProcessId=$p").CommandLine -match 'expo.+--port ${EXPO}') { $p } }`
    for (const pid of execFileSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" }).split(/\s+/).filter(Boolean)) execFileSync("taskkill", ["/pid", pid, "/T", "/F"], { stdio: "ignore" })
  } catch {}
}

const expo = spawn(`npx expo start --web --port ${EXPO}`, {
  cwd: dir,
  shell: true,
  stdio: "inherit",
  env: { ...process.env, EXPO_PUBLIC_API_URL: `http://localhost:${PORT}`, BROWSER: "none" },
})
expo.on("exit", (code) => process.exit(code ?? 0))
// Stopping this script stops Expo too (on Windows a shell child isn't stopped with its parent).
const stopExpo = () => {
  if (process.platform === "win32" && expo.pid) spawn("taskkill", ["/pid", String(expo.pid), "/T", "/F"], { stdio: "ignore" })
  else expo.kill()
}
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(sig, () => (stopExpo(), process.exit(0)))

const target = (url = "") => (url.startsWith("/api/") ? SITE : EXPO)

http
  .createServer((req, res) => {
    const up = http.request({ host: "localhost", port: target(req.url), path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${target(req.url)}` } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers)
      r.pipe(res)
    })
    up.on("error", () => {
      if (res.headersSent) return res.destroy()
      res.writeHead(502, { "content-type": "text/plain" })
      res.end("The server behind this proxy isn't running yet.")
    })
    // A browser that leaves mid-download (a reload while the bundle streams) must not stop the proxy.
    req.on("error", () => up.destroy())
    res.on("error", () => up.destroy())
    req.pipe(up)
  })
  // Expo's live reload uses a WebSocket: pass it straight through.
  .on("upgrade", (req, socket, head) => {
    const up = net.connect(target(req.url), "localhost", () => {
      up.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n`)
      up.write(head)
      socket.pipe(up).pipe(socket)
    })
    up.on("error", () => socket.destroy())
    socket.on("error", () => up.destroy())
  })
  .listen(PORT, () => console.log(`Mjazo ${app} app (web) with the local API: http://localhost:${PORT}`))
