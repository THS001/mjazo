// Glam Mirror: makeup and hair colour drawn over face landmarks. Colour only: no smoothing,
// reshaping, whitening or "fairness" of any kind (a Mjazo brand rule).

export type Lm = { x: number; y: number }

export const LIPS = [
  { id: "none", name: "None", hex: "" },
  { id: "nude-rose", name: "Nude rose", hex: "#b5615f" },
  { id: "mauve", name: "Mauve", hex: "#8d5468" },
  { id: "coral", name: "Coral", hex: "#d0584a" },
  { id: "brick", name: "Brick", hex: "#8e3b2e" },
  { id: "berry", name: "Berry", hex: "#7a1f3d" },
  { id: "classic-red", name: "Classic red", hex: "#a3141f" },
]
export const BLUSH = [
  { id: "none", name: "None", hex: "" },
  { id: "peach", name: "Peach", hex: "#f08a6c" },
  { id: "rose", name: "Rose", hex: "#d9667a" },
  { id: "berry", name: "Berry", hex: "#a8476a" },
]
export const KAJAL = [
  { id: "none", name: "None" },
  { id: "soft", name: "Soft kajal" },
  { id: "winged", name: "Winged liner" },
]
export const HAIR = [
  { id: "none", name: "Natural", hex: "" },
  { id: "chocolate", name: "Chocolate", hex: "#4a2a1a" },
  { id: "burgundy", name: "Burgundy", hex: "#5e1424" },
  { id: "caramel", name: "Caramel", hex: "#9a5b2a" },
  { id: "copper", name: "Copper", hex: "#a2471c" },
  { id: "ash", name: "Ash brown", hex: "#5b4c42" },
]
export type MakeupChoice = { lips: string; blush: string; kajal: string; hair: string }
export const NO_MAKEUP: MakeupChoice = { lips: "none", blush: "none", kajal: "none", hair: "none" }

// MediaPipe face mesh indices.
const LIP_OUT = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
const LIP_IN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
const EYE_L_UP = [33, 246, 161, 160, 159, 158, 157, 173, 133]
const EYE_L_LOW = [33, 7, 163, 144, 145, 153, 154, 155, 133]
const EYE_R_UP = [263, 466, 388, 387, 386, 385, 384, 398, 362]
const EYE_R_LOW = [263, 249, 390, 373, 374, 380, 381, 382, 362]

const P = (lm: Lm[], i: number, w: number, h: number) => ({ x: lm[i].x * w, y: lm[i].y * h })

function loop(ctx: CanvasRenderingContext2D, lm: Lm[], idx: number[], w: number, h: number) {
  idx.forEach((i, k) => {
    const p = P(lm, i, w, h)
    if (k) ctx.lineTo(p.x, p.y)
    else ctx.moveTo(p.x, p.y)
  })
  ctx.closePath()
}

function line(ctx: CanvasRenderingContext2D, lm: Lm[], idx: number[], w: number, h: number) {
  ctx.beginPath()
  idx.forEach((i, k) => {
    const p = P(lm, i, w, h)
    if (k) ctx.lineTo(p.x, p.y)
    else ctx.moveTo(p.x, p.y)
  })
  ctx.stroke()
}

/** Draws lips, blush and kajal for one face onto ctx (already holding the frame). */
export function drawMakeup(ctx: CanvasRenderingContext2D, lm: Lm[], w: number, h: number, c: MakeupChoice) {
  const faceW = Math.hypot((lm[234].x - lm[454].x) * w, (lm[234].y - lm[454].y) * h)
  const lips = LIPS.find((x) => x.id === c.lips)?.hex
  if (lips) {
    ctx.save()
    ctx.beginPath()
    loop(ctx, lm, LIP_OUT, w, h)
    loop(ctx, lm, LIP_IN, w, h)
    ctx.fillStyle = lips
    ctx.globalCompositeOperation = "multiply"
    ctx.globalAlpha = 0.62
    ctx.filter = `blur(${Math.max(0.6, faceW / 260)}px)`
    ctx.fill("evenodd")
    ctx.globalCompositeOperation = "soft-light"
    ctx.globalAlpha = 0.35
    ctx.fill("evenodd")
    ctx.restore()
  }
  const blush = BLUSH.find((x) => x.id === c.blush)?.hex
  if (blush)
    for (const i of [50, 280]) {
      const p = P(lm, i, w, h)
      const r = faceW * 0.15
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
      g.addColorStop(0, blush)
      g.addColorStop(1, "transparent")
      ctx.save()
      ctx.globalCompositeOperation = "multiply"
      ctx.globalAlpha = 0.28
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, r, r * 0.75, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  if (c.kajal !== "none") {
    ctx.save()
    ctx.strokeStyle = "#1b1210"
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.globalAlpha = 0.85
    ctx.filter = `blur(${Math.max(0.4, faceW / 500)}px)`
    ctx.lineWidth = Math.max(1.2, faceW * 0.007)
    for (const lowLine of [EYE_L_LOW, EYE_R_LOW]) line(ctx, lm, lowLine, w, h)
    if (c.kajal === "winged") {
      ctx.lineWidth = Math.max(1.5, faceW * 0.009)
      for (const [up, outer, inner] of [
        [EYE_L_UP, 33, 133],
        [EYE_R_UP, 263, 362],
      ] as const) {
        line(ctx, lm, up, w, h)
        const o = P(lm, outer, w, h)
        const n = P(lm, inner, w, h)
        const dx = o.x - n.x
        const dy = o.y - n.y
        const len = Math.hypot(dx, dy)
        ctx.beginPath()
        ctx.moveTo(o.x, o.y)
        ctx.lineTo(o.x + (dx / len) * faceW * 0.06, o.y + (dy / len) * faceW * 0.06 - faceW * 0.035)
        ctx.stroke()
      }
    }
    ctx.restore()
  }
}

/** Tints hair from a confidence mask (0-1 per pixel, mask size mw×mh), keeping the hair's own shading. */
export function drawHair(ctx: CanvasRenderingContext2D, mask: Float32Array, mw: number, mh: number, w: number, h: number, hairId: string, scratch: { mask?: HTMLCanvasElement; tint?: HTMLCanvasElement }) {
  const hex = HAIR.find((x) => x.id === hairId)?.hex
  if (!hex) return
  const m = (scratch.mask ??= document.createElement("canvas"))
  m.width = mw
  m.height = mh
  const mc = m.getContext("2d")!
  const img = mc.createImageData(mw, mh)
  for (let i = 0; i < mask.length; i++) img.data[i * 4 + 3] = Math.max(0, Math.min(255, (mask[i] - 0.25) * 340))
  mc.putImageData(img, 0, 0)
  const t = (scratch.tint ??= document.createElement("canvas"))
  t.width = w
  t.height = h
  const tc = t.getContext("2d")!
  tc.clearRect(0, 0, w, h)
  tc.fillStyle = hex
  tc.fillRect(0, 0, w, h)
  tc.globalCompositeOperation = "destination-in"
  tc.filter = "blur(2px)"
  tc.drawImage(m, 0, 0, w, h)
  tc.globalCompositeOperation = "source-over"
  tc.filter = "none"
  ctx.save()
  ctx.globalCompositeOperation = "color"
  ctx.globalAlpha = 0.5
  ctx.drawImage(t, 0, 0)
  ctx.globalCompositeOperation = "soft-light"
  ctx.globalAlpha = 0.3
  ctx.drawImage(t, 0, 0)
  ctx.restore()
}
