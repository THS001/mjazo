"use client"

import type { JobBrief } from "@/lib/ops/types"

// The brief a customer sends with their next booking: a Ghar Scan diagnosis or a Glam Mirror
// Look Card. Kept on this device until booked; photos then go to the pro and are deleted after
// the visit.

export type SavedBrief = JobBrief & { photos: string[]; categories: string[]; at: number }

const KEY = "mjazo-brief"
const MAX_AGE = 14 * 86400000

export function saveBrief(b: Omit<SavedBrief, "at" | "hasPhotos">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...b, at: Date.now() }))
    return true
  } catch {
    // Storage full (photos are large): keep the text without photos.
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...b, photos: [], pins: [], at: Date.now() }))
      return true
    } catch {
      return false
    }
  }
}

export function loadBrief(): SavedBrief | null {
  try {
    const b = JSON.parse(localStorage.getItem(KEY) ?? "null") as SavedBrief | null
    return b && Date.now() - b.at < MAX_AGE ? b : null
  } catch {
    return null
  }
}

export function clearBrief() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}

/** Smaller JPEG for storage and upload. */
export async function thumb(dataUrl: string, max = 640, quality = 0.78): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = dataUrl
  })
  const s = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement("canvas")
  c.width = Math.round(img.width * s)
  c.height = Math.round(img.height * s)
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL("image/jpeg", quality)
}
