// Glam Mirror: procedural mehndi drawn onto a hand. Designs are built from classic henna motifs
// (mandalas, paisleys, vines, finger caps, bands, jaal lattice) anchored to the 21 hand landmarks
// MediaPipe finds on the device, so the design follows the real hand. When no hand is found the
// same design is drawn on a template hand the customer can move, scale and rotate.

export type Pt = { x: number; y: number }
export type HandPts = Pt[] // 21 landmarks in canvas pixels

export type DesignId = "arabic-trail" | "arabic-bloom" | "pak-jaal" | "pak-mandala" | "minimal-tips" | "minimal-vine" | "bridal-full"
export const DESIGNS: { id: DesignId; name: string; style: "Arabic" | "Pakistani" | "Minimal" | "Bridal"; note: string }[] = [
  { id: "arabic-trail", name: "Arabic trail", style: "Arabic", note: "A bold floral vine running diagonally up to the index finger." },
  { id: "arabic-bloom", name: "Arabic bloom", style: "Arabic", note: "A large flower by the thumb with a trailing vine." },
  { id: "pak-mandala", name: "Mandala & paisleys", style: "Pakistani", note: "A palm mandala ringed with paisleys, banded fingers." },
  { id: "pak-jaal", name: "Full jaal", style: "Pakistani", note: "Fine lattice across the palm, mandala, every finger detailed." },
  { id: "minimal-tips", name: "Dipped tips", style: "Minimal", note: "Solid fingertips and a small central mandala." },
  { id: "minimal-vine", name: "Single vine", style: "Minimal", note: "A delicate vine on one finger with a wrist band." },
  { id: "bridal-full", name: "Bridal full hand", style: "Bridal", note: "Dense coverage from fingertips to wrist." },
]
export const HENNA = { fresh: "#c0581c", dark: "#5e1d0c" } as const

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k })
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const ang = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x)
const avg = (...ps: Pt[]): Pt => ({ x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length })

/** Draw in a local frame: origin at p, +x pointing along angle a. */
function at(ctx: CanvasRenderingContext2D, p: Pt, a: number, fn: () => void) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(a)
  fn()
  ctx.restore()
}

function dot(ctx: CanvasRenderingContext2D, p: Pt, r: number) {
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** Teardrop petal from the origin along +x. */
function petal(ctx: CanvasRenderingContext2D, len: number, w: number, fill: boolean, inner = false) {
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.45, -w, len, 0)
  ctx.quadraticCurveTo(len * 0.45, w, 0, 0)
  if (fill) ctx.fill()
  else ctx.stroke()
  if (inner && !fill) {
    ctx.beginPath()
    ctx.moveTo(len * 0.15, 0)
    ctx.lineTo(len * 0.75, 0)
    ctx.stroke()
  }
}

function mandala(ctx: CanvasRenderingContext2D, c: Pt, r: number, rot = 0, rich = true) {
  at(ctx, c, rot, () => {
    dot(ctx, { x: 0, y: 0 }, r * 0.09)
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 8; i++)
      at(ctx, { x: 0, y: 0 }, (i / 8) * Math.PI * 2, () => {
        ctx.translate(r * 0.2, 0)
        petal(ctx, r * 0.22, r * 0.07, true)
      })
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2)
    ctx.stroke()
    const n = rich ? 12 : 8
    for (let i = 0; i < n; i++)
      at(ctx, { x: 0, y: 0 }, ((i + 0.5) / n) * Math.PI * 2, () => {
        ctx.translate(r * 0.46, 0)
        petal(ctx, r * 0.36, r * 0.11, false, true)
      })
    if (rich) {
      for (let i = 0; i < 24; i++) dot(ctx, { x: Math.cos((i / 24) * Math.PI * 2) * r * 0.88, y: Math.sin((i / 24) * Math.PI * 2) * r * 0.88 }, r * 0.025)
      ctx.beginPath()
      for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * Math.PI * 2
        const a1 = ((i + 1) / 16) * Math.PI * 2
        ctx.moveTo(Math.cos(a0) * r * 0.95, Math.sin(a0) * r * 0.95)
        ctx.quadraticCurveTo(Math.cos((a0 + a1) / 2) * r * 1.08, Math.sin((a0 + a1) / 2) * r * 1.08, Math.cos(a1) * r * 0.95, Math.sin(a1) * r * 0.95)
      }
      ctx.stroke()
    }
  })
}

