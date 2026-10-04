"use client"

// Phone hardware: titanium frame, side buttons and a rounded screen. The app inside is
// rendered at 390×844 and scaled to fit, then clipped to the screen's rounded corners
// (clip-path + overflow: clip), so nothing can ever spill past the glass.

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Hand, X } from "lucide-react"
import { PhoneApp, SCREEN_H, SCREEN_W } from "./phone-app"

export function phoneDims(width: number) {
  const bezel = Math.round(width * 0.034)
  const radius = Math.round(width * 0.16)
  const screenW = width - bezel * 2
  const scale = screenW / SCREEN_W
  const screenH = Math.round(SCREEN_H * scale)
  return { bezel, radius, screenW, screenH, scale, screenRadius: radius - bezel, height: screenH + bezel * 2 }
}

/**
 * On touchscreens the phone starts "locked" behind a Tap-to-try overlay, so swiping over it
 * scrolls the page instead of the mini app. Tap to use the app; tap Done to hand scrolling back.
 */
export function PhoneDevice({ width }: { width: number }) {
  const d = phoneDims(width)
  const [touch, setTouch] = useState(false)
  const [locked, setLocked] = useState(true)
  useEffect(() => setTouch(window.matchMedia("(hover: none) and (pointer: coarse)").matches), [])
  const button = "absolute w-[3px] rounded-full bg-gradient-to-b from-[#3a3a3c] to-[#1c1c1e]"
  return (
    <div
      data-phone
      role="region"
      aria-label="Interactive Mjazo app demo: tap around"
      className="relative"
      style={{
        width,
        height: d.height,
        padding: d.bezel,
        borderRadius: d.radius,
        background: "linear-gradient(145deg, #4a4a4d 0%, #1b1b1d 30%, #0e0e0f 70%, #2c2c2e 100%)",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.14), inset 0 0 0 4px #050505, 0 70px 120px -40px rgba(40,20,0,0.55), 0 30px 60px -30px rgba(0,0,0,0.4)",
      }}
    >
      {touch && !locked && (
        <button type="button" onClick={() => setLocked(true)} className="absolute -top-12 right-0 z-30 flex items-center gap-1.5 rounded-full bg-black text-white px-4 h-9 text-sm shadow-lg">
          <X className="w-4 h-4" /> Done
        </button>
      )}
      {/* Side buttons */}
      <span className={button} style={{ left: -2, top: d.height * 0.17, height: d.height * 0.045 }} />
      <span className={button} style={{ left: -2, top: d.height * 0.25, height: d.height * 0.08 }} />
      <span className={button} style={{ left: -2, top: d.height * 0.35, height: d.height * 0.08 }} />
      <span className={button} style={{ right: -2, top: d.height * 0.28, height: d.height * 0.12 }} />

      {/* Screen */}
      <div
        className="relative overflow-clip bg-[#fbfaf7]"
        style={{ width: d.screenW, height: d.screenH, borderRadius: d.screenRadius, clipPath: `inset(0 round ${d.screenRadius}px)` }}
      >
        <div style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${d.scale})`, transformOrigin: "0 0" }}>
          <PhoneApp />
        </div>
        {/* Touch lock: lets the page scroll past the phone until the visitor chooses to use it */}
        <AnimatePresence>
          {touch && locked && (
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLocked(false)}
              style={{ pointerEvents: locked ? "auto" : "none" }}
              className="absolute inset-0 z-20 flex items-end justify-center pb-[18%] bg-gradient-to-t from-black/25 via-transparent to-transparent"
              aria-label="Tap to try the Mjazo app"
            >
              <span className="flex items-center gap-2 rounded-full bg-black/85 text-white px-4 h-10 text-sm shadow-lg">
                <Hand className="w-4 h-4" /> Tap to try the app
              </span>
            </motion.button>
          )}
        </AnimatePresence>
        {/* Glass sheen (doesn't block taps) */}
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 28%, rgba(255,255,255,0) 100%)" }} />
      </div>
    </div>
  )
}
