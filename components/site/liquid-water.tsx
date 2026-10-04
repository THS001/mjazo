"use client"

// Moving-water background: a tiny WebGL fragment shader (no three.js) that domain-warps
// fractal noise into folding liquid, shown only inside two pools that wander across the
// screen. Mostly thin gold threads of light on black, leaving wide breathing space.
// The pointer leaves a soft caustic. Renders at reduced resolution (it's soft by nature),
// caps at 30fps on phones, pauses when the tab is hidden, draws one still frame for
// reduced-motion users, and falls back to the static CSS gradient without WebGL.

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  float aspect = u_res.x / u_res.y;
  vec2 A = vec2(aspect, 1.0);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res.xy) / min(u_res.x, u_res.y);
  float t = u_time * 0.11;

  // Two pools of water that wander across the whole screen on unsynchronised paths
  float w = u_time * 0.21;
  vec2 c1 = vec2(0.5 + 0.40 * sin(w * 0.53), 0.5 + 0.34 * sin(w * 0.71 + 1.3));
  vec2 c2 = vec2(0.5 + 0.42 * cos(w * 0.37 + 2.0), 0.5 + 0.32 * sin(w * 0.43 + 4.1));
  float pool = max(smoothstep(0.46, 0.0, distance(uv * A, c1 * A)), 0.8 * smoothstep(0.38, 0.0, distance(uv * A, c2 * A)));

  // Domain-warped liquid, now quicker
  vec2 q = vec2(fbm(p * 1.5 + vec2(0.0, t)), fbm(p * 1.5 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p * 1.5 + 3.2 * q + vec2(1.7, 9.2) + 0.8 * t), fbm(p * 1.5 + 3.2 * q + vec2(8.3, 2.8) - 0.7 * t));
  float f = fbm(p * 1.5 + 3.0 * r);

  // Mostly thin threads of light; only a faint wash of colour
  float ridge = pow(1.0 - abs(f * 2.0 - 1.0), 11.0);
  float fine = pow(1.0 - abs(fbm(p * 3.0 + 2.0 * r + t) * 2.0 - 1.0), 16.0);

  vec3 bronze = vec3(0.26, 0.15, 0.04);
  vec3 gold = vec3(0.94, 0.71, 0.24);
  vec3 col = bronze * smoothstep(0.55, 0.95, f) * 0.22;
  col += gold * (ridge * 0.95 + fine * 0.45);
  col *= pool;

  // Pointer caustic (subtle)
  float m = smoothstep(0.26, 0.0, distance(uv * A, u_mouse * A));
  col += gold * m * (0.05 + 0.25 * ridge);

  gl_FragColor = vec4(col, 1.0);
}`

export function LiquidWater({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const gl = c.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" })
    if (!gl) return setFailed(true)

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
    }
    const vs = shader(gl.VERTEX_SHADER, VERT)
    const fs = shader(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return setFailed(true)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return setFailed(true)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, "a")
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, "u_res")
    const uTime = gl.getUniformLocation(prog, "u_time")
    const uMouse = gl.getUniformLocation(prog, "u_mouse")

    const touch = window.matchMedia("(hover: none) and (pointer: coarse)").matches
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Soft image → render below native resolution and let CSS scale it up.
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * (touch ? 0.45 : 0.6)
    const resize = () => {
      const w = Math.max(1, Math.round(c.clientWidth * scale))
      const h = Math.max(1, Math.round(c.clientHeight * scale))
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
        gl.viewport(0, 0, w, h)
      }
      gl.uniform2f(uRes, w, h)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(c)
    resize()

    // Pointer, eased so the caustic glides rather than snaps.
    const target = { x: -1, y: -1 }
    const mouse = { x: -1, y: -1 }
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      target.x = (e.clientX - r.left) / r.width
      target.y = 1 - (e.clientY - r.top) / r.height
    }
    window.addEventListener("pointermove", onMove, { passive: true })

    const start = performance.now() - 20000 // start mid-flow, not from a flat field
    const frameGap = touch ? 1000 / 30 : 0
    let last = 0
    let raf = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < frameGap) return
      last = now
      mouse.x += (target.x - mouse.x) * 0.05
      mouse.y += (target.y - mouse.y) * 0.05
      gl.uniform1f(uTime, (now - start) / 1000)
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    const run = () => {
      cancelAnimationFrame(raf)
      if (reduce) {
        gl.uniform1f(uTime, 20)
        gl.uniform2f(uMouse, mouse.x, mouse.y)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      } else if (document.visibilityState === "visible") raf = requestAnimationFrame(draw)
    }
    document.addEventListener("visibilitychange", run)
    run()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener("pointermove", onMove)
      document.removeEventListener("visibilitychange", run)
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    }
  }, [])

  if (failed)
    return <div aria-hidden className={cn("pointer-events-none", className)} style={{ background: "radial-gradient(70% 70% at 75% 30%, rgba(244,164,55,0.25), transparent 65%), #000" }} />
  return <canvas ref={canvas} aria-hidden className={cn("pointer-events-none block w-full h-full", className)} />
}
