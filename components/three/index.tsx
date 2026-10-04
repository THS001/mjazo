"use client"

import dynamic from "next/dynamic"
import type { ThreeObject } from "@/lib/catalog"
import { Icon } from "@/components/site/primitives"
import { Lazy3D } from "./studio"

const ObjectScene = dynamic(() => import("./object-scene"), { ssr: false })
const MapScene = dynamic(() => import("./map-scene"), { ssr: false })

/** A GLB from the media library (modelUrl) replaces the built-in object for `kind`. */
export function ObjectCanvas({ kind, tint, icon, className, scale, modelUrl }: { kind: ThreeObject; tint: string; icon: string; className?: string; scale?: number; modelUrl?: string }) {
  return (
    <Lazy3D
      className={className}
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-48 h-48 rounded-full flex items-center justify-center" style={{ background: tint }}>
            <Icon name={icon} className="w-20 h-20" strokeWidth={1} />
          </div>
        </div>
      }
    >
      {(active) => <ObjectScene kind={kind} tint={tint} active={active} scale={scale} modelUrl={modelUrl} />}
    </Lazy3D>
  )
}

export function MapCanvas({ className, fallback }: { className?: string; fallback: React.ReactNode }) {
  return (
    <Lazy3D className={className} fallback={fallback}>
      {(active) => <MapScene active={active} />}
    </Lazy3D>
  )
}
