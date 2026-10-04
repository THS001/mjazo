"use server"

import { updateTag } from "next/cache"
import { run } from "@/lib/cms/action"
import { aiEnabled, MODELS } from "@/lib/ai/anthropic"
import { structured } from "@/lib/ai/structured"
import type { Localized } from "@/lib/cms/fields"
import { deleteMedia, finishUpload, getMedia, listMedia, mediaBytes, MediaError, mediaUsage, prepareUpload, replaceMedia, updateMedia, type MediaPatch } from "@/lib/cms/media"
import { getType } from "@/lib/cms/registry"
import { titleOf } from "@/lib/cms/write"
import { getRow } from "@/lib/cms/store"

// Server actions for the media library. Uploading and editing need "media"; deleting needs
// "media.delete". Changes to files already in use expire the `cms:media` cache tag, so every page
// that shows them picks up the new file or alt text.

type Meta = { width?: number | null; height?: number | null; color?: string | null }

export async function listMediaAction() {
  return run("view", () => listMedia())
}

export async function prepareUploadAction(file: { name: string; mime: string; size: number }) {
  return run("media", () => prepareUpload(file))
}

export async function finishUploadAction(up: { id: string; path: string; mime: string } & Meta) {
  return run("media", (u) => finishUpload(u, up))
}

export async function updateMediaAction(id: string, patch: MediaPatch) {
  return run("media", async (u) => {
    const row = await updateMedia(u, id, patch)
    updateTag("cms:media")
    return row
  })
}

export async function replaceMediaAction(id: string, up: { path: string; mime: string } & Meta) {
  return run("media", async (u) => {
    const row = await replaceMedia(u, id, up)
    updateTag("cms:media")
    return row
  })
}

export async function deleteMediaAction(id: string) {
  return run("media.delete", async (u) => {
    await deleteMedia(u, id)
    updateTag("cms:media")
    return null
  })
}

/** Where a file is used, with titles and editor links. */
export async function mediaUsageAction(id: string) {
  return run("view", async () =>
    Promise.all(
      (await mediaUsage(id)).map(async (x) => {
        const t = getType(x.type)
        const row = await getRow(x.type, x.id)
        return { ...x, label: t?.label ?? x.type, title: t ? titleOf(t, row?.draft ?? row?.published, x.id) : x.id, href: `/admin/c/${x.type}/${encodeURIComponent(x.id)}` }
      }),
    ),
  )
}

const VISION_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const

/** Alt text in English and Urdu, written by the vision model. Marked as AI so a person reviews it. */
export async function suggestAltAction(id: string) {
  return run("media", async (): Promise<Localized> => {
    if (!aiEnabled()) throw new MediaError("AI suggestions need ANTHROPIC_API_KEY in the environment.")
    const m = await getMedia(id)
    if (!m || m.kind !== "image") throw new MediaError("Alt text is for images.")
    const mime = VISION_TYPES.find((t) => t === m.mime)
    if (!mime) throw new MediaError("The AI can read JPG, PNG, GIF and WebP images.")
    const bytes = await mediaBytes(m)
    if (!bytes) throw new MediaError("Couldn't read the file.")
    if (bytes.length > 3_700_000) throw new MediaError("That image is too large for the AI (over 3.7 MB). Upload a smaller copy.")
    const out = await structured<{ en: string; ur: string }>({
      model: MODELS.vision,
      maxTokens: 400,
      system:
        "You write alt text for images on Mjazo, a Karachi home-services website (salon at home, cleaning, AC repair and more). Describe what matters for someone who can't see the image, in one plain sentence of at most 120 characters. Don't start with 'Image of' or 'Photo of'. Don't guess names or brands. Then give the same sentence in natural Urdu (Nastaliq script).",
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: bytes.toString("base64") } }, { type: "text", text: "Alt text for this image, in English and Urdu." }] }],
      tool: {
        name: "alt_text",
        description: "Alt text for the image",
        input_schema: { type: "object", properties: { en: { type: "string", description: "English alt text" }, ur: { type: "string", description: "Urdu alt text" } }, required: ["en", "ur"] },
      },
    })
    if (!out?.en) throw new MediaError("The AI didn't return a suggestion. Try again.")
    return { en: out.en.trim().slice(0, 300), ur: out.ur?.trim().slice(0, 300) ?? "", ai: true }
  })
}
