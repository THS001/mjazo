import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/server/store", () => ({ db: null }))
vi.mock("./store", () => ({ addAudit: async () => {}, allRows: async () => [] }))

describe("media uploads", () => {
  it("accepts the supported types and works out .glb files browsers don't label", async () => {
    const { mediaType } = await import("./media")
    expect(mediaType("photo.JPG", "image/jpeg")).toMatchObject({ kind: "image", ext: "jpg" })
    expect(mediaType("chair.glb", "")).toMatchObject({ kind: "model", mime: "model/gltf-binary" })
    expect(mediaType("chair.glb", "application/octet-stream")).toMatchObject({ kind: "model" })
    expect(mediaType("clip.webm", "video/webm")).toMatchObject({ kind: "video" })
  })

  it("never accepts SVG or unknown files", async () => {
    const { mediaType } = await import("./media")
    expect(() => mediaType("logo.svg", "image/svg+xml")).toThrow()
    expect(() => mediaType("logo.png", "image/svg+xml")).toThrow()
    expect(() => mediaType("tool.exe", "application/x-msdownload")).toThrow()
  })

  it("checks a file's first bytes match its type", async () => {
    const { sniff } = await import("./media")
    const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)))
    expect(sniff(bytes([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true)
    expect(sniff(bytes([0x89, 0x50, 0x4e, 0x47]), "image/png")).toBe(true)
    expect(sniff(bytes("RIFF", [0, 0, 0, 0], "WEBP"), "image/webp")).toBe(true)
    expect(sniff(bytes("glTF", [2, 0, 0, 0]), "model/gltf-binary")).toBe(true)
    expect(sniff(bytes("MZ", [0x90, 0]), "image/jpeg")).toBe(false)
    expect(sniff(bytes("<svg"), "image/png")).toBe(false)
  })

  it("rejects files over the limit for their type", async () => {
    const { prepareUpload } = await import("./media")
    await expect(prepareUpload({ name: "big.jpg", mime: "image/jpeg", size: 11 * 1024 * 1024 })).rejects.toThrow(/limit/)
    await expect(prepareUpload({ name: "empty.png", mime: "image/png", size: 0 })).rejects.toThrow(/empty/)
    const ok = await prepareUpload({ name: "Hero Shot (final).PNG", mime: "image/png", size: 2000 })
    expect(ok.mode).toBe("local")
    expect(ok.path).toMatch(/^\d{4}\/\d{2}\/[a-z0-9]+-hero-shot-final\.png$/)
  })
})