function paisley(ctx: CanvasRenderingContext2D, p: Pt, s: number, a: number) {
  at(ctx, p, a, () => {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(s * 0.9, -s * 0.9, s * 1.6, -s * 0.1, s * 1.1, s * 0.45)
    ctx.bezierCurveTo(s * 0.8, s * 0.8, s * 0.2, s * 0.55, 0, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(s * 0.95, s * 0.12, s * 0.22, 0, Math.PI * 2)
    ctx.stroke()
    dot(ctx, { x: s * 0.95, y: s * 0.12 }, s * 0.07)
    for (let i = 1; i < 6; i++) dot(ctx, { x: s * (0.15 + i * 0.17), y: -s * (0.55 - Math.abs(i - 3) * 0.1) }, s * 0.035)
  })
}

/** A vine through points with alternating leaves and the odd dot. */
function vine(ctx: CanvasRenderingContext2D, pts: Pt[], leaf: number) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length - 1; i++) {
    const m = lerp(pts[i], pts[i + 1], 0.5)
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y)
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
  ctx.stroke()
  let side = 1
  for (let i = 0; i < pts.length - 1; i++) {
    const len = dist(pts[i], pts[i + 1])
    const steps = Math.max(1, Math.floor(len / (leaf * 1.6)))
    for (let k = 1; k <= steps; k++) {
      const p = lerp(pts[i], pts[i + 1], k / (steps + 0.5))
      const a = ang(pts[i], pts[i + 1]) + side * 0.9
      at(ctx, p, a, () => petal(ctx, leaf, leaf * 0.38, side > 0, true))
      side = -side
    }
  }
}

/** Solid dipped fingertip from the tip back towards the DIP joint, with a scalloped edge. */
function fingerCap(ctx: CanvasRenderingContext2D, tip: Pt, dip: Pt, w: number) {
  const a = ang(dip, tip)
  const len = dist(dip, tip) * 0.75
  at(ctx, tip, a + Math.PI, () => {
    ctx.beginPath()
    ctx.moveTo(-w * 0.15, -w * 0.5)
    ctx.quadraticCurveTo(-w * 0.75, 0, -w * 0.15, w * 0.5)
    ctx.lineTo(len, w * 0.5)
    for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(len + w * 0.18, w * 0.5 - (i + 0.5) * (w / 4), len, w * 0.5 - (i + 1) * (w / 4))
    ctx.closePath()
    ctx.fill()
    for (let i = 0; i < 3; i++) dot(ctx, { x: len + w * 0.35, y: -w * 0.32 + i * w * 0.32 }, w * 0.06)
  })
}

/** Two lines across the finger with dots between. */
function band(ctx: CanvasRenderingContext2D, p: Pt, a: number, w: number) {
  at(ctx, p, a, () => {
    for (const off of [-w * 0.12, w * 0.12]) {
      ctx.beginPath()
      ctx.moveTo(off, -w * 0.48)
      ctx.lineTo(off, w * 0.48)
      ctx.stroke()
    }
    for (let i = 0; i < 4; i++) dot(ctx, { x: 0, y: -w * 0.36 + i * w * 0.24 }, w * 0.05)
  })
}

function lattice(ctx: CanvasRenderingContext2D, poly: Pt[], cell: number) {
  ctx.save()
  ctx.beginPath()
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
  ctx.clip()
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const span = x1 - x0 + y1 - y0
  ctx.beginPath()
  for (let d = -span; d <= span; d += cell) {
    ctx.moveTo(x0 + d, y0)
    ctx.lineTo(x0 + d + (y1 - y0), y1)
    ctx.moveTo(x0 + d, y1)
    ctx.lineTo(x0 + d + (y1 - y0), y0)
  }
  ctx.stroke()
  for (let x = x0; x <= x1; x += cell) for (let y = y0; y <= y1; y += cell) dot(ctx, { x: x + cell / 2, y: y + cell / 2 }, cell * 0.08)
  ctx.restore()
}

