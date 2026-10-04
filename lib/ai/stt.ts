import "server-only"

// Speech-to-text for WhatsApp voice notes. Provider-agnostic seam: today an OpenAI-compatible
// transcription endpoint (set STT_API_KEY, optionally STT_API_URL / STT_MODEL). Swap after the
// Urdu voice-note bake-off without touching the Concierge.

export const sttEnabled = () => Boolean(process.env.STT_API_KEY)

export async function transcribe(audio: ArrayBuffer, mime: string): Promise<string | null> {
  if (!sttEnabled()) return null
  const form = new FormData()
  form.append("file", new Blob([audio], { type: mime }), mime.includes("ogg") ? "note.ogg" : "note.m4a")
  form.append("model", process.env.STT_MODEL ?? "whisper-1")
  const res = await fetch(process.env.STT_API_URL ?? "https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.STT_API_KEY}` },
    body: form,
  })
  if (!res.ok) {
    console.error("[stt] failed", res.status, await res.text().catch(() => ""))
    return null
  }
  const j = (await res.json()) as { text?: string }
  return j.text?.trim() || null
}
