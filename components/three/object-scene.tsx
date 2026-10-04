"use client"

// Single hero object (world / category / safety / partner pages).
// Enters with a -90°→0 spin over 1.2s, then floats with pointer parallax.

import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { ContactShadows, Float } from "@react-three/drei"
import * as THREE from "three"
import type { ThreeObject } from "@/lib/catalog"
import { WorldObject } from "./objects"
import { StudioEnv } from "./studio"

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function Spinner({ kind, tint, scale }: { kind: ThreeObject; tint: string; scale: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const p = easeOutCubic(Math.min(state.clock.elapsedTime / 1.2, 1))
    const entry = THREE.MathUtils.lerp(-Math.PI / 2, 0, p)
    g.rotation.y = entry + THREE.MathUtils.damp(g.rotation.y - entry, state.pointer.x * 0.5, 4, dt)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -state.pointer.y * 0.25, 4, dt)
    g.scale.setScalar(scale * (0.6 + 0.4 * p))
  })
  return (
    <group ref={ref}>
      <WorldObject kind={kind} tint={tint} />
    </group>
  )
}

export default function ObjectScene({ kind, tint, active = true, scale = 1.6 }: { kind: ThreeObject; tint: string; active?: boolean; scale?: number }) {
  return (
    <Canvas frameloop={active ? "always" : "never"} dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 35 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#ffd9a0" />
      <StudioEnv />
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.8}>
        <Spinner kind={kind} tint={tint} scale={scale} />
      </Float>
      <ContactShadows position={[0, -1.5, 0]} opacity={0.2} scale={6} blur={2.5} far={3} />
    </Canvas>
  )
}
