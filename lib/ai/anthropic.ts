import "server-only"
import Anthropic from "@anthropic-ai/sdk"

// Models per the AI roadmap: Sonnet for conversation + vision, Haiku for short high-volume copy.
// Override per deployment with env vars if needed.
export const MODELS = {
  concierge: process.env.AI_MODEL_CONCIERGE ?? "claude-sonnet-5-5",
  vision: process.env.AI_MODEL_VISION ?? "claude-sonnet-5-5",
  fast: process.env.AI_MODEL_FAST ?? "claude-haiku-4-5-20251001",
  // Opus for multi-step planning (Shaadi Orchestrator) and ops reasoning.
  planner: process.env.AI_MODEL_PLANNER ?? "claude-opus-5-5",
}

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY)

let client: Anthropic | null = null
export function ai() {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 45_000 })
  return client
}

/** Best-effort per-IP limiter (per server instance). Keeps one visitor from running up cost. */
const hits = new Map<string, number[]>()
export function rateLimited(key: string, max = 20, windowMs = 60_000) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > max
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon"
}
