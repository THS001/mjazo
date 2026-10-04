"use client"

// Procedural "soft clay" objects: one per service world.
// Placeholders with the final look; swap each for its commissioned GLB (useGLTF) later
// without touching the scenes, since every object is ~1 unit tall and centred.

import { useMemo } from "react"
import * as THREE from "three"
import { RoundedBox } from "@react-three/drei"
import type { ThreeObject } from "@/lib/catalog"

export const BRAND = "#f4a437"
const INK = "#1c1c1c"

export function Clay({ color, rough = 0.55, metal = 0 }: { color: string; rough?: number; metal?: number }) {
  return <meshPhysicalMaterial color={color} roughness={rough} metalness={metal} clearcoat={0.35} clearcoatRoughness={0.4} />
}

function extrude(shape: THREE.Shape, depth = 0.25, bevel = 0.08) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 32 })
  g.center()
  return g
}

function Lipstick({ tint }: { tint: string }) {
  return (
    <group rotation={[0, 0, 0.35]}>
      <mesh position={[0, -0.35, 0]}><cylinderGeometry args={[0.28, 0.28, 0.6, 48]} /><Clay color={tint} /></mesh>
      <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.3, 0.3, 0.12, 48]} /><Clay color={BRAND} rough={0.25} metal={0.6} /></mesh>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.22, 0.22, 0.3, 48]} /><Clay color={BRAND} rough={0.25} metal={0.6} /></mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.12, 0.18, 0.4, 48]} /><Clay color="#c2414b" rough={0.35} /></mesh>
      <mesh position={[0.03, 0.72, 0]} rotation={[0, 0, -0.6]}><sphereGeometry args={[0.12, 32, 16]} /><Clay color="#c2414b" rough={0.35} /></mesh>
    </group>
  )
}

function Spray({ tint }: { tint: string }) {
  return (
    <group>
      <RoundedBox args={[0.55, 0.85, 0.35]} radius={0.15} smoothness={6} position={[0, -0.2, 0]}><Clay color={tint} /></RoundedBox>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.12, 0.15, 0.2, 32]} /><Clay color="#ffffff" /></mesh>
      <RoundedBox args={[0.5, 0.18, 0.22]} radius={0.07} position={[0.08, 0.48, 0]}><Clay color={BRAND} /></RoundedBox>
      <RoundedBox args={[0.08, 0.28, 0.14]} radius={0.04} position={[-0.05, 0.3, 0]} rotation={[0, 0, -0.25]}><Clay color={BRAND} /></RoundedBox>
      <mesh position={[0.36, 0.48, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.05, 0.1, 16]} /><Clay color={INK} /></mesh>
      <RoundedBox args={[0.36, 0.3, 0.02]} radius={0.01} position={[0, -0.2, 0.18]}><Clay color="#ffffff" /></RoundedBox>
    </group>
  )
}

function Shield({ tint }: { tint: string }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0.55)
    s.bezierCurveTo(0.2, 0.45, 0.35, 0.42, 0.45, 0.42)
    s.bezierCurveTo(0.45, -0.05, 0.35, -0.35, 0, -0.55)
    s.bezierCurveTo(-0.35, -0.35, -0.45, -0.05, -0.45, 0.42)
    s.bezierCurveTo(-0.35, 0.42, -0.2, 0.45, 0, 0.55)
    return extrude(s, 0.18, 0.06)
  }, [])
  const tick = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.17, 0, 0), new THREE.Vector3(-0.04, -0.13, 0), new THREE.Vector3(0.2, 0.15, 0)])
    return new THREE.TubeGeometry(curve, 32, 0.045, 12, false)
  }, [])
  return (
    <group>
      <mesh geometry={geo}><Clay color={tint} /></mesh>
      <mesh geometry={tick} position={[0, 0, 0.16]}><Clay color={BRAND} /></mesh>
    </group>
  )
}