function bracelet(ctx: CanvasRenderingContext2D, c: Pt, a: number, width: number, s: number) {
  at(ctx, c, a, () => {
    for (const off of [-s * 0.5, 0, s * 0.5]) {
      ctx.beginPath()
      ctx.moveTo(off, -width / 2)
      ctx.lineTo(off, width / 2)
      ctx.stroke()
    }
    const n = Math.max(6, Math.round(width / (s * 0.9)))
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const y0 = -width / 2 + (i * width) / n
      const y1 = y0 + width / n
      ctx.moveTo(s * 0.5, y0)
      ctx.quadraticCurveTo(s * 1.25, (y0 + y1) / 2, s * 0.5, y1)
    }
    ctx.stroke()
    for (let i = 0; i <= n; i++) dot(ctx, { x: -s * 0.25, y: -width / 2 + (i * width) / n }, s * 0.12)
  })
}

const FINGERS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
]

/** Geometry derived from the landmarks. */
function geo(L: HandPts) {
  const palmW = dist(L[5], L[17])
  const center = avg(L[0], L[5], L[9], L[13], L[17], L[9])
  const up = ang(L[0], L[9])
  const fw = palmW * 0.21
  // The palm proper: between the finger bases and the wrist, not the thumb.
  const palm = [lerp(L[0], L[17], 0.15), lerp(L[0], L[1], 0.7), lerp(L[1], L[5], 0.55), L[5], L[9], L[13], L[17], lerp(L[17], L[0], 0.35)]
  return { palmW, center, up, fw, palm }
}

/** Arabic-style shaded flower: bold outlined petals with filled inner halves. */
function flower(ctx: CanvasRenderingContext2D, c: Pt, r: number, rot: number, petals = 6) {
  at(ctx, c, rot, () => {
    for (let i = 0; i < petals; i++)
      at(ctx, { x: 0, y: 0 }, (i / petals) * Math.PI * 2, () => {
        ctx.translate(r * 0.2, 0)
        petal(ctx, r * 0.8, r * 0.3, false)
        petal(ctx, r * 0.5, r * 0.16, true)
      })
    dot(ctx, { x: 0, y: 0 }, r * 0.17)
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < petals; i++) {
      const a = ((i + 0.5) / petals) * Math.PI * 2
      dot(ctx, { x: Math.cos(a) * r * 0.62, y: Math.sin(a) * r * 0.62 }, r * 0.05)
    }
  })
}

