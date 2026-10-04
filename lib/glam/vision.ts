"use client"

import type { FaceLandmarker, HandLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision"

// On-device vision for Glam Mirror (MediaPipe). Models run in the browser, so selfies and hand
// photos never leave the phone. Loaded lazily, once, the first time a mode needs them.

const VERSION = "1.0.1"
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODELS = {
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  hair: "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite",
}

let files: ReturnType<typeof load> | null = null
function load() {
  return import("@mediapipe/tasks-vision").then(async (m) => ({ m, fs: await m.FilesetResolver.forVisionTasks(WASM) }))
}
const vision = () => (files ??= load())

/** GPU first (fast on phones), CPU if the device can't. */
async function withDelegate<T>(make: (d: "GPU" | "CPU") => Promise<T>) {
  try {
    return await make("GPU")
  } catch {
    return make("CPU")
  }
}

let hand: Promise<HandLandmarker> | null = null
export function handLandmarker() {
  return (hand ??= vision().then(({ m, fs }) => withDelegate((delegate) => m.HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODELS.hand, delegate }, runningMode: "IMAGE", numHands: 2 }))))
}

let face: Promise<FaceLandmarker> | null = null
export function faceLandmarker() {
  return (face ??= vision().then(({ m, fs }) => withDelegate((delegate) => m.FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODELS.face, delegate }, runningMode: "VIDEO", numFaces: 1 }))))
}

let hair: Promise<ImageSegmenter> | null = null
export function hairSegmenter() {
  return (hair ??= vision().then(({ m, fs }) => withDelegate((delegate) => m.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: MODELS.hair, delegate }, runningMode: "VIDEO", outputCategoryMask: false, outputConfidenceMasks: true }))))
}
