"use client"

// Stylised extruded Karachi coast map. Zones rise from 0 with 60ms stagger; live zones
// glow saffron; hovering lifts a zone +6% and shows its name; clicking opens its page.

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Canvas, useFrame } from "@react-three/fiber"
import { Html, RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import { BRAND, Clay } from "./objects"
import { StudioEnv } from "./studio"
import { useCatalog } from "@/components/cms/provider"

// Rough relative positions (x: west→east, z: south→north), not to scale.
const LAYOUT: Record<string, [number, number, number, number]> = {
  // x, z, width, depth
  dha: [0.9, 1.2, 2.2, 1.4],
  clifton: [-0.9, 0.9, 1.4, 1.1],
  pechs: [0.2, -0.8, 1, 0.8],
  bahadurabad: [-0.6, -1.0, 0.8, 0.7],
  gulshan: [0.9, -1.9, 1.2, 0.9],
  jauhar: [2.1, -2.0, 1.1, 0.9],
  "north-nazimabad": [-0.9, -2.3, 1.1, 0.9],
  bahria: [3.0, -3.0, 1.2, 1],
}

function Zone({ slug, index }: { slug: string; index: number }) {
  const { areas } = useCatalog()
  const area = areas.find((a) => a.slug === slug)!
  const [x, z, w, d] = LAYOUT[slug]
  const live = area.status === "live"
  const ref = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const router = useRouter()
  const height = live ? 0.55 : 0.22

  useFrame((state, dt) => {
    if (!ref.current) return
    const t = THREE.MathUtils.clamp((state.clock.elapsedTime - 0.3 - index * 0.06) / 0.8, 0, 1)
    const target = (1 - Math.pow(1 - t, 3)) * (hover ? 1.25 : 1)
    ref.current.scale.y = THREE.MathUtils.damp(ref.current.scale.y, Math.max(target, 0.001), 10, dt)
  })

  return (
    <group position={[x, 0, z]}>
      <group ref={ref} scale={[1, 0.001, 1]}>
        <RoundedBox
          args={[w, height, d]}
          radius={0.06}
          position={[0, height / 2, 0]}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            document.body.style.cursor = "pointer"
          }}
          onPointerOut={() => {
            setHover(false)
            document.body.style.cursor = ""
          }}
          onClick={() => router.push(`/karachi/${slug}`)}
        >
          {live ? <meshPhysicalMaterial color={BRAND} roughness={0.4} clearcoat={0.5} emissive={BRAND} emissiveIntensity={hover ? 0.35 : 0.15} /> : <Clay color={hover ? "#d4d4d4" : "#e7e5e1"} />}
        </RoundedBox>
      </group>
      <Html center position={[0, height + 0.35, 0]} className="pointer-events-none" zIndexRange={[10, 0]}>
        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ${live ? "bg-black text-white" : "bg-white/90 text-zinc-500"}`}>
          {area.name}{live ? "" : " · soon"}
        </span>
      </Html>
    </group>
  )
}

function Sea() {
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-6, 2)
    s.bezierCurveTo(-3, 2.3, -1.5, 1.6, 0, 2.3)
    s.bezierCurveTo(1.5, 2.8, 3, 2.4, 6, 2.6)
    s.lineTo(6, 6)
    s.lineTo(-6, 6)
    return new THREE.ShapeGeometry(s, 32)
  }, [])
  return (
    <mesh geometry={geo} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <meshStandardMaterial color="#cfe3ea" roughness={0.3} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Rig() {
  const g = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    if (!g.current) return
    g.current.rotation.y = THREE.MathUtils.damp(g.current.rotation.y, state.pointer.x * 0.15, 3, dt)
  })
  return (
    <group ref={g} position={[-0.5, -0.6, 0.4]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial color="#f4f1ea" roughness={1} />
      </mesh>
      <Sea />
      {Object.keys(LAYOUT).map((slug, i) => (
        <Zone key={slug} slug={slug} index={i} />
      ))}
    </group>
  )
}

export default function MapScene({ active = true }: { active?: boolean }) {
  return (
    <Canvas frameloop={active ? "always" : "never"} dpr={[1, 1.5]} camera={{ position: [0, 6.5, 6.5], fov: 35 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 3]} intensity={1.4} />
      <StudioEnv />
      <Rig />
    </Canvas>
  )
}