export function drawDesign(ctx: CanvasRenderingContext2D, L: HandPts, id: DesignId, color: string) {
  const g = geo(L)
  const lw = Math.max(1, g.palmW * 0.011)
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  const caps = (which: number[]) => which.forEach((f) => fingerCap(ctx, L[FINGERS[f][3]], L[FINGERS[f][2]], g.fw * (f === 0 ? 1.15 : f === 4 ? 0.85 : 1)))
  const bands = (which: number[], joints: number[]) =>
    which.forEach((f) => joints.forEach((j) => band(ctx, lerp(L[FINGERS[f][j]], L[FINGERS[f][j + 1]], 0.5), ang(L[FINGERS[f][j]], L[FINGERS[f][j + 1]]), g.fw * (f === 4 ? 0.85 : 1))))
  const wrist = lerp(L[0], g.center, -0.12)

  switch (id) {
    case "arabic-trail": {
      // A bold diagonal trail from the wrist (little-finger side) up through the palm to the index finger.
      const start = add(lerp(L[0], L[17], 0.3), mul(sub(L[0], g.center), 0.3))
      const mid = lerp(start, g.center, 0.55)
      ctx.lineWidth = lw * 1.6
      vine(ctx, [start, mid, g.center, lerp(g.center, L[5], 0.55), L[5], L[6], L[7]], g.palmW * 0.15)
      flower(ctx, g.center, g.palmW * 0.26, g.up)
      flower(ctx, lerp(start, mid, 0.35), g.palmW * 0.15, g.up + 0.5, 5)
      flower(ctx, lerp(L[5], L[6], 0.15), g.palmW * 0.14, g.up - 0.4, 5)
      paisley(ctx, lerp(g.center, L[17], 0.45), g.palmW * 0.13, g.up + Math.PI * 0.75)
      caps([1])
      break
    }
    case "arabic-bloom": {
      // One big shaded flower by the thumb, a cascade down to the wrist and up the middle finger.
      const bloom = lerp(L[1], L[5], 0.45)
      ctx.lineWidth = lw * 1.5
      vine(ctx, [bloom, lerp(bloom, L[0], 0.5), add(L[0], mul(sub(L[0], g.center), 0.25))], g.palmW * 0.14)
      vine(ctx, [lerp(bloom, L[9], 0.35), lerp(g.center, L[9], 0.6), L[9], L[10], L[11]], g.palmW * 0.12)
      flower(ctx, bloom, g.palmW * 0.32, g.up, 7)
      flower(ctx, lerp(L[9], L[10], 0.5), g.palmW * 0.12, g.up, 5)
      flower(ctx, lerp(bloom, L[0], 0.62), g.palmW * 0.13, g.up + 0.6, 5)
      paisley(ctx, lerp(g.center, L[13], 0.55), g.palmW * 0.17, g.up + Math.PI / 2)
      caps([2])
      break
    }
    case "pak-mandala": {
      mandala(ctx, g.center, g.palmW * 0.36, g.up)
      for (let i = 0; i < 4; i++) {
        const a = g.up + Math.PI / 4 + (i * Math.PI) / 2
        paisley(ctx, add(g.center, { x: Math.cos(a) * g.palmW * 0.44, y: Math.sin(a) * g.palmW * 0.44 }), g.palmW * 0.17, a)
      }
      caps([0, 1, 2, 3, 4])
      bands([1, 2, 3, 4], [1])
      bands([0], [1])
      bracelet(ctx, wrist, g.up, g.palmW * 0.95, g.palmW * 0.06)
      break
    }
    case "pak-jaal": {
      lattice(ctx, g.palm, g.palmW * 0.11)
      ctx.lineWidth = lw * 1.1
      // Clear a disc for the mandala to sit on.
      ctx.save()
      ctx.globalCompositeOperation = "destination-out"
      dot(ctx, g.center, g.palmW * 0.3)
      ctx.restore()
      mandala(ctx, g.center, g.palmW * 0.28, g.up)
      caps([0, 1, 2, 3, 4])
      bands([1, 2, 3, 4], [0, 1])
      bands([0], [1])
      for (const f of [1, 2, 3, 4]) vine(ctx, [lerp(L[FINGERS[f][0]], L[FINGERS[f][1]], 0.62), lerp(L[FINGERS[f][1]], L[FINGERS[f][2]], 0.38)], g.fw * 0.42)
      bracelet(ctx, wrist, g.up, g.palmW * 1.0, g.palmW * 0.06)
      break
    }
    case "minimal-tips": {
      caps([0, 1, 2, 3, 4])
      mandala(ctx, g.center, g.palmW * 0.17, g.up, false)
      break
    }
    case "minimal-vine": {
      ctx.lineWidth = lw * 0.9
      vine(ctx, [L[13], L[14], L[15], L[16]], g.fw * 0.5)
      dot(ctx, L[16], g.fw * 0.18)
      bands([3], [0])
      bracelet(ctx, wrist, g.up, g.palmW * 0.7, g.palmW * 0.045)
      break
    }
    case "bridal-full": {
      lattice(ctx, g.palm, g.palmW * 0.09)
      ctx.save()
      ctx.globalCompositeOperation = "destination-out"
      dot(ctx, g.center, g.palmW * 0.38)
      ctx.restore()
      mandala(ctx, g.center, g.palmW * 0.36, g.up)
      for (let i = 0; i < 6; i++) {
        const a = g.up + (i * Math.PI) / 3
        dot(ctx, add(g.center, { x: Math.cos(a) * g.palmW * 0.44, y: Math.sin(a) * g.palmW * 0.44 }), g.palmW * 0.025)
      }
      caps([0, 1, 2, 3, 4])
      bands([1, 2, 3, 4], [0, 1])
      bands([0], [0, 1])
      for (const f of [1, 2, 3, 4]) vine(ctx, [lerp(L[FINGERS[f][0]], L[FINGERS[f][1]], 0.62), lerp(L[FINGERS[f][1]], L[FINGERS[f][2]], 0.4)], g.fw * 0.4)
      bracelet(ctx, wrist, g.up, g.palmW * 1.05, g.palmW * 0.07)
      bracelet(ctx, lerp(wrist, L[0], -0.9), g.up, g.palmW * 1.1, g.palmW * 0.07)
      paisley(ctx, lerp(L[0], L[1], 0.5), g.palmW * 0.16, g.up)
      break
    }
  }
  ctx.restore()
}