function AC({ tint }: { tint: string }) {
  return (
    <group rotation={[0.1, -0.3, 0]}>
      <RoundedBox args={[1.3, 0.45, 0.32]} radius={0.12} smoothness={6}><Clay color="#ffffff" /></RoundedBox>
      <RoundedBox args={[1.1, 0.06, 0.05]} radius={0.02} position={[0, -0.13, 0.15]}><Clay color={tint} /></RoundedBox>
      <RoundedBox args={[1.1, 0.04, 0.05]} radius={0.02} position={[0, -0.03, 0.15]}><Clay color="#e9e9e9" /></RoundedBox>
      <mesh position={[0.5, 0.1, 0.165]}><sphereGeometry args={[0.025, 16, 16]} /><meshStandardMaterial color={BRAND} emissive={BRAND} emissiveIntensity={1.5} /></mesh>
      {[-0.25, 0, 0.25].map((x) => (
        <mesh key={x} position={[x, -0.42, 0.05]}><capsuleGeometry args={[0.03, 0.14, 8, 12]} /><Clay color={tint} /></mesh>
      ))}
    </group>
  )
}

function Wrench({ tint }: { tint: string }) {
  return (
    <group rotation={[0, 0, -0.7]}>
      <mesh position={[0, -0.15, 0]}><capsuleGeometry args={[0.1, 0.8, 8, 24]} /><Clay color={tint} /></mesh>
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI * 0.75]}><torusGeometry args={[0.2, 0.09, 24, 48, Math.PI * 1.5]} /><Clay color={BRAND} rough={0.3} metal={0.4} /></mesh>
      <mesh position={[0, -0.62, 0]}><torusGeometry args={[0.13, 0.06, 16, 32]} /><Clay color={BRAND} rough={0.3} metal={0.4} /></mesh>
    </group>
  )
}

function Stethoscope({ tint }: { tint: string }) {
  const tube = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.3, 0.5, 0),
      new THREE.Vector3(-0.32, 0.1, 0.05),
      new THREE.Vector3(0, -0.15, 0.1),
      new THREE.Vector3(0.32, 0.1, 0.05),
      new THREE.Vector3(0.3, 0.5, 0),
    ])
    return new THREE.TubeGeometry(curve, 64, 0.045, 12, false)
  }, [])
  const drop = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.15, 0.1), new THREE.Vector3(0.05, -0.4, 0.1), new THREE.Vector3(0.2, -0.5, 0.1)])
    return new THREE.TubeGeometry(curve, 32, 0.04, 12, false)
  }, [])
  return (
    <group>
      <mesh geometry={tube}><Clay color={tint} /></mesh>
      <mesh geometry={drop}><Clay color={tint} /></mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.53, 0]}><sphereGeometry args={[0.07, 24, 16]} /><Clay color={INK} /></mesh>
      ))}
      <mesh position={[0.3, -0.52, 0.1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.08, 40]} /><Clay color={BRAND} rough={0.25} metal={0.6} /></mesh>
    </group>
  )
}

function Heart({ tint }: { tint: string }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, -0.45)
    s.bezierCurveTo(-0.1, -0.35, -0.55, -0.05, -0.5, 0.2)
    s.bezierCurveTo(-0.45, 0.48, -0.1, 0.5, 0, 0.28)
    s.bezierCurveTo(0.1, 0.5, 0.45, 0.48, 0.5, 0.2)
    s.bezierCurveTo(0.55, -0.05, 0.1, -0.35, 0, -0.45)
    return extrude(s, 0.22, 0.1)
  }, [])
  return (
    <group>
      <mesh geometry={geo}><Clay color={tint} /></mesh>
      <mesh position={[0.28, 0.32, 0.18]}><sphereGeometry args={[0.07, 24, 16]} /><Clay color={BRAND} /></mesh>
    </group>
  )
}

function Box({ tint }: { tint: string }) {
  return (
    <group rotation={[0.3, 0.6, 0]}>
      <RoundedBox args={[0.8, 0.65, 0.8]} radius={0.06} smoothness={4}><Clay color={tint} /></RoundedBox>
      <RoundedBox args={[0.2, 0.67, 0.82]} radius={0.02} position={[0, 0, 0]}><Clay color={BRAND} /></RoundedBox>
    </group>
  )
}

export function WorldObject({ kind, tint }: { kind: ThreeObject; tint: string }) {
  switch (kind) {
    case "lipstick": return <Lipstick tint={tint} />
    case "spray": return <Spray tint={tint} />
    case "shield": return <Shield tint={tint} />
    case "ac": return <AC tint={tint} />
    case "wrench": return <Wrench tint={tint} />
    case "stethoscope": return <Stethoscope tint={tint} />
    case "heart": return <Heart tint={tint} />
    case "box": return <Box tint={tint} />
  }
}
