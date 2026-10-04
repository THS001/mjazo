"use client"

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react"
import { Environment, Lightformer } from "@react-three/drei"

/** Soft studio reflections built from local light panels (no HDRI download). */
export function StudioEnv() {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer intensity={2} position={[0, 5, -2]} scale={[10, 2, 1]} />
      <Lightformer intensity={1.2} position={[-5, 1, 1]} scale={[3, 6, 1]} rotation-y={Math.PI / 2} />
      <Lightformer intensity={1} color="#ffd9a0" position={[5, 1, 1]} scale={[3, 6, 1]} rotation-y={-Math.PI / 2} />
    </Environment>
  )
}

/** True when it's sensible to run WebGL: not reduced-motion, enough memory, WebGL available. */
export function useCan3D() {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    let gl = false
    try {
      gl = !!document.createElement("canvas").getContext("webgl2")
    } catch {}
    setOk(!reduce && gl && (mem === undefined || mem >= 4))
  }, [])
  return ok
}

/**
 * Mounts a 3D scene only when near the viewport, pauses it when offscreen, and renders
 * `fallback` when 3D isn't appropriate (reduced motion, low memory, no WebGL).
 */
export function Lazy3D({
  children,
  fallback,
  className,
  rootMargin = "200px",
}: {
  children: (active: boolean) => ReactNode
  fallback: ReactNode
  className?: string
  rootMargin?: string
}) {
  const can = useCan3D()
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    // Already on screen at load (e.g. a hero)? Mount now rather than waiting for the observer.
    const r = ref.current.getBoundingClientRect()
    if (r.top < window.innerHeight && r.bottom > 0) {
      setSeen(true)
      setActive(true)
    }
    const io = new IntersectionObserver(
      ([e]) => {
        setActive(e.isIntersecting)
        if (e.isIntersecting) setSeen(true)
      },
      { rootMargin },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref} className={className}>
      {can === false ? fallback : seen && can ? <Suspense fallback={fallback}>{children(active)}</Suspense> : null}
    </div>
  )
}