/** A generic open hand (palm facing the camera, fingers up), unit = roughly the palm width. */
const TEMPLATE: Pt[] = [
  [0, 0], [0.35, -0.15], [0.62, -0.4], [0.82, -0.66], [0.97, -0.92],
  [0.4, -1.0], [0.46, -1.45], [0.49, -1.76], [0.51, -2.02],
  [0.08, -1.06], [0.08, -1.57], [0.08, -1.9], [0.08, -2.18],
  [-0.21, -1.0], [-0.26, -1.46], [-0.29, -1.76], [-0.31, -2.0],
  [-0.46, -0.9], [-0.56, -1.22], [-0.61, -1.45], [-0.66, -1.66],
].map(([x, y]) => ({ x, y }))

/** Template hand placed by the customer (centre, palm width in px, rotation in radians). */
export function templateHand(c: Pt, size: number, rot: number): HandPts {
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  // Centre the template on its palm.
  const mid = { x: 0, y: -0.75 }
  return TEMPLATE.map((p) => {
    const q = { x: (p.x - mid.x) * size, y: (p.y - mid.y) * size }
    return { x: c.x + q.x * cos - q.y * sin, y: c.y + q.x * sin + q.y * cos }
  })
}

/** Composite: the photo, then the henna layer multiplied in and very slightly softened. */
export function renderMehndi(out: HTMLCanvasElement, photo: CanvasImageSource, w: number, h: number, hands: HandPts[], id: DesignId, color: string, showDesign = true) {
  out.width = w
  out.height = h
  const ctx = out.getContext("2d")!
  ctx.drawImage(photo, 0, 0, w, h)
  if (!showDesign || !hands.length) return
  const layer = document.createElement("canvas")
  layer.width = w
  layer.height = h
  const lc = layer.getContext("2d")!
  for (const L of hands) drawDesign(lc, L, id, color)
  ctx.save()
  ctx.globalCompositeOperation = "multiply"
  ctx.globalAlpha = 0.9
  ctx.filter = `blur(${Math.max(0.4, w / 2400)}px)`
  ctx.drawImage(layer, 0, 0)
  ctx.restore()
}

/** Draws a design on its own layer and multiplies it onto ctx (so cut-outs never punch through the photo). */
export function drawDesignOn(ctx: CanvasRenderingContext2D, L: HandPts, id: DesignId, color: string) {
  const layer = document.createElement("canvas")
  layer.width = ctx.canvas.width
  layer.height = ctx.canvas.height
  drawDesign(layer.getContext("2d")!, L, id, color)
  ctx.save()
  ctx.globalCompositeOperation = "multiply"
  ctx.drawImage(layer, 0, 0)
  ctx.restore()
}
