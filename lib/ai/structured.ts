import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { ai } from "./anthropic"

// One structured answer from Claude, in whichever way the model supports:
// 1. a forced tool call (older models), 2. structured output against a JSON schema (newer models
//    reject forced tool choice), 3. the tool offered with tool_choice "auto" as a last resort.
// The working mode is remembered per model, so the fallback only costs a retry once per instance.

type Mode = "tool" | "json" | "auto"
const learned = new Map<string, Mode>()

/** Structured outputs accept a subset of JSON Schema: closed objects, no numeric/length/count limits. */
function strictSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(strictSchema)
  if (!s || typeof s !== "object") return s
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
    if (["maxItems", "minItems", "minimum", "maximum", "maxLength", "minLength", "format"].includes(k)) continue
    out[k] = k === "properties" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([p, sv]) => [p, strictSchema(sv)])) : strictSchema(v)
  }
  if (out.type === "object") out.additionalProperties = false
  return out
}

const rejects = (e: unknown, what: RegExp) => e instanceof Anthropic.BadRequestError && what.test(e.message)

export async function structured<T>(p: { model: string; system: string; messages: Anthropic.MessageParam[]; tool: Anthropic.Tool; maxTokens?: number }): Promise<T | null> {
  const base = { model: p.model, max_tokens: p.maxTokens ?? 1200, messages: p.messages }
  // Claude 4.x models accept a forced tool call; newer ones reject it, so start them on "auto".
  const first = learned.get(p.model) ?? (/-4-|-4$|haiku-4/.test(p.model) ? "tool" : "auto")
  // Offering the tool unforced ("auto") is fast and reliable on newer models; JSON schema is the
  // last resort (its first use per schema can be slow).
  const order: Mode[] = [first, ...(["tool", "auto", "json"] as Mode[]).filter((m) => m !== first)]
  let lastError: unknown
  for (const mode of order) {
    try {
      if (mode === "json") {
        const res = await ai().messages.create({ ...base, system: p.system, output_config: { format: { type: "json_schema", schema: strictSchema(p.tool.input_schema) as Record<string, unknown> } } })
        const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("")
        learned.set(p.model, "json")
        return JSON.parse(text) as T
      }
      const res = await ai().messages.create({
        ...base,
        system: mode === "auto" ? `${p.system}\n\nAnswer only by calling the ${p.tool.name} tool.` : p.system,
        tools: [p.tool],
        tool_choice: mode === "tool" ? { type: "tool", name: p.tool.name } : { type: "auto" },
      })
      const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === p.tool.name)
      if (!use) throw new Error(`No ${p.tool.name} call`)
      learned.set(p.model, mode)
      return use.input as T
    } catch (e) {
      lastError = e
      // Only fall through on "this model doesn't support that mode"; anything else is a real error.
      const unsupported =
        (mode === "tool" && rejects(e, /tool_choice/i)) ||
        (mode === "auto" && e instanceof Error && e.message === `No ${p.tool.name} call`) ||
        (mode === "json" && (e instanceof SyntaxError || rejects(e, /output_config|output_format|json_schema|schema|structured/i)))
      if (!unsupported) throw e
    }
  }
  throw lastError
}
